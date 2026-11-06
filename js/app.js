/* ============================================================
   app.js – Bedienung, Prompter-Motor, Aufnahmesteuerung
   ============================================================ */

(function () {
  'use strict';

  var APP_VERSION = '1.1.0';

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
    rescueBox: $('rescueBox'),
    rescueList: $('rescueList'),
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
    setPreviewMode: $('setPreviewMode'),
    setMirrorSelf: $('setMirrorSelf'),
    setCamDim: $('setCamDim'),
    outCamDim: $('outCamDim'),
    setTextArea: $('setTextArea'),
    setResumeDelay: $('setResumeDelay'),
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
    camDim: $('camDim'),
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
    btnPause: $('btnPause'),
    rewindRow: $('rewindRow'),
    btnBackPara: $('btnBackPara'),
    btnBackSentence: $('btnBackSentence'),
    btnBackLine: $('btnBackLine'),
    btnFwdLine: $('btnFwdLine'),
    countdown: $('countdown'),
    countdownNumber: $('countdownNumber'),
    miniCountdown: $('miniCountdown'),
    notice: $('promptNotice'),
    noticeText: $('noticeText'),
    noticeActions: $('noticeActions'),
    btnShare: $('btnShare'),
    btnNoticeClose: $('btnNoticeClose'),
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
    finished: false,
    started: false   // Text wurde seit dem Oeffnen mindestens einmal gestartet
  };

  var cameraState = 'starting'; // starting | ready | failed
  var wakeLock = null;
  var timerHandle = 0;
  var fadeHandle = 0;
  var toastHandle = 0;
  var longRecordWarned = false;
  var countdownAbort = false;
  var countdownRunning = false;
  var countdownToken = 0;     // jeder Countdown hat eine Nummer – alte Zaehler laufen ins Leere
  var stopInProgress = null;  // laufendes "Stopp & speichern" (gegen Doppeltipp)
  var lossHandled = false;    // Stream-Abbruch nur einmal behandeln
  var leaving = false;        // Prompter wird gerade verlassen
  var prerollHandle = 0;      // Vorlauf beim Fortsetzen nach einer Pause
  var backupId = null;        // Kennung der laufenden Sicherungskopie
  var lastRecording = null;   // { blob, fileName, mimeType } fuer den Teilen-Knopf

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

  /** Zeigt einen Hinweis im Prompter. options.share: Teilen-Knopf anbieten. */
  function showNotice(text, options) {
    el.noticeText.textContent = '';
    var lines = String(text).split('\n');
    lines.forEach(function (line, index) {
      if (index > 0) el.noticeText.appendChild(document.createElement('br'));
      el.noticeText.appendChild(document.createTextNode(line));
    });
    var share = !!(options && options.share);
    el.btnShare.classList.toggle('is-hidden', !share);
    el.noticeActions.classList.remove('is-hidden');
    el.notice.classList.remove('is-hidden');
  }

  function hideNotice() {
    el.notice.classList.add('is-hidden');
  }

  el.btnNoticeClose.addEventListener('click', function (event) {
    event.stopPropagation();
    hideNotice();
  });

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
    el.setPreviewMode.value = settings.previewMode;
    el.setMirrorSelf.checked = !!settings.mirrorSelf;
    el.setCamDim.value = settings.camDim;
    el.setTextArea.value = settings.textArea;
    el.setResumeDelay.value = String(settings.resumeDelay);
    el.setAudioFilters.checked = !!settings.audioFilters;
    updateSettingsOutputs();
  }

  function updateSettingsOutputs() {
    el.outWpm.textContent = settings.wpm + ' Wörter/Min';
    el.outFontSize.textContent = settings.fontSize + ' px';
    el.outLineHeight.textContent = String(settings.lineHeight.toFixed(1)).replace('.', ',');
    el.outMargin.textContent = settings.margin + ' %';
    el.outCamDim.textContent = settings.camDim + ' %';
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

    root.setProperty('--cam-dim', String(Math.min(80, Math.max(0, settings.camDim)) / 100));

    var mode = settings.previewMode;
    el.screens.prompter.classList.toggle('screen--camfull', mode === 'full');
    el.screens.prompter.classList.toggle('screen--textTop', mode === 'full' && settings.textArea === 'top');
    el.selfview.classList.toggle('is-hidden', mode === 'off');
    el.selfview.classList.toggle('selfview--medium', mode === 'medium');
    el.selfview.classList.toggle('selfview--unmirrored', !settings.mirrorSelf);
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
  el.setPreviewMode.addEventListener('change', function () {
    settings.previewMode = el.setPreviewMode.value;
    onSettingChanged(true);
  });
  el.setMirrorSelf.addEventListener('change', function () {
    settings.mirrorSelf = el.setMirrorSelf.checked;
    onSettingChanged(false);
  });
  el.setCamDim.addEventListener('input', function () {
    settings.camDim = parseInt(el.setCamDim.value, 10) || 0;
    onSettingChanged(false);
  });
  el.setTextArea.addEventListener('change', function () {
    settings.textArea = el.setTextArea.value;
    onSettingChanged(true);
  });
  el.setResumeDelay.addEventListener('change', function () {
    settings.resumeDelay = parseInt(el.setResumeDelay.value, 10) || 0;
    persistSettings();
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
    var topArea = settings.previewMode === 'full' && settings.textArea === 'top';
    var factor = settings.markerPos === 'center' ? 0.5 : (topArea ? 0.3 : 0.22);
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
      updateTransportUi(); // Knopf zeigt jetzt "⤒ Von vorn"
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
    cancelPreroll();
    if (scroll.running) return;
    if (scroll.finished) restartScroll();
    hideNotice();
    scroll.running = true;
    scroll.started = true;
    scroll.lastFrame = 0;
    scroll.raf = window.requestAnimationFrame(frame);
    requestWakeLock();
    updateTransportUi();
    scheduleFade();
  }

  /** Haelt nur den Text an. Eine laufende Aufnahme laeuft bewusst weiter. */
  function pauseScroll() {
    cancelPreroll();
    scroll.running = false;
    if (scroll.raf) {
      window.cancelAnimationFrame(scroll.raf);
      scroll.raf = 0;
    }
    updateTransportUi();
    showControls();
  }

  function restartScroll() {
    scroll.y = 0;
    scroll.finished = false;
    applyScroll();
    hideNotice();
  }

  /* ---------- Fortsetzen mit kurzem Vorlauf ---------- */

  function cancelPreroll() {
    if (prerollHandle) {
      window.clearInterval(prerollHandle);
      prerollHandle = 0;
    }
    el.miniCountdown.classList.add('is-hidden');
  }

  function isPrerolling() { return !!prerollHandle; }

  /**
   * Weiter nach einer Pause: ein kleiner Zaehler oben rechts gibt Zeit, den
   * ersten Satz zu lesen und neu anzusetzen. Der Text bleibt dabei sichtbar.
   */
  function resumeWithPreroll() {
    if (scroll.running || isPrerolling()) return;
    var seconds = parseInt(settings.resumeDelay, 10) || 0;
    // Am Textende heisst "weiter": von vorn – ebenfalls mit Vorlauf
    if (scroll.finished) restartScroll();
    if (seconds <= 0) {
      playScroll();
      return;
    }
    hideNotice();
    var remaining = seconds;
    el.miniCountdown.textContent = String(remaining);
    el.miniCountdown.classList.remove('is-hidden');
    prerollHandle = window.setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        cancelPreroll();
        playScroll();
      } else {
        el.miniCountdown.textContent = String(remaining);
      }
    }, 1000);
    updateTransportUi();
  }

  /** Pause/Weiter – fuer Knopf, Tippen und Tastatur. */
  function togglePause() {
    if (countdownRunning) return;
    if (scroll.running) {
      pauseScroll();
    } else if (isPrerolling()) {
      cancelPreroll();
      updateTransportUi();
    } else if (!scroll.started) {
      playScroll();
    } else {
      resumeWithPreroll();
    }
  }

  /* ---------- Zurueckspringen ---------- */

  function lineHeightPx() {
    return Math.max(1, settings.fontSize * settings.lineHeight);
  }

  /** Oberkanten (in px ab Textbeginn) aller Saetze bzw. Absaetze. */
  function collectTops(selector) {
    var base = el.promptBody.offsetTop;
    var nodes = el.promptBody.querySelectorAll(selector);
    var tops = [];
    for (var i = 0; i < nodes.length; i++) {
      tops.push({ top: nodes[i].offsetTop - base, node: nodes[i] });
    }
    return tops;
  }

  function flash(node) {
    if (!node) return;
    node.classList.add('is-flash');
    window.setTimeout(function () { node.classList.remove('is-flash'); }, 450);
  }

  function jumpTo(y, node) {
    var target = Math.max(0, Math.min(scroll.distance, y));
    el.scroller.classList.add('is-jumping');
    window.clearTimeout(jumpTo.handle);
    jumpTo.handle = window.setTimeout(function () {
      el.scroller.classList.remove('is-jumping');
    }, 260);
    scroll.y = target;
    scroll.finished = false;
    applyScroll();
    hideNotice();
    flash(node);
    showControls();
  }

  /**
   * Springt zum Anfang des aktuellen Satzes bzw. Absatzes. Wer nochmals
   * tippt, landet beim vorherigen – so kann man mehrfach zurueckgehen.
   */
  function jumpBack(selector) {
    if (scroll.running) pauseScroll();
    cancelPreroll();
    var lh = lineHeightPx();
    var limit = scroll.y - lh * 0.5;
    var tops = collectTops(selector);
    var best = null;
    for (var i = 0; i < tops.length; i++) {
      // Auf Zeilenanfang einrasten, damit die Zeile genau an der Lesemarke steht
      // Runden statt Abschneiden: bei engem Zeilenabstand liegt die Oberkante
      // eines Satzes ein paar Pixel ueber der Zeile
      var snapped = Math.round(tops[i].top / lh) * lh;
      if (snapped < limit) best = { top: snapped, node: tops[i].node };
    }
    if (best) {
      jumpTo(best.top, best.node);
    } else {
      jumpTo(0, tops.length ? tops[0].node : null);
    }
    updateTransportUi();
  }

  function jumpLines(count) {
    if (scroll.running) pauseScroll();
    cancelPreroll();
    var lh = lineHeightPx();
    var current = Math.round(scroll.y / lh);
    jumpTo((current + count) * lh, null);
    updateTransportUi();
  }

  /**
   * Text fuer den Prompter aufbauen: jeder Satz in einem eigenen Element,
   * damit die Zurueck-Knoepfe Satz- und Absatzanfaenge finden. Der Text
   * selbst bleibt unveraendert (Zeilenumbrueche, Leerzeilen).
   */
  function renderPromptText(body) {
    el.promptBody.textContent = '';
    var text = String(body || '');
    if (!text) return;

    var starts = {};   // Index -> 'para' | 'sent'
    var len = text.length;

    function nextNonSpace(i) {
      while (i < len && /\s/.test(text.charAt(i))) i++;
      return i;
    }

    var first = nextNonSpace(0);
    if (first < len) starts[first] = 'para';

    // Absaetze: nach einer Leerzeile
    var paraRe = /\n[ \t]*\n/g;
    var m;
    while ((m = paraRe.exec(text)) !== null) {
      var p = nextNonSpace(m.index + m[0].length);
      if (p < len) starts[p] = 'para';
    }

    // Saetze: nach . ! ? … (ggf. mit schliessenden Anfuehrungszeichen) oder nach einem Zeilenumbruch
    var sentRe = /[.!?…]+["'»«“”„)\]]*\s+|\n+/g;
    while ((m = sentRe.exec(text)) !== null) {
      var q = nextNonSpace(m.index + m[0].length);
      if (q < len && !starts[q]) starts[q] = 'sent';
    }

    var indices = Object.keys(starts).map(Number).sort(function (a, b) { return a - b; });
    var frag = document.createDocumentFragment();
    if (indices[0] > 0) frag.appendChild(document.createTextNode(text.slice(0, indices[0])));
    for (var i = 0; i < indices.length; i++) {
      var span = document.createElement('span');
      span.className = starts[indices[i]] === 'para' ? 'tp-s tp-p' : 'tp-s';
      span.textContent = text.slice(indices[i], i + 1 < indices.length ? indices[i + 1] : len);
      frag.appendChild(span);
    }
    el.promptBody.appendChild(frag);
  }

  /* ---------- Bedienzeile passend zum Zustand ---------- */

  /**
   * Hauptzeile hat immer genau zwei Knoepfe nebeneinander (feste Plaetze):
   *  - vor dem Start / nach dem Speichern: Aufnahme + Prompter | Nur Prompter
   *  - waehrend der Aufnahme:              Pause/Weiter        | Stopp
   *  - Prompter ohne Aufnahme gestartet:   Pause/Weiter        | Aufnahme + Prompter
   */
  function updateTransportUi() {
    var recording = TPRecorder.isRecording();
    var showPause = recording || scroll.started;
    var stopped = !scroll.running && !isPrerolling();

    el.btnPause.classList.toggle('is-hidden', !showPause);
    el.btnPause.classList.toggle('is-paused', showPause && stopped);
    if (isPrerolling()) {
      el.btnPause.textContent = '✕ Vorlauf stoppen';
    } else if (scroll.running) {
      el.btnPause.textContent = '❚❚ Text anhalten';
    } else if (scroll.finished) {
      el.btnPause.textContent = '⤒ Von vorn';
    } else {
      el.btnPause.textContent = '▶ Weiter';
    }
    el.btnPlayOnly.classList.toggle('is-hidden', showPause);
    // Spruenge immer anbieten, wenn der Text steht und nicht am Anfang ist
    var canJump = stopped && countdownRunning === false && (scroll.started || scroll.y > 0);
    el.rewindRow.classList.toggle('is-hidden', !canJump);
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

  /* ---------- Tippen und Wischen auf dem Text / Kamerabild ---------- */

  var drag = null;
  var DRAG_THRESHOLD = 10; // px – darunter zaehlt es als Tippen

  function isControlTarget(target) {
    return !!(target && target.closest &&
              target.closest('.controls, .notice, .countdown, .statusbar, button'));
  }

  function onPointerDown(event) {
    if (!el.screens.prompter.classList.contains('is-active')) return;
    if (isControlTarget(event.target)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag = { id: event.pointerId, startY: event.clientY, lastY: event.clientY, moved: false, target: event.currentTarget };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (err) { /* ignorieren */ }
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(event.clientY - drag.startY) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      if (countdownRunning) return;
      if (scroll.running) pauseScroll();
      cancelPreroll();
      updateTransportUi();
      hideNotice();
    }
    if (countdownRunning) return;
    // Finger nach unten = Text nach unten = zurueck. Bei vertikaler Spiegelung umgekehrt.
    var direction = settings.mirrorV ? -1 : 1;
    var dy = (event.clientY - drag.lastY) * direction;
    drag.lastY = event.clientY;
    scroll.y = Math.max(0, Math.min(scroll.distance, scroll.y - dy));
    scroll.finished = false;
    applyScroll();
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    var wasDrag = drag.moved;
    drag = null;
    if (!wasDrag) {
      // Steht ein Hinweis (z. B. "Aufnahme gespeichert") offen, schliesst der
      // erste Tipp nur den Hinweis – sonst wuerde der Text ungewollt starten.
      if (!el.notice.classList.contains('is-hidden') && !scroll.running) {
        hideNotice();
        return;
      }
      togglePause();
    } else {
      // Nach dem Wischen auf einer Zeile einrasten
      var lh = lineHeightPx();
      scroll.y = Math.max(0, Math.min(scroll.distance, Math.round(scroll.y / lh) * lh));
      applyScroll();
      updateTransportUi();
      showControls();
    }
  }

  function onPointerCancel(event) {
    if (drag && event.pointerId === drag.id) drag = null;
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

  /**
   * Laeuft die App installiert (vom Startbildschirm) statt in einem Browser-Tab?
   * Alle App-Anzeigemodi zaehlen dazu – nur der Modus "browser" ist ein echter Tab.
   */
  function isStandalone() {
    if (window.navigator.standalone === true) return true;
    if (!window.matchMedia) return false;
    var modes = ['standalone', 'fullscreen', 'minimal-ui'];
    for (var i = 0; i < modes.length; i++) {
      if (window.matchMedia('(display-mode: ' + modes[i] + ')').matches) return true;
    }
    return false;
  }

  function enterImmersive() {
    var root = document.documentElement;
    // Vollbild ist nur direkt nach einer Nutzerberuehrung erlaubt
    var mayGoFullscreen = !navigator.userActivation || navigator.userActivation.isActive;

    // In der installierten App KEIN Vollbild anfordern: der Bildschirm ist dort
    // ohnehin frei, und Chrome legt bei jedem Wechsel in den Vollbildmodus einen
    // Systemhinweis ueber den unteren Bildschirmrand – genau dort, wo die
    // Aufnahme-Knoepfe sitzen. Im Browser-Tab bleibt Vollbild sinnvoll,
    // weil dort die Adresszeile Platz kostet.
    if (root.requestFullscreen && mayGoFullscreen && !isStandalone()) {
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

    renderPromptText(record.body || '');
    hideNotice();
    applyPromptStyles();
    scroll.started = false;
    scroll.running = false;
    lastRecording = null;
    cancelPreroll();
    cameraState = 'starting';
    setRecordingUi(false);
    el.recTimer.textContent = '00:00';
    longRecordWarned = false;
    updateTransportUi();
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
    lossHandled = false;

    TPRecorder.setHandlers({
      onStreamLost: handleStreamLost,
      onError: function (err) {
        toast('Aufnahmefehler: ' + (err && err.message ? err.message : 'unbekannt'), 6000);
      },
      onChunk: function (blob, seq) {
        if (backupId) TPBackup.addChunk(backupId, seq, blob);
      }
    });

    TPRecorder.open(settings).then(function (info) {
      // Leinwand immer verbinden – ob und wie das Bild erscheint, steuert die
      // Einstellung "Selbstbild" (so wirkt ein Wechsel ohne Neustart der Kamera).
      if (!el.screens.prompter.classList.contains('is-active')) {
        // Prompter wurde verlassen, waehrend die Kamera noch startete
        TPRecorder.close();
        return;
      }
      if (el.selfview) el.selfview.srcObject = info.stream;
      var format = TPRecorder.shortFormatName(TPRecorder.pickMimeType());
      el.micLabel.textContent = '🎤 ' + info.micLabel +
                                (info.resolution ? ' · ' + info.resolution : '') +
                                ' · ' + format;

      // Erst jetzt ist die Kamera bereit – Aufnahme-Knopf freischalten
      cameraState = 'ready';
      setRecordingUi(false);

      if (info.warning) toast(info.warning, 6000);
    }).catch(function (err) {
      if (err && err.name === 'StaleOpenError') return; // Prompter wurde inzwischen verlassen
      cameraState = 'failed';
      setRecordingUi(false);
      el.micLabel.textContent = '🎤 kein Zugriff';
      showNotice(TPRecorder.explainError(err) + '\n\nDer Prompter funktioniert auch ohne Kamera – tippe auf „Nur Prompter“.');
    });
  }

  function handleStreamLost(kind) {
    // Fallen Kamera und Mikrofon kurz nacheinander weg, kommt das Ereignis
    // zweimal – behandelt wird es nur einmal (sonst entstuende eine zweite Teildatei).
    if (lossHandled) return;
    lossHandled = true;

    pauseScroll();
    cameraState = 'failed';
    el.micLabel.textContent = '🎤 Verbindung verloren';

    var wasRecording = TPRecorder.isRecording() || TPRecorder.hasPendingData() || !!stopInProgress;
    if (!wasRecording) {
      setRecordingUi(false);
      return;
    }
    // Laeuft bereits ein regulaerer Stopp, uebernimmt der das Speichern samt Hinweis
    if (stopInProgress) return;
    var title = currentText ? currentText.title : '';
    TPRecorder.stopRecording().then(function (result) {
      stopTimer();
      setRecordingUi(false);
      if (result && result.blob && result.blob.size > 0) {
        var name = saveRecordingOnce(result, title);
        showNotice('Die Aufnahme wurde unterbrochen (' + (kind === 'audio' ? 'Mikrofon' : 'Kamera') + ').\n' +
                   'Das bereits Aufgenommene wurde gesichert: ' + name, { share: canShareRecording() });
      } else {
        // Sicherungskopie bleibt erhalten – sie wird beim naechsten Start angeboten
        backupId = null;
        showNotice('Die Aufnahme wurde unterbrochen und es konnten keine Daten gesichert werden.');
      }
    });
  }

  function leavePrompter() {
    if (leaving) return;
    leaving = true;
    abortCountdown();
    cancelPreroll();
    var finish = Promise.resolve();

    if (TPRecorder.isRecording() || stopInProgress) {
      finish = stopRecordingAndSave(true);
    }

    finish.then(function () {
      leaving = false;
      pauseScroll();
      stopTimer();
      releaseWakeLock();
      leaveImmersive();
      TPRecorder.close();
      if (el.selfview) el.selfview.srcObject = null;
      currentText = null;
      lastRecording = null;
      scroll.started = false;
      hideNotice();
      renderList();
      showScreen('list');
      checkForRescue();
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
    updateTransportUi();

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

  /** Bricht einen laufenden Countdown sofort ab. */
  function abortCountdown() {
    countdownAbort = true;
    countdownToken += 1;
    countdownRunning = false;
    el.countdown.classList.add('is-hidden');
  }

  function runCountdown() {
    var seconds = parseInt(settings.countdown, 10) || 0;
    countdownAbort = false;
    var token = ++countdownToken;
    if (seconds <= 0) return Promise.resolve(true);

    countdownRunning = true;
    updateTransportUi();
    el.countdown.classList.remove('is-hidden');
    return new Promise(function (resolve) {
      var remaining = seconds;
      el.countdownNumber.textContent = String(remaining);

      var tick = window.setInterval(function () {
        // Abgebrochen oder durch einen neueren Countdown ersetzt
        if (countdownAbort || token !== countdownToken) {
          window.clearInterval(tick);
          if (token === countdownToken) {
            countdownRunning = false;
            el.countdown.classList.add('is-hidden');
          }
          resolve(false);
          return;
        }
        remaining -= 1;
        if (remaining <= 0) {
          window.clearInterval(tick);
          countdownRunning = false;
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
    if (countdownRunning || TPRecorder.isRecording() || stopInProgress) return;
    hideNotice();
    pauseScroll();
    // Aufnahme beginnt an der aktuellen Textstelle – so kann man nach einem
    // Take gezielt ab einem Absatz neu aufnehmen. ⤒ springt zum Anfang.
    if (scroll.finished) restartScroll();

    runCountdown().then(function (proceed) {
      if (!proceed || !TPRecorder.hasStream() || cameraState !== 'ready') {
        updateTransportUi();
        return;
      }
      try {
        var info = TPRecorder.startRecording();
        startBackup(info);
        lastRecording = null;
        longRecordWarned = false;
        setRecordingUi(true);
        startTimer();
        playScroll();
        toast('Aufnahme läuft · Format ' + info.formatName, 2500);
      } catch (err) {
        toast('Die Aufnahme konnte nicht gestartet werden: ' + (err.message || 'unbekannt'), 6000);
      }
    });
  }

  /* ---------- Sicherungskopie waehrend der Aufnahme ---------- */

  function startBackup(info) {
    backupId = TPBackup.begin({
      mime: info.mimeType,
      extension: info.extension,
      title: currentText ? currentText.title : ''
    }, function () {
      toast('Hinweis: Die Sicherungskopie konnte nicht angelegt werden (Speicher voll?). ' +
            'Die Aufnahme läuft trotzdem weiter.', 7000);
    });
  }

  function finishBackup() {
    if (!backupId) return;
    var id = backupId;
    backupId = null;
    TPBackup.finish(id);
  }

  /**
   * Speichert ein Aufnahme-Ergebnis genau einmal. Erhalten Stopp-Knopf und
   * Stream-Abbruch dasselbe Ergebnis, entsteht trotzdem nur eine Datei.
   */
  function saveRecordingOnce(result, title) {
    if (!result.savedName) {
      result.savedName = TPRecorder.saveBlob(result.blob, result.extension, title);
      rememberRecording(result, result.savedName);
      finishBackup();
    }
    return result.savedName;
  }

  /* ---------- Teilen ---------- */

  function rememberRecording(result, fileName) {
    lastRecording = { blob: result.blob, fileName: fileName, mimeType: result.mimeType || result.blob.type };
  }

  function recordingAsFile() {
    if (!lastRecording || typeof window.File !== 'function') return null;
    try {
      return new File([lastRecording.blob], lastRecording.fileName, { type: lastRecording.mimeType });
    } catch (err) {
      return null;
    }
  }

  function canShareRecording() {
    if (!navigator.share || !navigator.canShare) return false;
    var file = recordingAsFile();
    if (!file) return false;
    try {
      return navigator.canShare({ files: [file] });
    } catch (err) {
      return false;
    }
  }

  el.btnShare.addEventListener('click', function (event) {
    event.stopPropagation();
    var file = recordingAsFile();
    if (!file || !canShareRecording()) {
      toast('Teilen ist auf diesem Gerät nicht möglich. Die Datei liegt in den Downloads.', 5000);
      return;
    }
    // Teilen geschieht ausschliesslich ueber das Teilen-Menue des Geraets –
    // die App selbst uebertraegt nichts.
    navigator.share({ files: [file], title: lastRecording.fileName }).catch(function (err) {
      if (err && err.name === 'AbortError') return; // abgebrochen
      toast('Teilen hat nicht geklappt. Die Datei liegt in den Downloads.', 5000);
    });
  });

  function stopRecordingAndSave(silent) {
    // Doppeltipp oder Verlassen waehrend des Speicherns: denselben Vorgang abwarten
    if (stopInProgress) return stopInProgress;
    var title = currentText ? currentText.title : '';
    el.btnRecStop.disabled = true;
    stopInProgress = TPRecorder.stopRecording().then(function (result) {
      stopInProgress = null;
      el.btnRecStop.disabled = false;
      stopTimer();
      setRecordingUi(false);
      pauseScroll();
      // Zurueck in den Ausgangszustand: Aufnahme- und Prompter-Knopf an ihrem Platz,
      // die Textstelle bleibt erhalten (neue Aufnahme startet dort).
      scroll.started = false;
      updateTransportUi();

      if (!result.blob || result.blob.size === 0) {
        finishBackup();
        if (!silent) toast('Es wurden keine Videodaten aufgenommen.', 5000);
        return;
      }
      var name = saveRecordingOnce(result, title);
      var message = 'Aufnahme gespeichert: ' + name + '\n' +
                    'Länge ' + TPStore.formatDuration(result.seconds) +
                    ' · ' + result.sizeMb + ' MB · ' + result.formatName + '\n' +
                    'Die Datei liegt im Ordner „Downloads“ deines Geräts.';
      if (silent) {
        toast('Aufnahme gesichert: ' + name, 6000);
      } else {
        showNotice(message, { share: canShareRecording() });
        showControls();
      }
    }).catch(function (err) {
      stopInProgress = null;
      el.btnRecStop.disabled = false;
      toast('Beim Speichern ist ein Fehler aufgetreten: ' + (err.message || 'unbekannt'), 6000);
    });
    return stopInProgress;
  }

  /* ---------- Bedienelemente im Prompter ---------- */

  el.btnRecStart.addEventListener('click', function (event) {
    event.stopPropagation();
    startRecordingFlow();
  });

  el.btnPlayOnly.addEventListener('click', function (event) {
    event.stopPropagation();
    if (countdownRunning) return;
    hideNotice();
    if (scroll.finished) restartScroll();
    runCountdown().then(function (proceed) {
      if (proceed) playScroll();
      else updateTransportUi();
    });
  });

  el.btnRecStop.addEventListener('click', function (event) {
    event.stopPropagation();
    stopRecordingAndSave(false);
  });

  el.btnRestart.addEventListener('click', function (event) {
    event.stopPropagation();
    cancelPreroll();
    jumpTo(0, null);
    updateTransportUi();
    if (scroll.running) scheduleFade();
  });

  el.btnPrompterBack.addEventListener('click', function (event) {
    event.stopPropagation();
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

  /* Tippen = Pause/Weiter, Wischen = Text verschieben. Gilt fuer die
     Textflaeche und – im Vollbild – auch fuer das Kamerabild darunter. */
  [el.viewport, el.selfview].forEach(function (target) {
    target.addEventListener('pointerdown', onPointerDown);
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerCancel);
  });

  el.btnPause.addEventListener('click', function (event) {
    event.stopPropagation();
    togglePause();
  });
  el.btnBackPara.addEventListener('click', function (event) {
    event.stopPropagation();
    jumpBack('.tp-p');
  });
  el.btnBackSentence.addEventListener('click', function (event) {
    event.stopPropagation();
    jumpBack('.tp-s');
  });
  el.btnBackLine.addEventListener('click', function (event) {
    event.stopPropagation();
    jumpLines(-1);
  });
  el.btnFwdLine.addEventListener('click', function (event) {
    event.stopPropagation();
    jumpLines(1);
  });

  /* Nach einem Tipp auf einen Knopf den Fokus loesen: sonst wuerde eine
     Leertaste der Fernbedienung den Knopf ein zweites Mal ausloesen. */
  el.screens.prompter.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (button && button.blur) button.blur();
  }, true); // Erfassungsphase: die Knoepfe stoppen das Ereignis sonst vorher

  /* ---------- Tastatur / Bluetooth-Fernbedienung ---------- */

  document.addEventListener('keydown', function (event) {
    if (!el.screens.prompter.classList.contains('is-active')) return;
    var tag = (event.target && event.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!el.confirmLayer.classList.contains('is-hidden')) return;
    if (countdownRunning && event.key !== 'Escape') return;
    if (event.repeat) return; // gehaltene Taste nicht als Dauerfeuer werten

    switch (event.key) {
      case ' ':
      case 'Spacebar':
      case 'Enter':
      case 'MediaPlayPause':
      case 'PageDown':     // typische Fernbedienung / Seitenwender: "weiter"
        event.preventDefault();
        if (scroll.started || scroll.running) { togglePause(); } else { playScroll(); }
        break;
      case 'ArrowLeft':
      case 'PageUp':       // typische Fernbedienung / Seitenwender: "zurueck"
        event.preventDefault();
        jumpBack('.tp-s');
        break;
      case 'ArrowRight':
        event.preventDefault();
        jumpLines(1);
        break;
      case 'Backspace':
        event.preventDefault();
        jumpBack('.tp-p');
        break;
      case 'ArrowUp':
        event.preventDefault();
        changeSpeed(5);
        break;
      case 'ArrowDown':
        event.preventDefault();
        changeSpeed(-5);
        break;
      case 'Home':
        event.preventDefault();
        cancelPreroll();
        jumpTo(0, null);
        updateTransportUi();
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
        (scroll.running || TPRecorder.isRecording())) {
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

  /* ---------- Unterbrochene Aufnahmen retten ---------- */

  function checkForRescue() {
    if (!TPBackup.isSupported() || TPRecorder.isRecording()) return;
    TPBackup.listOrphans().then(function (orphans) {
      el.rescueList.textContent = '';
      // Nur Kopfdaten ohne Bild (Abbruch in der ersten Sekunde) sind nutzlos: still aufraeumen
      var MIN_BYTES = 32768;
      var usable = orphans.filter(function (o) { return o.bytes >= MIN_BYTES; });
      orphans.forEach(function (o) { if (o.bytes < MIN_BYTES) TPBackup.discard(o.id); });

      el.rescueBox.classList.toggle('is-hidden', usable.length === 0);
      usable.forEach(function (o) {
        var li = document.createElement('li');
        var info = document.createElement('p');
        info.className = 'card__text';
        var mb = Math.round((o.bytes / 1048576) * 10) / 10;
        var when = '';
        try {
          when = new Date(o.startedAt).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
        } catch (err) { when = ''; }
        info.textContent = (o.title || 'Ohne Titel') + ' · ' + when + ' · ca. ' +
                           TPStore.formatDuration(o.chunks) + ' · ' + mb + ' MB';
        li.appendChild(info);

        var actions = document.createElement('div');
        actions.className = 'card__actions';
        var save = document.createElement('button');
        save.type = 'button';
        save.className = 'btn btn--primary';
        save.textContent = 'Speichern';
        save.addEventListener('click', function () {
          save.disabled = true;
          TPBackup.restore(o.id).then(function (rec) {
            if (!rec) {
              toast('Die Sicherung ist leer und wurde entfernt.');
              return TPBackup.discard(o.id);
            }
            var name = TPRecorder.saveBlob(rec.blob, rec.extension, rec.title);
            toast('Gerettet: ' + name + ' (Ordner „Downloads“). Falls das Ende fehlt, ist das normal – ' +
                  'die letzte Sekunde vor dem Abbruch konnte nicht mehr gesichert werden.', 9000);
            // Erst nach dem Download-Start entfernen; kurz warten, damit er sicher angelaufen ist
            return new Promise(function (resolve) {
              window.setTimeout(function () { TPBackup.discard(o.id).then(resolve); }, 4000);
            });
          }).catch(function () {
            toast('Die Sicherung konnte nicht gelesen werden.', 5000);
          }).then(function () {
            checkForRescue();
          });
        });
        var drop = document.createElement('button');
        drop.type = 'button';
        drop.className = 'btn btn--ghost';
        drop.textContent = 'Verwerfen';
        drop.addEventListener('click', function () {
          confirmDialog('Aufnahme verwerfen?',
                        'Die gesicherte Aufnahme wird endgültig von diesem Gerät gelöscht.',
                        'Verwerfen')
            .then(function (yes) {
              if (!yes) return null;
              return TPBackup.discard(o.id).then(checkForRescue);
            });
        });
        actions.appendChild(save);
        actions.appendChild(drop);
        li.appendChild(actions);
        el.rescueList.appendChild(li);
      });
    });
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
    checkForRescue();

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
