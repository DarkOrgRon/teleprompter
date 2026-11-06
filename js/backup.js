/* ============================================================
   backup.js – Sicherungskopie waehrend der Aufnahme
   Jedes Aufnahme-Haeppchen (ca. 1 Sekunde) wird zusaetzlich in
   der lokalen Browser-Datenbank (IndexedDB) dieses Geraets
   abgelegt. Stuerzt die App ab oder wird sie weggewischt, kann
   die Aufnahme beim naechsten Start gerettet werden.
   Es verlaesst nichts das Geraet.
   ============================================================ */

var TPBackup = (function () {
  'use strict';

  var DB_NAME = 'tp-backup';
  var DB_VERSION = 1;
  var dbPromise = null;

  // Schreibvorgaenge laufen strikt nacheinander, damit die Reihenfolge stimmt
  var queue = Promise.resolve();
  var activeId = null;
  var failed = false;
  var onFailure = null;
  var releaseLock = null;   // gibt die Web-Lock der laufenden Aufnahme frei

  var LOCK_PREFIX = 'tp-rec-';

  function hasLocks() {
    return !!(navigator.locks && navigator.locks.request && navigator.locks.query);
  }

  /**
   * Haelt waehrend der Aufnahme eine Sperre. Ein zweiter Tab (oder die
   * installierte App neben einem Browser-Tab) erkennt daran, dass diese
   * Aufnahme noch laeuft, und bietet sie nicht als "unterbrochen" an.
   * Stuerzt die App ab, gibt der Browser die Sperre automatisch frei.
   */
  function holdLock(id) {
    if (!hasLocks()) return;
    try {
      navigator.locks.request(LOCK_PREFIX + id, function () {
        return new Promise(function (resolve) { releaseLock = resolve; });
      }).catch(function () { /* nicht kritisch */ });
    } catch (err) { /* nicht kritisch */ }
  }

  function freeLock() {
    if (releaseLock) {
      var r = releaseLock;
      releaseLock = null;
      r();
    }
  }

  /** Kennungen aller Aufnahmen, die gerade irgendwo (auch in anderen Tabs) laufen. */
  function lockedIds() {
    if (!hasLocks()) return Promise.resolve({});
    return navigator.locks.query().then(function (state) {
      var ids = {};
      (state.held || []).concat(state.pending || []).forEach(function (l) {
        if (l.name && l.name.indexOf(LOCK_PREFIX) === 0) ids[l.name.slice(LOCK_PREFIX.length)] = true;
      });
      return ids;
    }).catch(function () { return {}; });
  }

  function isSupported() {
    return typeof window.indexedDB !== 'undefined';
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var request;
      try {
        request = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        reject(err);
        return;
      }
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('recs')) {
          db.createObjectStore('recs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chunks')) {
          db.createObjectStore('chunks', { keyPath: ['rec', 'seq'] });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Datenbank nicht verfügbar')); };
      request.onblocked = function () { reject(new Error('Datenbank blockiert')); };
    });
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }

  /** Fuehrt eine Transaktion aus und wartet, bis sie wirklich abgeschlossen ist. */
  function tx(storeNames, mode, work) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeNames, mode);
        var result;
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error || new Error('Transaktion fehlgeschlagen')); };
        t.onabort = function () { reject(t.error || new Error('Transaktion abgebrochen')); };
        result = work(t);
      });
    });
  }

  function chunkRange(id) {
    return window.IDBKeyRange.bound([id, 0], [id, Infinity]);
  }

  function reportFailure(err) {
    if (failed) return;
    failed = true;
    if (onFailure) {
      try { onFailure(err); } catch (e) { /* ignorieren */ }
    }
  }

  /**
   * Beginnt eine neue Sicherung. meta: { mime, extension, title }
   * Gibt die Kennung zurueck (oder null, wenn keine Sicherung moeglich ist).
   */
  function begin(meta, failureCallback) {
    failed = false;
    onFailure = failureCallback || null;
    activeId = null;
    if (!isSupported()) {
      reportFailure(new Error('IndexedDB nicht verfügbar'));
      return null;
    }
    var id = 'rec-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
    activeId = id;
    freeLock();
    holdLock(id);
    var record = {
      id: id,
      mime: meta.mime || '',
      extension: meta.extension || 'webm',
      title: meta.title || '',
      startedAt: new Date().toISOString()
    };
    queue = queue.then(function () {
      return tx(['recs'], 'readwrite', function (t) {
        t.objectStore('recs').put(record);
      });
    }).catch(reportFailure);

    return id;
  }

  /** Legt ein Haeppchen ab. Fehler werden einmalig gemeldet, die Aufnahme laeuft weiter. */
  function addChunk(id, seq, blob) {
    if (!id || failed || !blob || !blob.size) return;
    queue = queue.then(function () {
      if (failed) return null;
      return tx(['chunks'], 'readwrite', function (t) {
        t.objectStore('chunks').put({ rec: id, seq: seq, blob: blob });
      });
    }).catch(reportFailure);
  }

  /** Entfernt eine Sicherung samt Haeppchen. */
  function discard(id) {
    if (!id || !isSupported()) return Promise.resolve();
    return tx(['recs', 'chunks'], 'readwrite', function (t) {
      t.objectStore('chunks').delete(chunkRange(id));
      t.objectStore('recs').delete(id);
    }).catch(function () { /* nicht kritisch */ });
  }

  /**
   * Aufnahme wurde regulaer gespeichert: erst alle ausstehenden
   * Schreibvorgaenge abwarten, dann die Sicherung loeschen.
   */
  function finish(id) {
    if (!id) return Promise.resolve();
    if (activeId === id) {
      activeId = null;
      freeLock();
    }
    var done = queue.then(function () { return discard(id); });
    queue = done.catch(function () { /* weiter */ });
    return done;
  }

  /** Liefert alle Sicherungen, die nicht regulaer beendet wurden. */
  function listOrphans() {
    if (!isSupported()) return Promise.resolve([]);
    // Erst ausstehende Schreib-/Loeschvorgaenge abwarten – sonst erschiene eine
    // gerade regulaer gespeicherte Aufnahme kurz als "unterbrochen".
    var running = {};
    return queue.then(lockedIds).then(function (ids) {
      running = ids;
      return tx(['recs', 'chunks'], 'readonly', function (t) { return listWork(t, running); });
    }).then(function (result) {
      // Haeppchen ohne Eintrag (z. B. nach Loeschen aus einem anderen Tab) aufraeumen
      result.strays.forEach(function (id) { discard(id); });
      return result.found;
    }).catch(function () { return []; });
  }

  function listWork(t, running) {
    var found = [];
    var known = {};
    var result = { found: found, strays: [] };
    var recReq = t.objectStore('recs').getAll();
    recReq.onsuccess = function () {
      (recReq.result || []).forEach(function (rec) { known[rec.id] = true; });
      // Verwaiste Haeppchen-Gruppen erkennen
      var keyReq = t.objectStore('chunks').getAllKeys();
      keyReq.onsuccess = function () {
        var seen = {};
        (keyReq.result || []).forEach(function (key) {
          var recId = key[0];
          if (!known[recId] && !running[recId] && !seen[recId] && recId !== activeId) {
            seen[recId] = true;
            result.strays.push(recId);
          }
        });
      };
      (recReq.result || []).forEach(function (rec) {
        if (rec.id === activeId || running[rec.id]) return;
        var entry = { id: rec.id, mime: rec.mime, extension: rec.extension, title: rec.title,
                      startedAt: rec.startedAt, chunks: 0, bytes: 0 };
        found.push(entry);
        var cReq = t.objectStore('chunks').getAll(chunkRange(rec.id));
        cReq.onsuccess = function () {
          (cReq.result || []).forEach(function (c) {
            entry.chunks += 1;
            entry.bytes += c.blob ? c.blob.size : 0;
          });
        };
      });
    };
    return result;
  }

  /** Setzt eine gesicherte Aufnahme wieder zu einer Datei zusammen. */
  function restore(id) {
    return tx(['recs', 'chunks'], 'readonly', function (t) {
      var out = { rec: null, blobs: [] };
      var recReq = t.objectStore('recs').get(id);
      recReq.onsuccess = function () { out.rec = recReq.result || null; };
      var cReq = t.objectStore('chunks').getAll(chunkRange(id));
      cReq.onsuccess = function () {
        out.blobs = (cReq.result || [])
          .sort(function (a, b) { return a.seq - b.seq; })
          .map(function (c) { return c.blob; });
      };
      return out;
    }).then(function (out) {
      if (!out.rec || !out.blobs.length) return null;
      return {
        blob: new Blob(out.blobs, { type: out.rec.mime || 'video/webm' }),
        extension: out.rec.extension || 'webm',
        title: out.rec.title || ''
      };
    });
  }

  return {
    isSupported: isSupported,
    begin: begin,
    addChunk: addChunk,
    finish: finish,
    discard: discard,
    listOrphans: listOrphans,
    restore: restore
  };
})();
