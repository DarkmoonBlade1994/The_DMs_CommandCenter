/* ==========================================================================
   DM Hub — 2-Layer Persistence & Rotating Backup Manager
   Layer 1: IndexedDB 4-Slot Rolling Snapshots (with localStorage fallback)
   Layer 2A: File System Access API (4 rotating files dm-hub-backup-1..4.json)
   Layer 2B: Universal JSON Export / Import + Gentle Backup Reminder Badge
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const DB_NAME = 'DMHubBackups';
  const DB_VERSION = 1;
  const STORE_SNAPSHOTS = 'snapshots';
  const STORE_HANDLES = 'handles';
  const HANDLE_KEY = 'backupDirHandle';
  const FALLBACK_SNAP_KEY = 'dm_hub_snapshots_fallback_v1';
  const MAX_SNAPSHOTS = 4;
  const MAX_FOLDER_FILES = 4;
  const AUTO_SNAPSHOT_MS = 5 * 60 * 1000;   // 5 minutes
  const FOLDER_SYNC_MS = 10 * 60 * 1000;    // 10 minutes
  const REMINDER_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

  let dbPromise = null;
  let cachedDirHandle = null;
  let useFallbackSnapshots = false;
  let backupListeners = [];

  function notifyBackupListeners() {
    backupListeners.forEach(function (fn) {
      try { fn(); } catch (e) { /* no-op */ }
    });
  }

  function subscribe(fn) {
    backupListeners.push(fn);
    return function () {
      backupListeners = backupListeners.filter(function (item) { return item !== fn; });
    };
  }

  function supportsFolderBackup() {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    if (typeof indexedDB === 'undefined') {
      useFallbackSnapshots = true;
      return Promise.resolve(null);
    }

    dbPromise = new Promise(function (resolve) {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (event) {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
            db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_HANDLES)) {
            db.createObjectStore(STORE_HANDLES);
          }
        };
        req.onsuccess = function (event) {
          resolve(event.target.result);
        };
        req.onerror = function () {
          useFallbackSnapshots = true;
          resolve(null);
        };
      } catch (err) {
        useFallbackSnapshots = true;
        resolve(null);
      }
    });

    return dbPromise;
  }

  /* ------------------------------------------------------------------------
     Layer 1: 4-Slot Rolling Snapshots (IndexedDB + Fallback)
     ------------------------------------------------------------------------ */

  function readFallbackSnapshots() {
    try {
      const raw = localStorage.getItem(FALLBACK_SNAP_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeFallbackSnapshots(list) {
    try {
      localStorage.setItem(FALLBACK_SNAP_KEY, JSON.stringify(list.slice(0, MAX_SNAPSHOTS)));
    } catch (e) {
      // Ignore quota errors
    }
  }

  function listSnapshots() {
    return openDb().then(function (db) {
      if (!db || useFallbackSnapshots) {
        return readFallbackSnapshots().sort(function (a, b) {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
      }

      return new Promise(function (resolve) {
        try {
          const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
          const store = tx.objectStore(STORE_SNAPSHOTS);
          const req = store.getAll();
          req.onsuccess = function () {
            const list = (req.result || []).sort(function (a, b) {
              return new Date(b.timestamp) - new Date(a.timestamp);
            });
            resolve(list);
          };
          req.onerror = function () {
            resolve(readFallbackSnapshots());
          };
        } catch (err) {
          resolve(readFallbackSnapshots());
        }
      });
    });
  }

  function createSnapshot(reason) {
    const labelMap = {
      manual: 'Manual Snapshot',
      'auto-5m': 'Auto-Snapshot (5 min)',
      'encounter-save': 'Encounter Saved',
      'session-end': 'Session Ended',
      'pre-restore': 'Safety Backup (Before Restore)'
    };

    const snapshot = {
      id: 'snap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      reason: labelMap[reason] || reason || 'Snapshot',
      summary: DMHub.Store.getSummaryText(),
      payload: DMHub.Store.exportSerializableState()
    };

    return listSnapshots().then(function (existing) {
      const nextList = [snapshot].concat(existing);
      const toKeep = nextList.slice(0, MAX_SNAPSHOTS);
      const toDelete = nextList.slice(MAX_SNAPSHOTS);

      return openDb().then(function (db) {
        if (!db || useFallbackSnapshots) {
          writeFallbackSnapshots(toKeep);
          DMHub.Store.clearSnapshotDirty();
          notifyBackupListeners();
          return snapshot;
        }

        return new Promise(function (resolve) {
          try {
            const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
            const store = tx.objectStore(STORE_SNAPSHOTS);
            store.put(snapshot);
            toDelete.forEach(function (oldSnap) {
              store.delete(oldSnap.id);
            });
            tx.oncomplete = function () {
              DMHub.Store.clearSnapshotDirty();
              notifyBackupListeners();
              resolve(snapshot);
            };
            tx.onerror = function () {
              writeFallbackSnapshots(toKeep);
              DMHub.Store.clearSnapshotDirty();
              notifyBackupListeners();
              resolve(snapshot);
            };
          } catch (err) {
            writeFallbackSnapshots(toKeep);
            DMHub.Store.clearSnapshotDirty();
            notifyBackupListeners();
            resolve(snapshot);
          }
        });
      });
    });
  }

  function restoreSnapshot(snapshotId) {
    return listSnapshots().then(function (list) {
      const found = list.find(function (s) { return s.id === snapshotId; });
      if (!found || !found.payload) {
        throw new Error('Snapshot not found');
      }
      DMHub.Store.replaceEntireState(found.payload);
      notifyBackupListeners();
      return found;
    });
  }

  /* ------------------------------------------------------------------------
     Layer 2A: File System Access API (4 Rotating Files)
     ------------------------------------------------------------------------ */

  function saveDirectoryHandle(handle) {
    cachedDirHandle = handle;
    return openDb().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        try {
          const tx = db.transaction(STORE_HANDLES, 'readwrite');
          const store = tx.objectStore(STORE_HANDLES);
          if (handle) {
            store.put(handle, HANDLE_KEY);
          } else {
            store.delete(HANDLE_KEY);
          }
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        } catch (err) {
          resolve();
        }
      });
    });
  }

  function loadDirectoryHandle() {
    if (!supportsFolderBackup()) return Promise.resolve(null);
    if (cachedDirHandle) return Promise.resolve(cachedDirHandle);
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          const tx = db.transaction(STORE_HANDLES, 'readonly');
          const req = tx.objectStore(STORE_HANDLES).get(HANDLE_KEY);
          req.onsuccess = function () {
            cachedDirHandle = req.result || null;
            resolve(cachedDirHandle);
          };
          req.onerror = function () { resolve(null); };
        } catch (err) {
          resolve(null);
        }
      });
    });
  }

  function linkBackupFolder() {
    if (!supportsFolderBackup()) {
      return Promise.reject(new Error('Folder backup is not supported in this browser.'));
    }
    return window.showDirectoryPicker({ mode: 'readwrite', id: 'dm-hub-backups' })
      .then(function (dirHandle) {
        return saveDirectoryHandle(dirHandle).then(function () {
          DMHub.Store.markBackupWizardSeen();
          notifyBackupListeners();
          return dirHandle;
        });
      });
  }

  function unlinkBackupFolder() {
    return saveDirectoryHandle(null).then(function () {
      DMHub.Store.updateSettings({ periodicFolderSync: false });
      notifyBackupListeners();
    });
  }

  function ensureFolderPermission(handle, interactive) {
    if (!handle || typeof handle.queryPermission !== 'function') {
      return Promise.resolve(false);
    }
    return handle.queryPermission({ mode: 'readwrite' }).then(function (perm) {
      if (perm === 'granted') return true;
      if (!interactive || typeof handle.requestPermission !== 'function') return false;
      return handle.requestPermission({ mode: 'readwrite' }).then(function (reqPerm) {
        return reqPerm === 'granted';
      });
    });
  }

  function backupToFolderNow(opts) {
    const interactive = !(opts && opts.silent);
    return loadDirectoryHandle().then(function (handle) {
      if (!handle) {
        throw new Error('No backup folder linked yet.');
      }
      return ensureFolderPermission(handle, interactive).then(function (granted) {
        if (!granted) {
          throw new Error('Folder write permission not granted.');
        }

        const state = DMHub.Store.getState();
        const slot = ((Number(state.settings.nextFolderBackupSlot) || 1) - 1) % MAX_FOLDER_FILES + 1;
        const filename = 'dm-hub-backup-' + slot + '.json';
        const nextSlot = (slot % MAX_FOLDER_FILES) + 1;

        const payload = {
          app: 'DM Hub',
          exportedAt: new Date().toISOString(),
          backupSlot: slot,
          data: DMHub.Store.exportSerializableState()
        };

        return handle.getFileHandle(filename, { create: true })
          .then(function (fileHandle) { return fileHandle.createWritable(); })
          .then(function (writable) {
            return writable.write(JSON.stringify(payload, null, 2))
              .then(function () { return writable.close(); });
          })
          .then(function () {
            DMHub.Store.markExternalBackupCompleted(nextSlot);
            notifyBackupListeners();
            return { filename: filename, slot: slot, folderName: handle.name };
          });
      });
    });
  }

  function getFolderStatus() {
    if (!supportsFolderBackup()) {
      return Promise.resolve({ supported: false, linked: false, folderName: null });
    }
    return loadDirectoryHandle().then(function (handle) {
      return {
        supported: true,
        linked: Boolean(handle),
        folderName: handle ? handle.name : null
      };
    });
  }

  /* ------------------------------------------------------------------------
     Layer 2B: Universal JSON Export & Import + Reminder Logic
     ------------------------------------------------------------------------ */

  function formatFileStamp(date) {
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return (
      date.getFullYear() + '-' +
      pad(date.getMonth() + 1) + '-' +
      pad(date.getDate()) + '-' +
      pad(date.getHours()) +
      pad(date.getMinutes())
    );
  }

  function exportBackupJson() {
    const now = new Date();
    const filename = 'dm-hub-backup-' + formatFileStamp(now) + '.json';
    const envelope = {
      app: 'DM Hub',
      exportedAt: now.toISOString(),
      data: DMHub.Store.exportSerializableState()
    };

    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

    DMHub.Store.markExternalBackupCompleted();
    notifyBackupListeners();
    return filename;
  }

  function importBackupJsonFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          const candidate = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
          if (!candidate || typeof candidate !== 'object' || (!candidate.encounter && !candidate.settings)) {
            throw new Error('This file does not look like a valid DM Hub backup.');
          }
          createSnapshot('pre-restore').then(function () {
            DMHub.Store.replaceEntireState(candidate);
            notifyBackupListeners();
            resolve(candidate);
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () {
        reject(new Error('Could not read the selected file.'));
      };
      reader.readAsText(file);
    });
  }

  function isBackupReminderDue() {
    if (!DMHub.Store.hasMeaningfulData()) return false;
    const st = DMHub.Store.getState();
    if (!st.lastExternalBackupAt) return true;
    const lastMs = new Date(st.lastExternalBackupAt).getTime();
    const updatedMs = st.updatedAt ? new Date(st.updatedAt).getTime() : Date.now();
    if (Number.isNaN(lastMs)) return true;
    return updatedMs > lastMs && (Date.now() - lastMs) > REMINDER_THRESHOLD_MS;
  }

  /* ------------------------------------------------------------------------
     Background Timers (5-min Dirty Snapshot & Optional 10-min Folder Sync)
     ------------------------------------------------------------------------ */

  function startTimers() {
    setInterval(function () {
      if (DMHub.Store.isDirtyForSnapshot() && DMHub.Store.hasMeaningfulData()) {
        createSnapshot('auto-5m');
      }
    }, AUTO_SNAPSHOT_MS);

    setInterval(function () {
      const st = DMHub.Store.getState();
      if (
        supportsFolderBackup() &&
        st.settings.periodicFolderSync &&
        DMHub.Store.isDirtyForFolderSync()
      ) {
        backupToFolderNow({ silent: true }).catch(function () {
          // Silent skip if permission needs user gesture
        });
      }
    }, FOLDER_SYNC_MS);
  }

  DMHub.Backup = {
    subscribe: subscribe,
    supportsFolderBackup: supportsFolderBackup,
    listSnapshots: listSnapshots,
    createSnapshot: createSnapshot,
    restoreSnapshot: restoreSnapshot,
    linkBackupFolder: linkBackupFolder,
    unlinkBackupFolder: unlinkBackupFolder,
    backupToFolderNow: backupToFolderNow,
    getFolderStatus: getFolderStatus,
    exportBackupJson: exportBackupJson,
    importBackupJsonFile: importBackupJsonFile,
    isBackupReminderDue: isBackupReminderDue,
    startTimers: startTimers
  };
})(window.DMHub = window.DMHub || {});
