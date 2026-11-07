/* ============================================================
   store.js – Texte und Einstellungen
   Speichert ausschliesslich lokal im Browser des Geraets
   (localStorage). Es verlaesst nichts das Geraet.
   ============================================================ */

var TPStore = (function () {
  'use strict';

  var TEXTS_KEY = 'tp.texts.v1';
  var SETTINGS_KEY = 'tp.settings.v1';

  var DEFAULT_SETTINGS = {
    wpm: 130,           // Woerter pro Minute (Tempo)
    fontSize: 44,       // px – bewaehrt fuer Hochformat am Handy
    lineHeight: 1.4,
    margin: 8,          // Prozent Seitenrand
    textColor: '#ffffff',
    marker: 'line',     // off | line | arrow
    markerPos: 'top',   // top | center
    countdown: 3,       // Sekunden
    mirrorH: false,
    mirrorV: false,
    previewMode: 'full',  // off | small | medium | full (Kamerabild hinter dem Text)
    mirrorSelf: true,     // Selbstbild wie ein Spiegel anzeigen (Aufnahme bleibt ungespiegelt)
    camDim: 40,           // Prozent Abdunkelung des Kamerabildes im Vollbild
    textArea: 'full',     // full | top – Textbereich im Vollbild (ganz: mehr Text im Voraus lesen)
    resumeDelay: 2,       // Sekunden Vorlauf beim Fortsetzen nach einer Pause
    micId: '',
    audioFilters: false,
    orientation: 'portrait' // portrait | landscape
  };

  /* ---------- Hilfsfunktionen ---------- */

  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function newId() {
    // Zeitstempel + Zufall, ausreichend eindeutig fuer lokale Nutzung
    return 'txt-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  /**
   * Abschnitts-Ueberschrift im Skript: eine eigene Zeile nur in Grossbuchstaben
   * (z. B. "HOOK", "INTRO", "1. ZWEIMAL IM WINTER"), ohne Satzzeichen am Ende.
   * Wird im Prompter hervorgehoben und nicht mitgesprochen.
   */
  function isHeadingLine(line) {
    var t = String(line || '').trim();
    if (t.length < 3 || t.length > 70) return false;
    if (/[.!?…:]$/.test(t)) return false;
    var letters = t.replace(/[^A-Za-zÄÖÜäöüßẞÀ-ÿ]/g, '');
    if (letters.length < 3) return false;
    // "ß" hat keine eigene Grossform im Alltag (STRASSE / STRAßE) – beim Vergleich ausklammern
    var core = letters.replace(/[ßẞ]/g, '');
    return core.length > 0 && core === core.toUpperCase() && core !== core.toLowerCase();
  }

  /** Woerter, die gesprochen werden (ohne Abschnitts-Ueberschriften). */
  function countSpokenWords(text) {
    if (!text) return 0;
    return String(text).split('\n').reduce(function (sum, line) {
      return isHeadingLine(line) ? sum : sum + countWords(line);
    }, 0);
  }

  function countWords(text) {
    if (!text) return 0;
    var trimmed = String(text).trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  /** Geschaetzte Sprechdauer in Sekunden bei gegebenem Tempo. */
  function estimateSeconds(text, wpm) {
    var words = countSpokenWords(text);
    var tempo = wpm > 0 ? wpm : DEFAULT_SETTINGS.wpm;
    return Math.round((words / tempo) * 60);
  }

  function formatDuration(seconds) {
    var s = Math.max(0, Math.round(seconds));
    var m = Math.floor(s / 60);
    var rest = s % 60;
    return String(m).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (err) {
      return '';
    }
  }

  /* ---------- Einstellungen ---------- */

  function loadSettings() {
    var stored = read(SETTINGS_KEY, {});
    if (!stored || typeof stored !== 'object') stored = {};
    var result = {};
    for (var key in DEFAULT_SETTINGS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
        result[key] = Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : DEFAULT_SETTINGS[key];
      }
    }
    // Umstieg von Version 1.0: "preview" (an/aus) + "previewSize" -> "previewMode".
    // Wer das Selbstbild aus hatte, behaelt es aus; sonst gilt das neue Vollbild.
    if (!Object.prototype.hasOwnProperty.call(stored, 'previewMode') &&
        Object.prototype.hasOwnProperty.call(stored, 'preview') && stored.preview === false) {
      result.previewMode = 'off';
    }
    if (['off', 'small', 'medium', 'full'].indexOf(result.previewMode) === -1) {
      result.previewMode = DEFAULT_SETTINGS.previewMode;
    }
    if (['full', 'top'].indexOf(result.textArea) === -1) result.textArea = DEFAULT_SETTINGS.textArea;
    // Zahlenwerte absichern: beschaedigter Speicher darf die App nie lahmlegen
    function num(value, min, max, fallback) {
      var n = parseFloat(value);
      return isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
    }
    result.wpm = Math.round(num(result.wpm, 60, 240, DEFAULT_SETTINGS.wpm));
    result.fontSize = Math.round(num(result.fontSize, 24, 120, DEFAULT_SETTINGS.fontSize));
    result.lineHeight = Math.round(num(result.lineHeight, 1, 2.5, DEFAULT_SETTINGS.lineHeight) * 10) / 10;
    result.margin = Math.round(num(result.margin, 0, 25, DEFAULT_SETTINGS.margin));
    var dim = parseInt(result.camDim, 10);
    result.camDim = isNaN(dim) ? DEFAULT_SETTINGS.camDim : Math.min(80, Math.max(0, dim));
    var delay = parseInt(result.resumeDelay, 10);
    result.resumeDelay = isNaN(delay) ? DEFAULT_SETTINGS.resumeDelay : Math.min(3, Math.max(0, delay));
    return result;
  }

  function saveSettings(settings) {
    return write(SETTINGS_KEY, settings);
  }

  function defaultSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  /* ---------- Texte ---------- */

  function loadTexts() {
    var list = read(TEXTS_KEY, []);
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) {
      return item && typeof item.id === 'string';
    }).map(function (item) {
      return {
        id: item.id,
        title: typeof item.title === 'string' ? item.title : 'Ohne Titel',
        body: typeof item.body === 'string' ? item.body : '',
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString()
      };
    });
  }

  function saveTexts(list) {
    return write(TEXTS_KEY, list);
  }

  function sortByDateDesc(list) {
    return list.slice().sort(function (a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
  }

  function getText(id) {
    var list = loadTexts();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /** Legt einen Text an oder aktualisiert ihn. Gibt den gespeicherten Text zurueck. */
  function upsertText(entry) {
    var list = loadTexts();
    var now = new Date().toISOString();
    var title = (entry.title || '').trim() || 'Ohne Titel';
    var record;

    if (entry.id) {
      var found = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === entry.id) {
          list[i] = { id: entry.id, title: title, body: entry.body || '', updatedAt: now };
          record = list[i];
          found = true;
          break;
        }
      }
      if (!found) {
        record = { id: entry.id, title: title, body: entry.body || '', updatedAt: now };
        list.push(record);
      }
    } else {
      record = { id: newId(), title: title, body: entry.body || '', updatedAt: now };
      list.push(record);
    }

    if (!saveTexts(list)) return null;
    return record;
  }

  function deleteText(id) {
    var list = loadTexts().filter(function (item) { return item.id !== id; });
    return saveTexts(list);
  }

  function duplicateText(id) {
    var source = getText(id);
    if (!source) return null;
    return upsertText({ title: source.title + ' (Kopie)', body: source.body });
  }

  /* ---------- Export / Import ---------- */

  function exportPayload() {
    return {
      app: 'teleprompter',
      version: 1,
      exportedAt: new Date().toISOString(),
      texts: loadTexts()
    };
  }

  /**
   * Importiert eine Export-Datei. Bestehende Texte bleiben erhalten,
   * importierte werden ergaenzt (neue IDs, damit nichts ueberschrieben wird).
   * Gibt die Anzahl importierter Texte zurueck oder -1 bei ungueltiger Datei.
   */
  function importPayload(raw) {
    var data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return -1;
    }
    var incoming = data && Array.isArray(data.texts) ? data.texts : null;
    if (!incoming) return -1;

    var list = loadTexts();
    var added = 0;
    var now = new Date().toISOString();

    incoming.forEach(function (item) {
      if (!item || typeof item.body !== 'string') return;
      list.push({
        id: newId(),
        title: (typeof item.title === 'string' && item.title.trim()) ? item.title.trim() : 'Ohne Titel',
        body: item.body,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now
      });
      added++;
    });

    if (added > 0 && !saveTexts(list)) return -1;
    return added;
  }

  /** Importiert eine einfache .txt-Datei als einzelnen Text. */
  function importPlainText(raw, fileName) {
    var title = (fileName || 'Importierter Text').replace(/\.[^.]+$/, '');
    var record = upsertText({ title: title, body: raw });
    return record ? 1 : -1;
  }

  return {
    DEFAULTS: DEFAULT_SETTINGS,
    defaultSettings: defaultSettings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    loadTexts: loadTexts,
    saveTexts: saveTexts,
    sortByDateDesc: sortByDateDesc,
    getText: getText,
    upsertText: upsertText,
    deleteText: deleteText,
    duplicateText: duplicateText,
    exportPayload: exportPayload,
    importPayload: importPayload,
    importPlainText: importPlainText,
    countWords: countWords,
    countSpokenWords: countSpokenWords,
    isHeadingLine: isHeadingLine,
    estimateSeconds: estimateSeconds,
    formatDuration: formatDuration,
    formatDate: formatDate
  };
})();
