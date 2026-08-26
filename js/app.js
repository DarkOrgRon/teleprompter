/* ============================================================
   app.js – Bedienung, Prompter-Motor, Aufnahmesteuerung
   ============================================================ */

(function () {
  'use strict';

  var APP_VERSION = '1.0.0';

  /* ---------- Elemente ---------- */

  function $(id) { return document.getElementById(id); }

  var el = {
    screens: {
      list: $('screen-list'),
      editor: $('screen-editor'),
      settings: $('screen-settings'),
      prompter: $('screen-prompter')
    },
    // Liste
    textList: $('textList'),
    listEmpty: $('listEmpty'),
    btnNewText: $('btnNewText'),
    btnOpenSettings: $('btnOpenSettings'),
    btnExport: $('btnExport'),
    btnImport: $('btnImport'),
    fileImport: $('fileImport'),
    // Editor
    btnEditorBack: $('btnEditorBack'),
    btnEditorSave: $('btnEditorSave'),
    editorHeadline: $('editorHeadline'),
    editorTitle: $('editorTitle'),
    editorBody: $('editorBody'),
    editorStats: $('editorStats'),
    // Einstellungen
    btnSettingsBack: $('btnSettingsBack'),
    settingsPreviewText: $('settingsPreviewText'),
    outWpm: $('outWpm'),
    setWpm: $('setWpm'),
    outFontSize: $('outFontSize'),
    setFontSize: $('setFontSize'),
    outLineHeight: $('outLineHeight'),
    setLineHeight: $('setLineHeight'),
    outMargin: $('outMargin'),
    setMargin: $('setMargin'),
    setTextColor: $('setTextColor'),
    setMarker: $('setMarker'),
    setMarkerPos: $('setMarkerPos'),
    setCountdown: $('setCountdown'),
    setOrientation: $('setOrientation'),
    setMirrorH: $('setMirrorH'),
    setMirrorV: $('setMirrorV'),
    setPreview: $('setPreview'),
    setPreviewSize: $('setPreviewSize'),
    setMic: $('setMic'),
    micHint: $('micHint'),
    btnScanMics: $('btnScanMics'),
    setAudioFilters: $('setAudioFilters'),
    aboutText: $('aboutText'),
    btnResetSettings: $('btnResetSettings'),
    // Prompter
    viewport: $('promptViewport'),
    scroller: $('promptScroller'),
    promptBody: $('promptBody'),
    marker: $('promptMarker'),
    selfview: $('selfview'),
    recDot: $('recDot'),
    recTimer: $('recTimer'),
    micLabel: $('micLabel'),
    controls: $('promptControls'),
    btnPrompterBack: $('btnPrompterBack'),
    btnRestart: $('btnRestart'),
    btnSlower: $('btnSlower'),
    btnFaster: $('btnFaster'),
    outSpeedLive: $('outSpeedLive'),
    btnRecStart: $('btnRecStart'),
    btnPlayOnly: $('btnPlayOnly'),
    btnRecStop: $('btnRecStop'),
    countdown: $('countdown'),
    countdownNumber: $('countdownNumber'),
    notice: $('promptNotice'),
    // Dialog / Toast
    confirmLayer: $('confirmLayer'),
    confirmTitle: $('confirmTitle'),
    confirmText: $('confirmText'),
    btnConfirmYes: $('btnConfirmYes'),
    btnConfirmNo: $('btnConfirmNo'),
    toast: $('toast')
  };

  /* ---------- Zustand ---------- */

  var settings = TPStore.loadSettings();
  var editingId = null;
  var currentText = null;

  var scroll = {
    running: false,
    y: 0,
    distance: 0,
    pxPerSecond: 0,
    lastFrame: 0,
    raf: 0,
    finished: false
  };

  var cameraState = 'starting'; // starting | ready | failed
  var wakeLock = null;
  var timerHandle = 0;
  var fadeHandle = 0;
  var toastHandle = 0;
  var longRecordWarned = false;
  var countdownAbort = false;

  /* ============================================================
     Kleine Helfer: Toast und Bestaetigungsdialog
     ============================================================ */

  function toast(message, ms) {
    el.toast.textContent = message;
    el.toast.classList.remove('is-hidden');
    window.clearTimeout(toastHandle);
    toastHandle = window.setTimeout(function () {
      el.toast.classList.add('is-hidden');
    }, ms || 4000);
  }

  var confirmResolver = null;

  function confirmDialog(title, text, confirmLabel) {
    el.confirmTitle.textContent = title;
    el.confirmText.textContent = text;
    el.btnConfirmYes.textContent = confirmLabel || 'Löschen';
    el.confirmLayer.classList.remove('is-hidden');
    return new Promise(function (resolve) {
      confirmResolver = resolve;
    });
  }

  function closeConfirm(answer) {
    el.confirmLayer.classList.add('is-hidden');
    if (confirmResolver) {
      var resolve = confirmResolver;
      confirmResolver = null;
      resolve(answer);
    }
  }

  el.btnConfirmYes.addEventListener('click', function () { closeConfirm(true); });
  el.btnConfirmNo.addEventListener('click', function () { closeConfirm(false); });
  el.confirmLayer.addEventListener('click', function (event) {
    if (event.target === el.confirmLayer) closeConfirm(false);
  });

  function showNotice(html) {
    el.notice.textContent = '';
    var lines = String(html).split('\n');
    lines.forEach(function (line, index) {
      if (index > 0) el.notice.appendChild(document.createElement('br'));
      el.notice.appendChild(document.createTextNode(line));
    });
    el.notice.classList.remove('is-hidden');
  }

  function hideNotice() {
    el.notice.classList.add('is-hidden');
  }

  /* ============================================================
     Bildschirmwechsel
     ============================================================ */

  function showScreen(name) {
    Object.keys(el.screens).forEach(function (key) {
      el.screens[key].classList.toggle('is-active', key === name);
    });
  }

  /* ============================================================
     Textliste
     ============================================================ */

  function renderList() {
    var texts = TPStore.sortByDateDesc(TPStore.loadTexts());
    el.textList.textContent = '';
    el.listEmpty.classList.toggle('is-hidden', texts.length > 0);

    texts.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'textitem';

      var main = document.createElement('button');
      main.type = 'button';
      main.className = 'textitem__main';

      var title = document.createElement('p');
      title.className = 'textitem__title';
      title.textContent = item.title;

      var meta = document.createElement('p');
      meta.className = 'textitem__meta';
      var words = TPStore.countWords(item.body);
      var seconds = TPStore.estimateSeconds(item.body, settings.wpm);
      meta.textContent = words + ' Wörter · ca. ' + TPStore.formatDuration(seconds) +
                         ' Sprechzeit · ' + TPStore.formatDate(item.updatedAt);

      main.appendChild(title);
      main.appendChild(meta);
      main.addEventListener('click', function () { openPrompter(item.id); });

      var actions = document.createElement('div');
      actions.className = 'textitem__actions';

      actions.appendChild(makeAction('Bearbeiten', function () { openEditor(item.id); }));
      actions.appendChild(makeAction('Duplizieren', function () {
        if (TPStore.duplicateText(item.id)) {
          renderList();
          toast('Kopie angelegt.');
        }
      }));
      actions.appendChild(makeAction('Löschen', function () {
        confirmDialog('Text löschen?', '„' + item.title + '“ wird endgültig von diesem Gerät entfernt.', 'Löschen')
          .then(function (yes) {
            if (!yes) return;
            TPStore.deleteText(item.id);
            renderList();
            toast('Text gelöscht.');
          });
      }));

      li.appendChild(main);
      li.appendChild(actions);
      el.textList.appendChild(li);
    });
  }

  function makeAction(label, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--ghost';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  /* ============================================================
     Editor
     ============================================================ */

  function openEditor(id) {
    editingId = id || null;
    var record = id ? TPStore.getText(id) : null;
    el.editorHeadline.textContent = record ? 'Text bearbeiten' : 'Neuer Text';
    el.editorTitle.value = record ? record.title : '';
    el.editorBody.value = record ? record.body : '';
    updateEditorStats();
    showScreen('editor');
    if (!record) window.setTimeout(function () { el.editorTitle.focus(); }, 120);
  }

  function updateEditorStats() {
    var words = TPStore.countWords(el.editorBody.value);
    var seconds = TPStore.estimateSeconds(el.editorBody.value, settings.wpm);
    el.editorStats.textContent = words + ' Wörter · ca. ' + TPStore.formatDuration(seconds) +
                                 ' Sprechzeit bei ' + settings.wpm + ' Wörtern/Min';
  }

  function saveEditor() {
    var body = el.editorBody.value;
    var title = el.editorTitle.value;

    if (!body.trim() && !title.trim()) {
      toast('Bitte gib einen Titel oder einen Text ein.');
      return;
    }

    var record = TPStore.upsertText({ id: editingId, title: title, body: body });
    if (!record) {
      toast('Speichern fehlgeschlagen – der Gerätespeicher ist möglicherweise voll.', 6000);
      return;
    }
    editingId = null;
    renderList();
    showScreen('list');
    toast('Gespeichert.');
  }

  el.btnNewText.addEventListener('click', function () { openEditor(null); });
  el.btnEditorSave.addEventListener('click', saveEditor);
  el.btnEditorBack.addEventListener('click', function () {
    editingId = null;
    showScreen('list');
  });
  el.editorBody.addEventListener('input', updateEditorStats);

  /* ============================================================
     Export / Import
     ============================================================ */

  el.btnExport.addEventListener('click', function () {
    var payload = TPStore.exportPayload();
    if (!payload.texts.length) {
      toast('Es gibt noch keine Texte zum Exportieren.');
      return;
    }
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    link.href = url;
    link.download = 'teleprompter-texte_' + now.getFullYear() + '-' +
                    pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toast(payload.texts.length + ' Texte exportiert. Die Datei liegt in deinen Downloads.', 5000);
  });

  el.btnImport.addEventListener('click', function () { el.fileImport.click(); });

  el.fileImport.addEventListener('change', function () {
    var file = el.fileImport.files && el.fileImport.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var raw = String(reader.result || '');
      var isJson = /\.json$/i.test(file.name) || raw.trim().charAt(0) === '{';
      var count = isJson ? TPStore.importPayload(raw) : TPStore.importPlainText(raw, file.name);
      if (count < 0) {
        toast('Die Datei konnte nicht gelesen werden. Erwartet wird eine Export-Datei dieser App oder eine .txt-Datei.', 6000);
      } else if (count === 0) {
        toast('In der Datei war kein Text enthalten.');
      } else {
        renderList();
        toast(count === 1 ? '1 Text importiert.' : count + ' Texte importiert.');
      }
      el.fileImport.value = '';
    };
    reader.onerror = function () {
      toast('Die Datei konnte nicht gelesen werden.');
      el.fileImport.value = '';
    };
    reader.readAsText(file);
  });

  /* ============================================================
     Einstellungen
     ============================================================ */

  function applySettingsToForm() {
    el.setWpm.value = settings.wpm;
    el.setFontSize.value = settings.fontSize;
    el.setLineHeight.value = Math.round(settings.lineHeight * 10);
    el.setMargin.value = settings.margin;
    el.setTextColor.value = settings.textColor;
    el.setMarker.value = settings.marker;
    el.setMarkerPos.value = settings.markerPos;
    el.setCountdown.value = String(settings.countdown);
    el.setOrientation.value = settings.orientation;
    el.setMirrorH.checked = !!settings.mirrorH;
    el.setMirrorV.checked = !!settings.mirrorV;
    el.setPreview.checked = !!settings.preview;
    el.setPreviewSize.value = settings.previewSize;
    el.setAudioFilters.checked = !!settings.audioFilters;
    updateSettingsOutputs();
  }

  function updateSettingsOutputs() {
    el.outWpm.textContent = settings.wpm + ' Wörter/Min';
    el.outFontSize.textContent = settings.fontSize + ' px';
    el.outLineHeight.textContent = String(settings.lineHeight.toFixed(1)).replace('.', ',');
    el.outMargin.textContent = settings.margin + ' %';
  }

  function persistSettings() {
    if (!TPStore.saveSettings(settings)) {
      toast('Einstellungen konnten nicht gespeichert werden.');
    }
  }

  /** Setzt die Anzeigewerte als CSS-Variablen (wirkt auf Prompter und Vorschau). */
  function applyPromptStyles() {
    var root = document.documentElement.style;
    root.setProperty('--prompt-font-size', settings.fontSize + 'px');
    root.setProperty('--prompt-line-height', String(settings.lineHeight));
    root.setProperty('--prompt-margin', settings.margin + '%');
    root.setProperty('--prompt-color', settings.textColor);
    root.setProperty('--prompt-mirror-x', settings.mirrorH ? '-1' : '1');
    root.setProperty('--prompt-mirror-y', settings.mirrorV ? '-1' : '1');

    el.marker.className = 'marker' + (settings.marker === 'off' ? '' : ' marker--' + settings.marker);

    el.selfview.classList.toggle('is-hidden', !settings.preview);
    el.selfview.classList.toggle('selfview--medium', settings.previewSize === 'medium');
  }

  function onSettingChanged(applyLayout) {
    persistSettings();
    updateSettingsOutputs();
    applyPromptStyles();
    if (applyLayout && el.screens.prompter.classList.contains('is-active')) {
      layoutPrompter(true);
    }
  }

  el.setWpm.addEventListener('input', function () {
    settings.wpm = parseInt(el.setWpm.value, 10) || TPStore.DEFAULTS.wpm;
    onSettingChanged(false);
    recalcSpeed();
  });
  el.setFontSize.addEventListener('input', function () {
    settings.fontSize = parseInt(el.setFontSize.value, 10) || TPStore.DEFAULTS.fontSize;
    onSettingChanged(true);
  });
  el.setLineHeight.addEventListener('input', function () {
    settings.lineHeight = (parseInt(el.setLineHeight.value, 10) || 14) / 10;
    onSettingChanged(true);
  });
  el.setMargin.addEventListener('input', function () {
    settings.margin = parseInt(el.setMargin.value, 10);
    if (isNaN(settings.margin)) settings.margin = TPStore.DEFAULTS.margin;
    onSettingChanged(true);
  });
  el.setTextColor.addEventListener('change', function () {
    settings.textColor = el.setTextColor.value;
    onSettingChanged(false);
  });
  el.setMarker.addEventListener('change', function () {
    settings.marker = el.setMarker.value;
    onSettingChanged(false);
  });
  el.setMarkerPos.addEventListener('change', function () {
    settings.markerPos = el.setMarkerPos.value;
    onSettingChanged(true);
  });
  el.setCountdown.addEventListener('change', function () {
    settings.countdown = parseInt(el.setCountdown.value, 10) || 0;
    persistSettings();
  });
  el.setOrientation.addEventListener('change', function () {
    settings.orientation = el.setOrientation.value;
    persistSettings();
  });
  el.setMirrorH.addEventListener('change', function () {
    settings.mirrorH = el.setMirrorH.checked;
    onSettingChanged(false);
  });
  el.setMirrorV.addEventListener('change', function () {
    settings.mirrorV = el.setMirrorV.checked;
    onSettingChanged(false);
  });
  el.setPreview.addEventListener('change', function () {
    settings.preview = el.setPreview.checked;
    onSettingChanged(false);
  });
  el.setPreviewSize.addEventListener('change', function () {
    settings.previewSize = el.setPreviewSize.value;
    onSettingChanged(false);
  });
  el.setAudioFilters.addEventListener('change', function () {
    settings.audioFilters = el.setAudioFilters.checked;
    persistSettings();
    toast('Wirkt ab der nächsten Aufnahme.');
  });
  el.setMic.addEventListener('change', function () {
    settings.micId = el.setMic.value;
    persistSettings();
    toast('Wirkt ab der nächsten Aufnahme.');
  });

  el.btnResetSettings.addEventListener('click', function () {
    confirmDialog('Einstellungen zurücksetzen?',
                  'Alle Einstellungen werden auf die Standardwerte gesetzt. Deine Texte bleiben erhalten.',
                  'Zurücksetzen')
      .then(function (yes) {
        if (!yes) return;
        settings = TPStore.defaultSettings();
        persistSettings();
        applySettingsToForm();
        applyPromptStyles();
        renderList();
        toast('Einstellungen zurückgesetzt.');
      });
  });

  el.btnOpenSettings.addEventListener('click', function () {
    applySettingsToForm();
    showScreen('settings');
  });
  el.btnSettingsBack.addEventListener('click', function () {
    renderList();
    showScreen('list');
  });

  /* ---------- Mikrofonliste ---------- */

  function fillMicList(mics) {
    var previous = settings.micId;
    el.setMic.textContent = '';

    var standard = document.createElement('option');
    standard.value = '';
    standard.textContent = 'Systemstandard';
    el.setMic.appendChild(standard);

    mics.forEach(function (mic) {
      if (!mic.deviceId || mic.deviceId === 'default') return;
      var option = document.createElement('option');
      option.value = mic.deviceId;
      option.textContent = mic.label;
      el.setMic.appendChild(option);
    });

    // Vorherige Wahl wiederherstellen, sonst ein erkanntes USB-/Funkmikrofon vorschlagen
    var stillThere = Array.prototype.some.call(el.setMic.options, function (o) { return o.value === previous; });
    if (previous && stillThere) {
      el.setMic.value = previous;
    } else {
      var preferred = null;
      for (var i = 0; i < mics.length; i++) {
        if (mics[i].isUsb && mics[i].deviceId && mics[i].deviceId !== 'default') { preferred = mics[i]; break; }
      }
      if (preferred) {
        el.setMic.value = preferred.deviceId;
        settings.micId = preferred.deviceId;
        persistSettings();
        el.micHint.textContent = 'Erkannt und ausgewählt: ' + preferred.label +
                                 '. Vor jeder Aufnahme wird oben im Prompter angezeigt, welches Mikrofon wirklich benutzt wird.';
        return;
      }
      el.setMic.value = '';
      settings.micId = '';
      persistSettings();
    }
    el.micHint.textContent = mics.length
      ? mics.length + ' Mikrofon(e) gefunden. Vor jeder Aufnahme wird oben im Prompter angezeigt, welches Mikrofon wirklich benutzt wird.'
      : 'Es wurde kein Mikrofon gefunden.';
  }

  el.btnScanMics.addEventListener('click', function () {
    if (!TPRecorder.isSupported()) {
      toast('Dieser Browser unterstützt keine Aufnahme.');
      return;
    }
    el.micHint.textContent = 'Suche läuft …';
    TPRecorder.requestPermissionForLabels()
      .then(TPRecorder.listMicrophones)
      .then(fillMicList)
      .catch(function (err) {
        el.micHint.textContent = TPRecorder.explainError(err);
      });
  });

  /* ============================================================
     Prompter – Layout und Scrollmotor
     ============================================================ */

  function markerOffsetPx() {
    var height = el.viewport.clientHeight || window.innerHeight;
    var factor = settings.markerPos === 'center' ? 0.5 : 0.22;
    return Math.round(height * factor);
  }

  /**
   * Berechnet Padding, Scrollstrecke und Geschwindigkeit neu.
   * keepPosition: aktuelle Position beibehalten (bei Einstellungsaenderung).
   */
  function layoutPrompter(keepPosition) {
    var padTop = markerOffsetPx();
    document.documentElement.style.setProperty('--prompt-pad-top', padTop + 'px');

    // Layout erst nach dem Setzen der Variablen messen
    scroll.distance = Math.max(1, el.promptBody.offsetHeight);
    recalcSpeed();

    if (!keepPosition) {
      scroll.y = 0;
      scroll.finished = false;
    } else if (scroll.y > scroll.distance) {
      scroll.y = scroll.distance;
    }
    applyScroll();
  }

  function recalcSpeed() {
    var words = currentText ? TPStore.countWords(currentText.body) : 0;
    var seconds = Math.max(1, (words / Math.max(20, settings.wpm)) * 60);
    scroll.pxPerSecond = scroll.distance / seconds;
    el.outSpeedLive.textContent = String(settings.wpm);
  }

  function applyScroll() {
    document.documentElement.style.setProperty('--prompt-scroll', Math.round(scroll.y * 10) / 10 + 'px');
  }

  function frame(timestamp) {
    if (!scroll.running) return;
    if (!scroll.lastFrame) scroll.lastFrame = timestamp;
    var delta = (timestamp - scroll.lastFrame) / 1000;
    scroll.lastFrame = timestamp;

    // Sprünge nach Hintergrundwechsel begrenzen
    if (delta > 0.25) delta = 0.25;

    scroll.y += scroll.pxPerSecond * delta;

    if (scroll.y >= scroll.distance) {
      scroll.y = scroll.distance;
      applyScroll();
      pauseScroll();
      scroll.finished = true;
      showNotice(TPRecorder.isRecording()
        ? 'Ende des Textes erreicht.\nDie Aufnahme läuft weiter – tippe unten auf „Stopp & speichern“.'
        : 'Ende des Textes erreicht.\nTippe auf ⤒, um zum Anfang zurückzuspringen.');
      showControls();
      return;
    }

    applyScroll();
    scroll.raf = window.requestAnimationFrame(frame);
  }

  function playScroll() {
    if (scroll.running) return;
    if (scroll.finished) restartScroll();
    hideNotice();
    scroll.running = true;
    scroll.lastFrame = 0;
    scroll.raf = window.requestAnimationFrame(frame);
    requestWakeLock();
    scheduleFade();
  }

  function pauseScroll() {
    scroll.running = false;
    if (scroll.raf) {
      window.cancelAnimationFrame(scroll.raf);
      scroll.raf = 0;
    }
    showControls();
  }

  function restartScroll() {
    scroll.y = 0;
    scroll.finished = false;
    applyScroll();
    hideNotice();
  }

  /* ---------- Bedienelemente ein-/ausblenden ---------- */

  function showControls() {
    el.controls.classList.remove('is-faded');
    window.clearTimeout(fadeHandle);
  }

  function scheduleFade() {
    window.clearTimeout(fadeHandle);
    fadeHandle = window.setTimeout(function () {
      if (scroll.running) el.controls.classList.add('is-faded');
    }, 3000);
  }

  /* ---------- Wake Lock, Vollbild, Ausrichtung ---------- */

  function requestWakeLock() {
    if (wakeLock || !('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () {
      wakeLock = null;
    });
  }

  function releaseWakeLock() {
    if (!wakeLock) return;
    try { wakeLock.release(); } catch (err) { /* ignorieren */ }
    wakeLock = null;
  }

  function enterImmersive() {
    var root = document.documentElement;
    // Vollbild ist nur direkt nach einer Nutzerberuehrung erlaubt
    var mayGoFullscreen = !navigator.userActivation || navigator.userActivation.isActive;
    if (root.requestFullscreen && mayGoFullscreen) {
      root.requestFullscreen({ navigationUI: 'hide' }).catch(function () { /* nicht kritisch */ });
    }
    if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
      try {
        var promise = window.screen.orientation.lock(settings.orientation);
        if (promise && promise.catch) promise.catch(function () { /* nicht kritisch */ });
      } catch (err) { /* nicht kritisch */ }
    }
  }

  function leaveImmersive() {
    if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
      try { window.screen.orientation.unlock(); } catch (err) { /* ignorieren */ }
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () { /* ignorieren */ });
    }
  }

  /* ============================================================
     Prompter oeffnen und verlassen
     ============================================================ */

  function openPrompter(id) {
    var record = TPStore.getText(id);
    if (!record) {
      toast('Dieser Text wurde nicht gefunden.');
      renderList();
      return;
    }
    currentText = record;

    el.promptBody.textContent = record.body || '';
    hideNotice();
    applyPromptStyles();
    cameraState = 'starting';
    setRecordingUi(false);
    el.recTimer.textContent = '00:00';
    longRecordWarned = false;
    showControls();
    showScreen('prompter');
    enterImmersive();

    // Layout messen, nachdem der Bildschirm sichtbar ist
    window.requestAnimationFrame(function () {
      layoutPrompter(false);
    });

    if (!record.body || !record.body.trim()) {
      showNotice('Dieser Text ist noch leer.\nGehe zurück und füge über „Bearbeiten“ deinen Sprechertext ein.');
    }

    openCamera();
  }

  function openCamera() {
    if (!TPRecorder.isSupported()) {
      cameraState = 'failed';
      setRecordingUi(false);
      el.micLabel.textContent = '🎤 Aufnahme nicht möglich';
      showNotice('Dieser Browser unterstützt keine Videoaufnahme.\nDer Prompter funktioniert trotzdem – tippe auf „Nur Prompter“.');
      return;
    }

    el.micLabel.textContent = '🎤 Kamera wird gestartet …';

    TPRecorder.setHandlers({
      onStreamLost: handleStreamLost,
      onError: function (err) {
        toast('Aufnahmefehler: ' + (err && err.message ? err.message : 'unbekannt'), 6000);
      }
    });

    TPRecorder.open(settings).then(function (info) {
      if (settings.preview && el.selfview) {
        el.selfview.srcObject = info.stream;
      }
      var format = TPRecorder.shortFormatName(TPRecorder.pickMimeType());
      el.micLabel.textContent = '🎤 ' + info.micLabel +
                                (info.resolution ? ' · ' + info.resolution : '') +
                                ' · ' + format;

      // Erst jetzt ist die Kamera bereit – Aufnahme-Knopf freischalten
      cameraState = 'ready';
      setRecordingUi(false);

      if (info.warning) toast(info.warning, 6000);
    }).catch(function (err) {
      cameraState = 'failed';
      setRecordingUi(false);
      el.micLabel.textContent = '🎤 kein Zugriff';
      showNotice(TPRecorder.explainError(err) + '\n\nDer Prompter funktioniert auch ohne Kamera – tippe auf „Nur Prompter“.');
    });
  }

  function handleStreamLost(kind) {
    var wasRecording = TPRecorder.isRecording() || TPRecorder.hasPendingData();
    if (wasRecording) {
      var result = TPRecorder.rescue();
      stopTimer();
      setRecordingUi(false);
      if (result.blob && result.blob.size > 0) {
        var name = TPRecorder.saveBlob(result.blob, result.extension, currentText ? currentText.title : '');
        showNotice('Die Aufnahme wurde unterbrochen (' + (kind === 'audio' ? 'Mikrofon' : 'Kamera') + ').\n' +
                   'Das bereits Aufgenommene wurde gesichert: ' + name);
      } else {
        showNotice('Die Aufnahme wurde unterbrochen und es konnten keine Daten gesichert werden.');
      }
    }
    pauseScroll();
    cameraState = 'failed';
    setRecordingUi(false);
    el.micLabel.textContent = '🎤 Verbindung verloren';
  }

  function leavePrompter() {
    var finish = Promise.resolve();

    if (TPRecorder.isRecording()) {
      finish = stopRecordingAndSave(true);
    }

    finish.then(function () {
      pauseScroll();
      stopTimer();
      releaseWakeLock();
      leaveImmersive();
      TPRecorder.close();
      if (el.selfview) el.selfview.srcObject = null;
      currentText = null;
      hideNotice();
      renderList();
      showScreen('list');
    });
  }

  /* ============================================================
     Aufnahme
     ============================================================ */

  /**
   * Zeigt den Aufnahmebereich passend zum Zustand.
   * Der Aufnahme-Knopf bleibt immer sichtbar und zeigt selbst an, ob die
   * Kamera bereit ist – ein versteckter Knopf laesst den Nutzer sonst
   * vergeblich suchen.
   */
  function setRecordingUi(active) {
    el.recDot.classList.toggle('is-hidden', !active);
    el.recTimer.classList.toggle('is-hidden', !active);
    el.btnRecStop.classList.toggle('is-hidden', !active);
    el.btnRecStart.classList.toggle('is-hidden', active);
    el.btnPlayOnly.classList.toggle('is-hidden', active);

    if (active) return;

    if (cameraState === 'ready') {
      el.btnRecStart.disabled = false;
      el.btnRecStart.textContent = '● Aufnahme + Prompter';
    } else if (cameraState === 'starting') {
      el.btnRecStart.disabled = true;
      el.btnRecStart.textContent = '● Kamera wird gestartet …';
    } else {
      el.btnRecStart.disabled = true;
      el.btnRecStart.textContent = '● Aufnahme nicht möglich';
    }
  }

  function startTimer() {
    stopTimer();
    timerHandle = window.setInterval(function () {
      var seconds = TPRecorder.elapsedSeconds();
      el.recTimer.textContent = TPStore.formatDuration(seconds);
      if (!longRecordWarned && seconds >= 900) {
        longRecordWarned = true;
        toast('Die Aufnahme läuft seit 15 Minuten. Achte auf den freien Speicher deines Geräts.', 7000);
      }
    }, 500);
  }

  function stopTimer() {
    if (timerHandle) {
      window.clearInterval(timerHandle);
      timerHandle = 0;
    }
  }

  function runCountdown() {
    var seconds = parseInt(settings.countdown, 10) || 0;
    countdownAbort = false;
    if (seconds <= 0) return Promise.resolve(true);

    el.countdown.classList.remove('is-hidden');
    return new Promise(function (resolve) {
      var remaining = seconds;
      el.countdownNumber.textContent = String(remaining);

      var tick = window.setInterval(function () {
        if (countdownAbort) {
          window.clearInterval(tick);
          el.countdown.classList.add('is-hidden');
          resolve(false);
          return;
        }
        remaining -= 1;
        if (remaining <= 0) {
          window.clearInterval(tick);
          el.countdown.classList.add('is-hidden');
          resolve(true);
        } else {
          el.countdownNumber.textContent = String(remaining);
        }
      }, 1000);
    });
  }

  function startRecordingFlow() {
    if (!TPRecorder.hasStream()) {
      toast('Die Kamera ist nicht bereit.');
      return;
    }
    hideNotice();
    restartScroll();

    runCountdown().then(function (proceed) {
      if (!proceed) return;
      try {
        var info = TPRecorder.startRecording();
        setRecordingUi(true);
        startTimer();
        playScroll();
        toast('Aufnahme läuft · Format ' + info.formatName, 2500);
      } catch (err) {
        toast('Die Aufnahme konnte nicht gestartet werden: ' + (err.message || 'unbekannt'), 6000);
      }
    });
  }

  function stopRecordingAndSave(silent) {
    return TPRecorder.stopRecording().then(function (result) {
      stopTimer();
      setRecordingUi(false);
      pauseScroll();

      if (!result.blob || result.blob.size === 0) {
        if (!silent) toast('Es wurden keine Videodaten aufgenommen.', 5000);
        return;
      }
      var name = TPRecorder.saveBlob(result.blob, result.extension, currentText ? currentText.title : '');
      var message = 'Aufnahme gespeichert: ' + name + '\n' +
                    'Länge ' + TPStore.formatDuration(result.seconds) +
                    ' · ' + result.sizeMb + ' MB · ' + result.formatName + '\n' +
                    'Die Datei liegt im Ordner „Downloads“ deines Geräts.';
      if (silent) {
        toast('Aufnahme gesichert: ' + name, 6000);
      } else {
        showNotice(message);
        showControls();
      }
    }).catch(function (err) {
      toast('Beim Speichern ist ein Fehler aufgetreten: ' + (err.message || 'unbekannt'), 6000);
    });
  }

  /* ---------- Bedienelemente im Prompter ---------- */

  el.btnRecStart.addEventListener('click', function (event) {
    event.stopPropagation();
    startRecordingFlow();
  });

  el.btnPlayOnly.addEventListener('click', function (event) {
    event.stopPropagation();
    hideNotice();
    restartScroll();
    runCountdown().then(function (proceed) {
      if (proceed) playScroll();
    });
  });

  el.btnRecStop.addEventListener('click', function (event) {
    event.stopPropagation();
    stopRecordingAndSave(false);
  });

  el.btnRestart.addEventListener('click', function (event) {
    event.stopPropagation();
    restartScroll();
    showControls();
    if (scroll.running) scheduleFade();
  });

  el.btnPrompterBack.addEventListener('click', function (event) {
    event.stopPropagation();
    countdownAbort = true;
    el.countdown.classList.add('is-hidden');
    leavePrompter();
  });

  function changeSpeed(delta) {
    var next = (parseInt(settings.wpm, 10) || TPStore.DEFAULTS.wpm) + delta;
    next = Math.min(240, Math.max(60, next));
    settings.wpm = next;
    persistSettings();
    updateSettingsOutputs();
    el.setWpm.value = next;
    recalcSpeed();
    showControls();
    if (scroll.running) scheduleFade();
  }

  el.btnFaster.addEventListener('click', function (event) {
    event.stopPropagation();
    changeSpeed(5);
  });
  el.btnSlower.addEventListener('click', function (event) {
    event.stopPropagation();
    changeSpeed(-5);
  });

  /** Tipp auf die Textfläche: Start/Pause und Bedienelemente einblenden. */
  el.viewport.addEventListener('click', function () {
    if (scroll.running) {
      pauseScroll();
    } else {
      playScroll();
    }
  });

  /* ---------- Tastatur / Bluetooth-Fernbedienung ---------- */

  document.addEventListener('keydown', function (event) {
    if (!el.screens.prompter.classList.contains('is-active')) return;
    var tag = (event.target && event.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    switch (event.key) {
      case ' ':
      case 'Spacebar':
      case 'Enter':
      case 'MediaPlayPause':
        event.preventDefault();
        if (scroll.running) { pauseScroll(); } else { playScroll(); }
        break;
      case 'ArrowUp':
      case 'PageUp':
        event.preventDefault();
        changeSpeed(5);
        break;
      case 'ArrowDown':
      case 'PageDown':
        event.preventDefault();
        changeSpeed(-5);
        break;
      case 'Home':
        event.preventDefault();
        restartScroll();
        break;
      case 'Escape':
        event.preventDefault();
        leavePrompter();
        break;
      default:
        break;
    }
  });

  /* ---------- Fenstergroesse / Ausrichtung ---------- */

  var resizeHandle = 0;
  window.addEventListener('resize', function () {
    if (!el.screens.prompter.classList.contains('is-active')) return;
    window.clearTimeout(resizeHandle);
    resizeHandle = window.setTimeout(function () {
      layoutPrompter(true);
    }, 150);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' &&
        el.screens.prompter.classList.contains('is-active') &&
        scroll.running) {
      requestWakeLock();
    }
  });

  /* ============================================================
     Start
     ============================================================ */

  function updateAbout() {
    var format = TPRecorder.isSupported() ? TPRecorder.shortFormatName(TPRecorder.pickMimeType()) : '–';
    el.aboutText.textContent = 'Teleprompter, Version ' + APP_VERSION + '. ' +
      'Aufnahmeformat auf diesem Gerät: ' + format + '. ' +
      'Diese App arbeitet vollständig offline: es werden keine Daten übertragen, ' +
      'und Texte, Einstellungen und Aufnahmen bleiben auf diesem Gerät.';
  }

  var reloadPending = false;

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // Offline-Betrieb ist dann nicht verfuegbar, die App laeuft trotzdem
      });
    });

    // Neue Fassung uebernimmt: App neu laden, damit das Update wirklich ankommt.
    // Waehrend einer Aufnahme oder im Prompter wird nicht neu geladen –
    // das wuerde eine laufende Aufnahme zerstoeren.
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloadPending) return;
      var busy = el.screens.prompter.classList.contains('is-active') || TPRecorder.isRecording();
      if (busy) {
        toast('Eine neue Fassung der App ist bereit. Sie wird beim nächsten Start aktiv.', 6000);
        return;
      }
      reloadPending = true;
      window.location.reload();
    });
  }

  function init() {
    applySettingsToForm();
    applyPromptStyles();
    renderList();
    updateAbout();
    registerServiceWorker();

    // Bereits erteilte Berechtigung nutzen, um Mikrofonnamen ohne Zusatzklick zu zeigen
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then(function (status) {
        if (status.state === 'granted') {
          TPRecorder.listMicrophones().then(function (mics) {
            if (mics.length) fillMicList(mics);
          });
        }
      }).catch(function () { /* nicht kritisch */ });
    }
  }

  init();
})();
