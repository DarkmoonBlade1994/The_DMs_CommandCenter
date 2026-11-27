/* ==========================================================================
   DM Hub — Settings, House Rules (With Save Confirmation) & 2-Layer Backups
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const U = function () { return DMHub.UI; };
  const S = function () { return DMHub.Store; };
  const B = function () { return DMHub.Backup; };

  let lastContainer = null;
  let draftSettings = null;

  const SETTING_KEYS = [
    'theme',
    'critRule',
    'enemyInitiativeMode',
    'nat20AutoHit',
    'autoConcentrationToast',
    'cloneInitiativeMode',
    'defaultRollMathVisible',
    'periodicFolderSync'
  ];

  const CRIT_RULES = [
    {
      id: 'raw',
      title: '1. Roll Double Dice (5e Standard RAW)',
      desc: 'Roll twice as many damage dice and add the flat modifier once.'
    },
    {
      id: 'double-dice-value',
      title: '2. Double Rolled Dice Value',
      desc: 'Roll normal damage dice, multiply the rolled dice total by 2, then add flat modifier once.'
    },
    {
      id: 'double-all',
      title: '3. Double All Damage',
      desc: 'Roll normal damage dice + flat modifier, then multiply the entire total by 2.'
    },
    {
      id: 'crunchy',
      title: '4. Crunchy Crits (Max + Roll)',
      desc: 'Maximum possible value of normal dice + one normal roll of those dice + flat modifier.'
    }
  ];

  function getSavedSettings() {
    return S().getState().settings || {};
  }

  function ensureDraft() {
    if (!draftSettings) {
      const saved = getSavedSettings();
      draftSettings = {};
      SETTING_KEYS.forEach(function (k) {
        draftSettings[k] = saved[k];
      });
    }
    return draftSettings;
  }

  function resetDraft() {
    draftSettings = null;
  }

  function hasUnsavedChanges() {
    if (!draftSettings) return false;
    const saved = getSavedSettings();
    return SETTING_KEYS.some(function (k) {
      return draftSettings[k] !== saved[k];
    });
  }

  function commitDraft(container) {
    if (!draftSettings) return;
    const saved = getSavedSettings();
    const next = Object.assign({}, draftSettings);
    const enemyModeChanged = next.enemyInitiativeMode !== saved.enemyInitiativeMode;

    // Reset draft before committing so Store re-render reads fresh saved values
    draftSettings = null;

    if (enemyModeChanged) {
      S().setEnemyInitiativeMode(next.enemyInitiativeMode);
    }
    S().updateSettings({
      theme: next.theme,
      critRule: next.critRule,
      enemyInitiativeMode: next.enemyInitiativeMode,
      nat20AutoHit: Boolean(next.nat20AutoHit),
      autoConcentrationToast: Boolean(next.autoConcentrationToast),
      cloneInitiativeMode: next.cloneInitiativeMode,
      defaultRollMathVisible: next.defaultRollMathVisible,
      periodicFolderSync: Boolean(next.periodicFolderSync)
    });

    U().showToast({
      title: 'Settings Saved',
      message: 'Your theme and tabletop house rules have been applied.',
      tone: 'success',
      duration: 2400
    });
    render(container);
  }

  function render(targetContainer) {
    const container = targetContainer || lastContainer || document.getElementById('view-settings');
    if (!container) return;
    lastContainer = container;

    Promise.all([B().listSnapshots(), B().getFolderStatus()]).then(function (results) {
      renderMarkup(container, results[0] || [], results[1] || { supported: false, linked: false });
    }).catch(function () {
      renderMarkup(container, [], { supported: B().supportsFolderBackup(), linked: false });
    });
  }

  function renderMarkup(container, snapshots, folderStatus) {
    const state = S().getState();
    const cfg = ensureDraft();
    const dirty = hasUnsavedChanges();
    const esc = U().escapeHtml;
    const reminderDue = B().isBackupReminderDue();

    const saveBarHtml =
      '<div class="settings-save-bar' + (dirty ? ' is-dirty' : '') + '" id="settings-save-bar">' +
        '<div class="settings-save-status">' +
          (dirty
            ? '<span class="settings-dirty-dot" aria-hidden="true"></span><span>Unsaved changes — click Save Settings to apply</span>'
            : '<span>All settings saved</span>') +
        '</div>' +
        '<div class="settings-save-actions">' +
          (dirty ? '<button type="button" class="btn btn-sm" id="btn-discard-settings">Discard</button>' : '') +
          '<button type="button" class="btn btn-sm btn-primary" id="btn-save-settings"' + (dirty ? '' : ' disabled') + '>Save Settings</button>' +
        '</div>' +
      '</div>';

    const critRadiosHtml = CRIT_RULES.map(function (rule) {
      const checked = cfg.critRule === rule.id;
      return '<label class="rule-option' + (checked ? ' is-selected' : '') + '">' +
        '<input type="radio" name="crit-rule" value="' + esc(rule.id) + '"' + (checked ? ' checked' : '') + '>' +
        '<div>' +
          '<div class="rule-option-title">' + esc(rule.title) + '</div>' +
          '<div class="rule-option-desc">' + esc(rule.desc) + '</div>' +
        '</div>' +
      '</label>';
    }).join('');

    const snapshotsHtml = snapshots.length
      ? '<div class="list-stack">' +
          snapshots.map(function (snap, i) {
            return '<div class="item-row">' +
              '<div class="item-row-main">' +
                '<div class="item-row-title">Slot ' + (i + 1) + ' &bull; ' + esc(snap.reason) + '</div>' +
                '<div class="item-row-meta mono">' + esc(U().formatDateTime(snap.timestamp)) + '</div>' +
                '<div class="item-row-meta">' + esc(snap.summary || '') + '</div>' +
              '</div>' +
              '<button type="button" class="btn btn-sm btn-primary" data-restore-snap="' + esc(snap.id) + '">Restore</button>' +
            '</div>';
          }).join('') +
        '</div>'
      : '<p class="section-subtitle">No rolling snapshots yet. Snapshots are captured automatically every 5 minutes when changes occur, on saving an encounter, or ending a session.</p>';

    const backupBannerHtml = reminderDue
      ? '<div class="status-banner status-banner-amber" id="backup-reminder-banner">' +
          '<span><strong>Backup Recommended:</strong> No external backup saved recently.</span>' +
          '<button type="button" class="btn btn-sm btn-primary" id="btn-banner-export">Export .json</button>' +
        '</div>'
      : (state.lastExternalBackupAt
          ? '<div class="status-banner status-banner-emerald">' +
              '<span>Last external backup: ' + esc(U().formatDateTime(state.lastExternalBackupAt)) + '</span>' +
            '</div>'
          : '');

    let folderSectionHtml = '';
    if (folderStatus.supported) {
      const nextSlot = ((Number(state.settings.nextFolderBackupSlot) || 1) - 1) % 4 + 1;
      folderSectionHtml =
        '<div class="list-stack" style="margin-bottom:12px;">' +
          '<div class="item-row">' +
            '<div class="item-row-main">' +
              '<div class="item-row-title">Local Backup Folder (4 Rotating Files)</div>' +
              '<div class="item-row-meta">' +
                (folderStatus.linked
                  ? 'Linked to <strong>' + esc(folderStatus.folderName) + '</strong> &bull; Next file: <span class="mono">dm-hub-backup-' + nextSlot + '.json</span>'
                  : 'Pick a local folder to rotate dm-hub-backup-1.json through dm-hub-backup-4.json automatically.') +
              '</div>' +
            '</div>' +
            '<div class="item-row-actions">' +
              (folderStatus.linked
                ? '<button type="button" class="btn btn-sm btn-primary" id="btn-folder-backup-now">Backup to Folder Now</button>' +
                  '<button type="button" class="btn btn-sm" id="btn-folder-link">Change</button>' +
                  '<button type="button" class="btn btn-sm btn-ghost" id="btn-folder-unlink">Unlink</button>'
                : '<button type="button" class="btn btn-sm btn-primary" id="btn-folder-link">Link Backup Folder</button>') +
            '</div>' +
          '</div>' +
          (folderStatus.linked
            ? '<label class="toggle-row">' +
                '<div>' +
                  '<div class="toggle-label-title">Periodic Folder Sync (Every 10 min)</div>' +
                  '<div class="toggle-label-desc">Automatically writes the next rotating backup file while the app stays open and changes occur.</div>' +
                '</div>' +
                '<input type="checkbox" class="switch-input" id="cfg-periodic-sync"' + (cfg.periodicFolderSync ? ' checked' : '') + '>' +
              '</label>'
            : '') +
        '</div>';
    }

    container.innerHTML =
      saveBarHtml +

      /* Appearance (Dark / Light Mode) */
      '<div class="surface-card">' +
        '<div class="section-header" style="margin-bottom:10px;">' +
          '<div>' +
            '<h2 class="section-title">Appearance</h2>' +
            '<div class="section-subtitle">Dark Lord (Black, Deep Red, Burnt Orange &amp; Gray) or Fantasy Adventure (Sky Blue, Emerald &amp; Gold)</div>' +
          '</div>' +
        '</div>' +
        '<div class="segmented segmented-full" role="group" aria-label="Color theme">' +
          '<button type="button" class="seg-btn' + (cfg.theme !== 'light' ? ' is-active' : '') + '" id="cfg-theme-dark" data-cfg-theme="dark">' +
            '<span class="theme-btn-inner">' +
              '<span>Mordor: Dark Lord</span>' +
              '<span class="theme-swatches" aria-hidden="true">' +
                '<span class="theme-swatch" style="background:#070709;"></span>' +
                '<span class="theme-swatch" style="background:#AE1B2A;"></span>' +
                '<span class="theme-swatch" style="background:#C65218;"></span>' +
                '<span class="theme-swatch" style="background:#585C66;"></span>' +
              '</span>' +
            '</span>' +
          '</button>' +
          '<button type="button" class="seg-btn' + (cfg.theme === 'light' ? ' is-active' : '') + '" id="cfg-theme-light" data-cfg-theme="light">' +
            '<span class="theme-btn-inner">' +
              '<span>Fantasy Adventure</span>' +
              '<span class="theme-swatches" aria-hidden="true">' +
                '<span class="theme-swatch" style="background:#D9EBFC;"></span>' +
                '<span class="theme-swatch" style="background:#2274C7;"></span>' +
                '<span class="theme-swatch" style="background:#1F8F54;"></span>' +
                '<span class="theme-swatch" style="background:#E2B652;"></span>' +
              '</span>' +
            '</span>' +
          '</button>' +
        '</div>' +
      '</div>' +

      /* House Rules */
      '<div class="surface-card">' +
        '<div class="section-header">' +
          '<div>' +
            '<h3 class="section-title">5e Critical Hit Rule</h3>' +
            '<div class="section-subtitle">Controls Step 3 split-damage math for every Critical Hit</div>' +
          '</div>' +
        '</div>' +
        '<div class="rule-option-list" id="crit-rule-selector">' + critRadiosHtml + '</div>' +
      '</div>' +

      '<div class="surface-card">' +
        '<div class="section-header">' +
          '<h3 class="section-title">Tabletop House Rules</h3>' +
        '</div>' +
        '<div class="list-stack">' +
          '<div class="toggle-row" style="flex-wrap:wrap;">' +
            '<div style="flex:1 1 180px;">' +
              '<div class="toggle-label-title">Enemy Initiative Grouping</div>' +
              '<div class="toggle-label-desc">Cluster minions onto one shared turn while flagging bosses as Solo exceptions.</div>' +
            '</div>' +
            '<div class="segmented">' +
              '<button type="button" class="seg-btn' + (cfg.enemyInitiativeMode !== 'clustered' ? ' is-active' : '') + '" data-cfg-enemy-init="individual">Individual</button>' +
              '<button type="button" class="seg-btn' + (cfg.enemyInitiativeMode === 'clustered' ? ' is-active' : '') + '" data-cfg-enemy-init="clustered">Clustered</button>' +
            '</div>' +
          '</div>' +

          '<label class="toggle-row">' +
            '<div>' +
              '<div class="toggle-label-title">Nat 20 Auto-Hit &amp; Nat 1 Auto-Miss</div>' +
              '<div class="toggle-label-desc">Standard 5e rule: Natural 20 always crits, Natural 1 always misses regardless of AC.</div>' +
            '</div>' +
            '<input type="checkbox" class="switch-input" id="cfg-nat20"' + (cfg.nat20AutoHit ? ' checked' : '') + '>' +
          '</label>' +

          '<label class="toggle-row">' +
            '<div>' +
              '<div class="toggle-label-title">Auto Concentration Save DC Toast</div>' +
              '<div class="toggle-label-desc">Shows exact DC = max(10, floor(dmg / 2)) with 1-click Roll CON Save.</div>' +
            '</div>' +
            '<input type="checkbox" class="switch-input" id="cfg-conc-toast"' + (cfg.autoConcentrationToast ? ' checked' : '') + '>' +
          '</label>' +

          '<div class="toggle-row" style="flex-wrap:wrap;">' +
            '<div style="flex:1 1 180px;">' +
              '<div class="toggle-label-title">Cloned Enemy Initiative Mode</div>' +
              '<div class="toggle-label-desc">How + Copy assigns initiative to duplicated monsters (in Individual mode).</div>' +
            '</div>' +
            '<div class="segmented">' +
              '<button type="button" class="seg-btn' + (cfg.cloneInitiativeMode === 'individual' ? ' is-active' : '') + '" data-cfg-clone-init="individual">Individual</button>' +
              '<button type="button" class="seg-btn' + (cfg.cloneInitiativeMode === 'shared' ? ' is-active' : '') + '" data-cfg-clone-init="shared">Shared Group</button>' +
            '</div>' +
          '</div>' +

          '<div class="toggle-row" style="flex-wrap:wrap;">' +
            '<div style="flex:1 1 180px;">' +
              '<div class="toggle-label-title">Default Roll Math Visibility</div>' +
              '<div class="toggle-label-desc">Start roll cards compact or expanded with individual die faces.</div>' +
            '</div>' +
            '<div class="segmented">' +
              '<button type="button" class="seg-btn' + (cfg.defaultRollMathVisible === 'compact' ? ' is-active' : '') + '" data-cfg-roll-math="compact">Compact</button>' +
              '<button type="button" class="seg-btn' + (cfg.defaultRollMathVisible === 'detailed' ? ' is-active' : '') + '" data-cfg-roll-math="detailed">Show Dice</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="card-quick-btns" style="margin-top:14px;justify-content:flex-end;">' +
          (dirty ? '<button type="button" class="btn btn-sm" id="btn-discard-settings-bottom">Discard Changes</button>' : '') +
          '<button type="button" class="btn btn-primary" id="btn-save-settings-bottom"' + (dirty ? '' : ' disabled') + '>Save Settings</button>' +
        '</div>' +
      '</div>' +

      /* Layer 1: Rolling Snapshots */
      '<div class="surface-card">' +
        '<div class="section-header">' +
          '<div>' +
            '<h3 class="section-title">Layer 1: 4-Slot Rolling Snapshots</h3>' +
            '<div class="section-subtitle">Stored locally in IndexedDB (overwrites oldest after 4)</div>' +
          '</div>' +
          '<button type="button" class="btn btn-sm btn-primary" id="btn-take-snapshot">Take Snapshot Now</button>' +
        '</div>' +
        snapshotsHtml +
      '</div>' +

      /* Layer 2: External File Backups */
      '<div class="surface-card">' +
        '<div class="section-header">' +
          '<div>' +
            '<h3 class="section-title">Layer 2: External File Backup</h3>' +
            '<div class="section-subtitle">Keep portable JSON backups outside browser storage</div>' +
          '</div>' +
        '</div>' +
        backupBannerHtml +
        folderSectionHtml +
        '<div class="card-quick-btns">' +
          '<button type="button" class="btn btn-primary" id="btn-export-json">Export Backup (.json)</button>' +
          '<button type="button" class="btn" id="btn-import-json-trigger">Import Backup (.json)</button>' +
          '<input type="file" id="import-json-file-input" accept=".json,application/json" class="hidden">' +
        '</div>' +
      '</div>' +

      /* Sample Data & Clear All */
      '<div class="surface-card">' +
        '<div class="section-header">' +
          '<div>' +
            '<h3 class="section-title">Starter Sample Data &amp; Reset</h3>' +
            '<div class="section-subtitle">Quickly test features or wipe everything clean</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-quick-btns">' +
          '<button type="button" class="btn" id="btn-settings-load-sample">Load Sample Encounter</button>' +
          '<button type="button" class="btn btn-danger-soft" id="btn-settings-clear-all">Clear All Data</button>' +
        '</div>' +
      '</div>';

    bindEvents(container);
  }

  function bindEvents(container) {
    const stageChange = function (patch) {
      const cfg = ensureDraft();
      Object.assign(cfg, patch);
      render(container);
    };

    const doSave = function () {
      commitDraft(container);
    };

    const doDiscard = function () {
      resetDraft();
      render(container);
      U().showToast({ title: 'Changes Discarded', message: 'Reverted to your saved settings.', duration: 2000 });
    };

    ['#btn-save-settings', '#btn-save-settings-bottom'].forEach(function (sel) {
      const btn = container.querySelector(sel);
      if (btn) btn.addEventListener('click', doSave);
    });

    ['#btn-discard-settings', '#btn-discard-settings-bottom'].forEach(function (sel) {
      const btn = container.querySelector(sel);
      if (btn) btn.addEventListener('click', doDiscard);
    });

    container.querySelectorAll('[data-cfg-theme]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        stageChange({ theme: btn.getAttribute('data-cfg-theme') === 'light' ? 'light' : 'dark' });
      });
    });

    container.querySelectorAll('[data-cfg-enemy-init]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        stageChange({ enemyInitiativeMode: btn.getAttribute('data-cfg-enemy-init') });
      });
    });

    container.querySelectorAll('input[name="crit-rule"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) {
          stageChange({ critRule: radio.value });
        }
      });
    });

    const nat20 = container.querySelector('#cfg-nat20');
    if (nat20) {
      nat20.addEventListener('change', function () {
        stageChange({ nat20AutoHit: nat20.checked });
      });
    }

    const conc = container.querySelector('#cfg-conc-toast');
    if (conc) {
      conc.addEventListener('change', function () {
        stageChange({ autoConcentrationToast: conc.checked });
      });
    }

    container.querySelectorAll('[data-cfg-clone-init]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        stageChange({ cloneInitiativeMode: btn.getAttribute('data-cfg-clone-init') });
      });
    });

    container.querySelectorAll('[data-cfg-roll-math]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        stageChange({ defaultRollMathVisible: btn.getAttribute('data-cfg-roll-math') });
      });
    });

    const btnSnap = container.querySelector('#btn-take-snapshot');
    if (btnSnap) {
      btnSnap.addEventListener('click', function () {
        B().createSnapshot('manual').then(function () {
          U().showToast({ title: 'Snapshot Saved', message: 'Added to your 4-slot rolling snapshot history.', tone: 'success' });
          render(container);
        });
      });
    }

    container.querySelectorAll('[data-restore-snap]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const snapId = btn.getAttribute('data-restore-snap');
        U().openModal({
          title: 'Restore Rolling Snapshot?',
          bodyHtml: '<p class="section-subtitle">This will replace your current encounter, party, notes, and settings with the selected snapshot.</p>',
          footerHtml:
            '<button type="button" class="btn" id="restore-cancel">Cancel</button>' +
            '<button type="button" class="btn btn-primary" id="restore-confirm">Restore Snapshot</button>',
          onMount: function (root) {
            root.querySelector('#restore-cancel').addEventListener('click', U().closeModal);
            root.querySelector('#restore-confirm').addEventListener('click', function () {
              B().restoreSnapshot(snapId).then(function () {
                resetDraft();
                U().closeModal();
                U().showToast({ title: 'Snapshot Restored', message: 'Your DM Hub state has been restored.', tone: 'success' });
                render(container);
              }).catch(function (err) {
                U().showToast({ title: 'Restore Failed', message: err.message, tone: 'danger' });
              });
            });
          }
        });
      });
    });

    // Folder Backup Controls (Chrome/Edge)
    const btnFolderLink = container.querySelector('#btn-folder-link');
    if (btnFolderLink) {
      btnFolderLink.addEventListener('click', function () {
        B().linkBackupFolder().then(function (handle) {
          U().showToast({ title: 'Backup Folder Linked', message: 'Connected to "' + handle.name + '".', tone: 'success' });
          render(container);
        }).catch(function (err) {
          if (err && err.name !== 'AbortError') {
            U().showToast({ title: 'Could Not Link Folder', message: err.message, tone: 'warning' });
          }
        });
      });
    }

    const btnFolderNow = container.querySelector('#btn-folder-backup-now');
    if (btnFolderNow) {
      btnFolderNow.addEventListener('click', function () {
        B().backupToFolderNow().then(function (info) {
          U().showToast({ title: 'Folder Backup Complete', message: 'Saved ' + info.filename + ' in "' + info.folderName + '".', tone: 'success' });
          render(container);
        }).catch(function (err) {
          U().showToast({ title: 'Folder Backup Failed', message: err.message, tone: 'warning' });
        });
      });
    }

    const btnFolderUnlink = container.querySelector('#btn-folder-unlink');
    if (btnFolderUnlink) {
      btnFolderUnlink.addEventListener('click', function () {
        B().unlinkBackupFolder().then(function () {
          U().showToast({ title: 'Backup Folder Unlinked', duration: 2200 });
          render(container);
        });
      });
    }

    const chkSync = container.querySelector('#cfg-periodic-sync');
    if (chkSync) {
      chkSync.addEventListener('change', function () {
        stageChange({ periodicFolderSync: chkSync.checked });
      });
    }

    // Universal JSON Export / Import
    const doExport = function () {
      const filename = B().exportBackupJson();
      U().showToast({ title: 'Backup Exported', message: 'Downloaded ' + filename, tone: 'success' });
      render(container);
    };

    const btnExport = container.querySelector('#btn-export-json');
    if (btnExport) btnExport.addEventListener('click', doExport);
    const btnBannerExport = container.querySelector('#btn-banner-export');
    if (btnBannerExport) btnBannerExport.addEventListener('click', doExport);

    const btnImport = container.querySelector('#btn-import-json-trigger');
    const fileInput = container.querySelector('#import-json-file-input');
    if (btnImport && fileInput) {
      btnImport.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        B().importBackupJsonFile(file).then(function () {
          resetDraft();
          U().showToast({ title: 'Backup Imported', message: 'Restored all data from ' + file.name, tone: 'success' });
          render(container);
        }).catch(function (err) {
          U().showToast({ title: 'Import Failed', message: err.message, tone: 'danger' });
        });
        fileInput.value = '';
      });
    }

    // Starter Sample Data & Clear All
    const btnSample = container.querySelector('#btn-settings-load-sample');
    if (btnSample) {
      btnSample.addEventListener('click', function () {
        S().loadSampleData();
        U().showToast({ title: 'Sample Encounter Loaded', message: 'Roadside Goblin Ambush + 3 PCs + Starter Bestiary ready.', tone: 'success' });
        if (DMHub.App) DMHub.App.openSection('combat');
      });
    }

    const btnClear = container.querySelector('#btn-settings-clear-all');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        U().openModal({
          title: 'Clear All DM Hub Data?',
          bodyHtml: '<p class="section-subtitle">This clears your active encounter, party roster, bestiary, prepared encounters, notes, and roll log from this browser. Rolling snapshots remain untouched until overwritten.</p>',
          footerHtml:
            '<button type="button" class="btn" id="clear-cancel">Cancel</button>' +
            '<button type="button" class="btn btn-danger" id="clear-confirm">Clear Everything</button>',
          onMount: function (root) {
            root.querySelector('#clear-cancel').addEventListener('click', U().closeModal);
            root.querySelector('#clear-confirm').addEventListener('click', function () {
              resetDraft();
              S().clearAllData();
              U().closeModal();
              U().showToast({ title: 'All Data Cleared', message: 'DM Hub has been reset to a clean slate.' });
            });
          }
        });
      });
    }
  }

  DMHub.SettingsView = {
    render: render,
    resetDraft: resetDraft
  };
})(window.DMHub = window.DMHub || {});
