/* ============================================================
   recorder.js – Kamera, Mikrofon und Videoaufnahme
   Nutzt ausschliesslich Browser-Standardfunktionen.
   Es wird nichts uebertragen: der Videostream bleibt im Geraet,
   die Datei wird lokal gespeichert.
   ============================================================ */

var TPRecorder = (function () {
  'use strict';

  /* Bevorzugte Aufnahmeformate, in dieser Reihenfolge geprueft.
     MP4 zuerst, weil es die Galerie und Schnittprogramme am besten kennen. */
  var FORMAT_CANDIDATES = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];

  var stream = null;
  var recorder = null;
  var chunks = [];
  var activeMime = '';
  var startedAt = 0;
  var handlers = {};       // { onStreamLost, onError }
  var trackWatchers = [];

  /* ---------- Faehigkeiten ---------- */

  function isSupported() {
    return !!(navigator.mediaDevices &&
              navigator.mediaDevices.getUserMedia &&
              window.MediaRecorder);
  }

  function pickMimeType() {
    if (!window.MediaRecorder || !window.MediaRecorder.isTypeSupported) return '';
    for (var i = 0; i < FORMAT_CANDIDATES.length; i++) {
      if (window.MediaRecorder.isTypeSupported(FORMAT_CANDIDATES[i])) {
        return FORMAT_CANDIDATES[i];
      }
    }
    return '';
  }

  function extensionFor(mime) {
    if (!mime) return 'webm';
    if (mime.indexOf('mp4') !== -1) return 'mp4';
    return 'webm';
  }

  function shortFormatName(mime) {
    if (!mime) return 'Standard';
    if (mime.indexOf('mp4') !== -1) return 'MP4';
    if (mime.indexOf('webm') !== -1) return 'WebM';
    return mime;
  }

  /* ---------- Mikrofone ---------- */

  /**
   * Liest die verfuegbaren Audio-Eingaenge.
   * Namen sind erst sichtbar, wenn die Mikrofon-Berechtigung erteilt wurde.
   */
  function listMicrophones() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve([]);
    }
    return navigator.mediaDevices.enumerateDevices().then(function (devices) {
      return devices
        .filter(function (d) { return d.kind === 'audioinput'; })
        .map(function (d, index) {
          return {
            deviceId: d.deviceId,
            label: d.label || ('Mikrofon ' + (index + 1)),
            isUsb: /usb|dji|wireless|mic\b/i.test(d.label || '')
          };
        });
    }).catch(function () {
      return [];
    });
  }

  /** Fordert einmal kurz die Berechtigung an, damit Geraetenamen lesbar werden. */
  function requestPermissionForLabels() {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(function (tmp) {
        tmp.getTracks().forEach(function (t) { t.stop(); });
        return true;
      });
  }

  /* ---------- Stream oeffnen ---------- */

  function buildAudioConstraints(settings, useDeviceId) {
    var filters = !!settings.audioFilters;
    var audio = {
      echoCancellation: filters,
      noiseSuppression: filters,
      autoGainControl: filters
    };
    if (useDeviceId && settings.micId) {
      audio.deviceId = { exact: settings.micId };
    }
    return audio;
  }

  var VIDEO_CONSTRAINTS = {
    facingMode: 'user',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 }
  };

  /**
   * Oeffnet Kamera + Mikrofon.
   * Ergebnis: { stream, micLabel, resolution, warning }
   */
  function open(settings) {
    close();

    var wantsSpecificMic = !!settings.micId;

    return navigator.mediaDevices.getUserMedia({
      audio: buildAudioConstraints(settings, true),
      video: VIDEO_CONSTRAINTS
    }).catch(function (err) {
      // Gespeichertes Mikrofon nicht vorhanden -> ohne Geraetewahl erneut versuchen
      var recoverable = wantsSpecificMic && (
        err.name === 'OverconstrainedError' ||
        err.name === 'NotFoundError' ||
        err.name === 'NotReadableError'
      );
      if (!recoverable) throw err;

      return navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(settings, false),
        video: VIDEO_CONSTRAINTS
      }).then(function (fallbackStream) {
        fallbackStream.__tpWarning = 'Das gespeicherte Mikrofon wurde nicht gefunden. Es wird das Standard-Mikrofon verwendet.';
        return fallbackStream;
      });
    }).then(function (openedStream) {
      stream = openedStream;
      watchTracks();
      return describe(openedStream.__tpWarning || '');
    });
  }

  function describe(warning) {
    var info = {
      stream: stream,
      micLabel: 'Unbekannt',
      resolution: '',
      warning: warning || ''
    };
    if (!stream) return info;

    var audioTracks = stream.getAudioTracks();
    if (audioTracks.length) {
      info.micLabel = audioTracks[0].label || 'Mikrofon';
    } else {
      info.micLabel = 'Kein Mikrofon';
      info.warning = info.warning || 'Es wurde kein Mikrofon gefunden – die Aufnahme hätte keinen Ton.';
    }

    var videoTracks = stream.getVideoTracks();
    if (videoTracks.length && videoTracks[0].getSettings) {
      var vs = videoTracks[0].getSettings();
      if (vs.width && vs.height) info.resolution = vs.width + '×' + vs.height;
    }
    return info;
  }

  /** Erkennt, wenn Kamera oder Mikrofon wegbrechen (Anruf, Geraet abgezogen). */
  function watchTracks() {
    clearWatchers();
    if (!stream) return;
    stream.getTracks().forEach(function (track) {
      var onEnded = function () {
        if (handlers.onStreamLost) handlers.onStreamLost(track.kind);
      };
      track.addEventListener('ended', onEnded);
      trackWatchers.push({ track: track, onEnded: onEnded });
    });
  }

  function clearWatchers() {
    trackWatchers.forEach(function (w) {
      try { w.track.removeEventListener('ended', w.onEnded); } catch (err) { /* ignorieren */ }
    });
    trackWatchers = [];
  }

  function close() {
    stopRecordingSilently();
    clearWatchers();
    if (stream) {
      stream.getTracks().forEach(function (t) {
        try { t.stop(); } catch (err) { /* ignorieren */ }
      });
      stream = null;
    }
  }

  function getStream() { return stream; }
  function hasStream() { return !!stream; }

  /* ---------- Aufnahme ---------- */

  function isRecording() {
    return !!recorder && recorder.state === 'recording';
  }

  function hasPendingData() {
    return chunks.length > 0;
  }

  /**
   * Startet die Aufnahme. Gibt das verwendete Format zurueck.
   * Wirft einen Fehler, wenn kein Stream offen ist oder kein Format passt.
   */
  function startRecording() {
    if (!stream) throw new Error('Kamera ist nicht geöffnet.');
    if (isRecording()) return { mimeType: activeMime, formatName: shortFormatName(activeMime) };

    var mime = pickMimeType();
    var options = {
      videoBitsPerSecond: 10000000,   // ca. 10 Mbit/s – gut fuer 1080p
      audioBitsPerSecond: 128000
    };
    if (mime) options.mimeType = mime;

    chunks = [];
    try {
      recorder = new window.MediaRecorder(stream, options);
    } catch (err) {
      // Letzter Versuch ohne Formatvorgabe
      recorder = new window.MediaRecorder(stream);
      mime = recorder.mimeType || '';
    }

    activeMime = recorder.mimeType || mime || '';

    recorder.ondataavailable = function (event) {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = function (event) {
      if (handlers.onError) {
        handlers.onError(event && event.error ? event.error : new Error('Unbekannter Aufnahmefehler'));
      }
    };

    // Haeppchenweise aufnehmen: lange Aufnahmen scheitern so nicht an einem Riesen-Block
    recorder.start(1000);
    startedAt = Date.now();

    return { mimeType: activeMime, formatName: shortFormatName(activeMime) };
  }

  /** Beendet die Aufnahme und liefert die Datei. */
  function stopRecording() {
    return new Promise(function (resolve) {
      if (!recorder) {
        resolve(buildResult());
        return;
      }
      if (recorder.state === 'inactive') {
        recorder = null;
        resolve(buildResult());
        return;
      }
      recorder.onstop = function () {
        recorder = null;
        resolve(buildResult());
      };
      try {
        recorder.stop();
      } catch (err) {
        recorder = null;
        resolve(buildResult());
      }
    });
  }

  /** Beendet die Aufnahme ohne auf Daten zu warten (beim Aufraeumen). */
  function stopRecordingSilently() {
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch (err) { /* ignorieren */ }
    }
    recorder = null;
  }

  function buildResult() {
    if (!chunks.length) {
      return { blob: null, mimeType: activeMime, seconds: 0, sizeMb: 0 };
    }
    var type = activeMime || 'video/webm';
    var blob = new Blob(chunks, { type: type });
    var seconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    chunks = [];
    startedAt = 0;
    return {
      blob: blob,
      mimeType: type,
      extension: extensionFor(type),
      formatName: shortFormatName(type),
      seconds: seconds,
      sizeMb: Math.round((blob.size / 1048576) * 10) / 10
    };
  }

  /** Rettet bereits aufgenommene Daten, wenn der Stream abgebrochen ist. */
  function rescue() {
    stopRecordingSilently();
    return buildResult();
  }

  function elapsedSeconds() {
    if (!startedAt) return 0;
    return Math.floor((Date.now() - startedAt) / 1000);
  }

  /* ---------- Speichern ---------- */

  function buildFileName(extension, title) {
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
                '_' + pad(now.getHours()) + pad(now.getMinutes());
    var slug = (title || 'teleprompter')
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'teleprompter';
    return stamp + '_' + slug + '.' + (extension || 'webm');
  }

  /** Loest den Download der Videodatei aus. Gibt den Dateinamen zurueck. */
  function saveBlob(blob, extension, title) {
    var fileName = buildFileName(extension, title);
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
    return fileName;
  }

  function setHandlers(next) {
    handlers = next || {};
  }

  /* ---------- Fehlermeldungen in Klartext ---------- */

  function explainError(err) {
    var name = err && err.name ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'Der Zugriff auf Kamera oder Mikrofon wurde abgelehnt. Tippe in Chrome auf das Schloss-Symbol links in der Adresszeile und erlaube Kamera und Mikrofon. In der installierten App findest du das unter „App-Info“ → „Berechtigungen“.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return 'Es wurde keine passende Kamera oder kein Mikrofon gefunden. Prüfe, ob dein Mikrofon-Empfänger angesteckt ist.';
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      return 'Kamera oder Mikrofon werden gerade von einer anderen App benutzt. Schließe andere Kamera-Apps und versuche es erneut.';
    }
    if (name === 'TypeError') {
      return 'Kamera-Zugriff ist nur über eine sichere Verbindung (https) möglich.';
    }
    return 'Kamera oder Mikrofon konnten nicht gestartet werden' + (name ? ' (' + name + ')' : '') + '.';
  }

  return {
    isSupported: isSupported,
    pickMimeType: pickMimeType,
    shortFormatName: shortFormatName,
    listMicrophones: listMicrophones,
    requestPermissionForLabels: requestPermissionForLabels,
    open: open,
    close: close,
    getStream: getStream,
    hasStream: hasStream,
    startRecording: startRecording,
    stopRecording: stopRecording,
    rescue: rescue,
    isRecording: isRecording,
    hasPendingData: hasPendingData,
    elapsedSeconds: elapsedSeconds,
    saveBlob: saveBlob,
    setHandlers: setHandlers,
    explainError: explainError
  };
})();
