/* ==========================================================================
   DM Hub — Application Bootstrap, Navigation, Drawers, Wizard & Service Worker
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const DESKTOP_BP = 1024;
  let activeMobileTab = 'combat';
  let activeDesktopDrawer = null; // 'prep' | 'notes' | 'settings' | null
  let rollLogOpen = false;
  let wasDesktop = window.innerWidth >= DESKTOP_BP;

  function isDesktop() {
    return window.innerWidth >= DESKTOP_BP;
  }

  function syncBackdrop() {
    const backdrop = document.getElementById('drawer-backdrop');
    if (!backdrop) return;
    const anyOpen = rollLogOpen || Boolean(activeDesktopDrawer);
    backdrop.classList.toggle('is-open', anyOpen);
  }

  function setRollLogOpen(open) {
    rollLogOpen = Boolean(open);
    if (rollLogOpen && activeDesktopDrawer) {
      closeUtilityDrawer(false);
    }
    const drawer = document.getElementById('roll-log-drawer');
    const toggleBtn = document.getElementById('btn-toggle-roll-log');
    if (drawer) {
      drawer.classList.toggle('is-open', rollLogOpen);
      drawer.setAttribute('aria-hidden', rollLogOpen ? 'false' : 'true');
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', rollLogOpen ? 'true' : 'false');
    }
    if (rollLogOpen) {
      DMHub.RollLogView.render();
    }
    syncBackdrop();
  }

  function closeUtilityDrawer(updateBackdrop) {
    if (activeDesktopDrawer === 'settings' && DMHub.SettingsView && DMHub.SettingsView.resetDraft) {
      DMHub.SettingsView.resetDraft();
    }
    activeDesktopDrawer = null;
    const drawer = document.getElementById('utility-drawer');
    const body = document.getElementById('utility-drawer-body');
    if (drawer) {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (body) body.innerHTML = '';
    document.querySelectorAll('[data-desktop-drawer]').forEach(function (btn) {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-ghost');
    });
    if (updateBackdrop !== false) syncBackdrop();
  }

  function renderUtilityInto(sectionName, targetEl) {
    if (sectionName === 'prep') DMHub.PrepView.render(targetEl);
    else if (sectionName === 'notes') DMHub.NotesView.render(targetEl);
    else if (sectionName === 'settings') DMHub.SettingsView.render(targetEl);
  }

  function openDesktopUtilityDrawer(sectionName) {
    if (rollLogOpen) setRollLogOpen(false);

    if (activeDesktopDrawer === sectionName) {
      closeUtilityDrawer();
      return;
    }

    // Clear mobile tab containers so IDs stay unique
    ['view-prep', 'view-notes', 'view-settings'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });

    activeDesktopDrawer = sectionName;
    const titleMap = {
      prep: 'Prep Library',
      notes: 'Notes & Name Generator',
      settings: 'House Rules & Backups'
    };

    const drawer = document.getElementById('utility-drawer');
    const titleEl = document.getElementById('utility-drawer-title');
    const bodyEl = document.getElementById('utility-drawer-body');
    if (titleEl) titleEl.textContent = titleMap[sectionName] || '';
    if (bodyEl) renderUtilityInto(sectionName, bodyEl);
    if (drawer) {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
    }

    document.querySelectorAll('[data-desktop-drawer]').forEach(function (btn) {
      const match = btn.getAttribute('data-desktop-drawer') === sectionName;
      btn.classList.toggle('btn-primary', match);
      btn.classList.toggle('btn-ghost', !match);
    });

    syncBackdrop();
  }

  function setMobileTab(tabName) {
    if (activeMobileTab === 'settings' && tabName !== 'settings' && DMHub.SettingsView && DMHub.SettingsView.resetDraft) {
      DMHub.SettingsView.resetDraft();
    }
    activeMobileTab = tabName;
    closeUtilityDrawer(false);
    setRollLogOpen(false);

    const panels = ['combat', 'roller', 'prep', 'notes', 'settings'];
    panels.forEach(function (name) {
      const panel = document.getElementById('view-' + name);
      if (panel) {
        panel.classList.toggle('is-mobile-active', name === tabName);
      }
      const navBtn = document.querySelector('[data-mobile-tab="' + name + '"]');
      if (navBtn) {
        navBtn.classList.toggle('is-active', name === tabName);
      }
    });

    const overviewEl = document.getElementById('view-overview');
    if (overviewEl) {
      overviewEl.classList.toggle('is-mobile-visible', tabName === 'combat');
    }

    // Render active mobile utility tab cleanly
    if (tabName === 'prep' || tabName === 'notes' || tabName === 'settings') {
      ['prep', 'notes', 'settings'].forEach(function (other) {
        if (other !== tabName) {
          const el = document.getElementById('view-' + other);
          if (el) el.innerHTML = '';
        }
      });
      renderUtilityInto(tabName, document.getElementById('view-' + tabName));
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function applyTheme() {
    const theme = DMHub.Store.getState().settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'light' ? '#E1F0FD' : '#141518');
    }
  }

  function openSection(name) {
    if (isDesktop()) {
      if (name === 'combat' || name === 'roller') {
        closeUtilityDrawer();
        setRollLogOpen(false);
      } else {
        openDesktopUtilityDrawer(name);
      }
    } else {
      setMobileTab(name);
    }
  }

  function syncBackupReminderBadges() {
    const due = DMHub.Backup.isBackupReminderDue();
    const dDot = document.getElementById('desktop-backup-dot');
    const mDot = document.getElementById('mobile-backup-dot');
    if (dDot) dDot.classList.toggle('hidden', !due);
    if (mDot) mDot.classList.toggle('hidden', !due);
  }

  function renderFirstRunBackupWizardBanner() {
    const slot = document.getElementById('first-run-wizard-slot');
    if (!slot) return;
    const state = DMHub.Store.getState();

    if (!DMHub.Backup.supportsFolderBackup() || state.hasSeenBackupWizard) {
      slot.innerHTML = '';
      return;
    }

    DMHub.Backup.getFolderStatus().then(function (status) {
      if (status.linked || DMHub.Store.getState().hasSeenBackupWizard) {
        slot.innerHTML = '';
        return;
      }

      slot.innerHTML =
        '<div class="status-banner status-banner-amber" id="backup-wizard-banner" style="margin-bottom:14px;">' +
          '<div>' +
            '<strong>First-Time Backup Setup:</strong> Link a local folder on your computer to keep 4 automatic rotating backup files (<span class="mono">dm-hub-backup-1..4.json</span>).' +
          '</div>' +
          '<div class="card-quick-btns">' +
            '<button type="button" class="btn btn-sm btn-primary" id="btn-wizard-pick-folder">Pick Backup Folder</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" id="btn-wizard-skip">Skip for Now</button>' +
          '</div>' +
        '</div>';

      const pickBtn = slot.querySelector('#btn-wizard-pick-folder');
      const skipBtn = slot.querySelector('#btn-wizard-skip');

      if (pickBtn) {
        pickBtn.addEventListener('click', function () {
          DMHub.Backup.linkBackupFolder().then(function (handle) {
            slot.innerHTML = '';
            DMHub.UI.showToast({
              title: 'Backup Folder Linked',
              message: 'Connected to "' + handle.name + '". Rotating 4-file backups are ready!',
              tone: 'success'
            });
          }).catch(function (err) {
            if (err && err.name !== 'AbortError') {
              DMHub.UI.showToast({ title: 'Folder Setup Skipped', message: err.message, tone: 'warning' });
            }
          });
        });
      }

      if (skipBtn) {
        skipBtn.addEventListener('click', function () {
          DMHub.Store.markBackupWizardSeen();
          slot.innerHTML = '';
        });
      }
    });
  }

  function renderAllActiveViews(scope) {
    applyTheme();

    if (scope === 'all' || scope === 'encounter' || scope === 'prep' || scope === 'settings') {
      if (DMHub.OverviewView) DMHub.OverviewView.render();
      DMHub.EncounterView.render();
      DMHub.RollerView.render();
    }

    DMHub.RollLogView.render();

    if (isDesktop() && activeDesktopDrawer) {
      const bodyEl = document.getElementById('utility-drawer-body');
      const activeEl = document.activeElement;
      const typingInNotes = scope === 'notes' && activeEl && activeEl.id === 'emergency-scratchpad';
      if (bodyEl && !typingInNotes && (scope === 'all' || scope === activeDesktopDrawer || scope === 'backup' || scope === 'settings')) {
        renderUtilityInto(activeDesktopDrawer, bodyEl);
      }
    } else if (!isDesktop()) {
      if (activeMobileTab === 'prep' && (scope === 'all' || scope === 'prep' || scope === 'encounter')) {
        DMHub.PrepView.render(document.getElementById('view-prep'));
      } else if (activeMobileTab === 'notes' && (scope === 'all' || scope === 'notes')) {
        // Avoid clobbering active textarea focus during typing
        const activeEl = document.activeElement;
        if (!activeEl || activeEl.id !== 'emergency-scratchpad') {
          DMHub.NotesView.render(document.getElementById('view-notes'));
        }
      } else if (activeMobileTab === 'settings' && (scope === 'all' || scope === 'settings' || scope === 'backup')) {
        DMHub.SettingsView.render(document.getElementById('view-settings'));
      }
    }

    syncBackupReminderBadges();
  }

  function registerServiceWorkerSafely() {
    if (location.protocol !== 'file:' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function () {
        // Silently ignore if offline or unsupported host
      });
    }
  }

  function init() {
    // Wire Desktop Drawer Nav
    document.querySelectorAll('[data-desktop-drawer]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openDesktopUtilityDrawer(btn.getAttribute('data-desktop-drawer'));
      });
    });

    // Wire Mobile Bottom Nav
    document.querySelectorAll('[data-mobile-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setMobileTab(btn.getAttribute('data-mobile-tab'));
      });
    });

    // Wire Roll Log Drawer Toggle
    const btnToggleLog = document.getElementById('btn-toggle-roll-log');
    if (btnToggleLog) {
      btnToggleLog.addEventListener('click', function () {
        setRollLogOpen(!rollLogOpen);
      });
    }

    const btnCloseLog = document.getElementById('btn-close-roll-log');
    if (btnCloseLog) {
      btnCloseLog.addEventListener('click', function () { setRollLogOpen(false); });
    }

    const btnCloseUtil = document.getElementById('btn-close-utility-drawer');
    if (btnCloseUtil) {
      btnCloseUtil.addEventListener('click', function () { closeUtilityDrawer(); });
    }

    const backdrop = document.getElementById('drawer-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        setRollLogOpen(false);
        closeUtilityDrawer();
      });
    }

    // Escape key closes open modal or drawers
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot && !modalRoot.classList.contains('hidden')) {
          DMHub.UI.closeModal();
          return;
        }
        if (rollLogOpen) setRollLogOpen(false);
        if (activeDesktopDrawer) closeUtilityDrawer();
      }
    });

    // Handle viewport resize across desktop/mobile breakpoint
    window.addEventListener('resize', function () {
      const nowDesktop = isDesktop();
      if (nowDesktop !== wasDesktop) {
        wasDesktop = nowDesktop;
        if (nowDesktop) {
          ['view-prep', 'view-notes', 'view-settings'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
          });
        } else {
          closeUtilityDrawer();
          setMobileTab(activeMobileTab);
        }
      }
    });

    // Subscribe to Store & Backup updates
    DMHub.Store.subscribe(function (_state, scope) {
      renderAllActiveViews(scope);
    });

    DMHub.Backup.subscribe(function () {
      syncBackupReminderBadges();
      if (isDesktop() && activeDesktopDrawer === 'settings') {
        DMHub.SettingsView.render(document.getElementById('utility-drawer-body'));
      } else if (!isDesktop() && activeMobileTab === 'settings') {
        DMHub.SettingsView.render(document.getElementById('view-settings'));
      }
    });

    // Initial render
    renderAllActiveViews('all');
    renderFirstRunBackupWizardBanner();
    DMHub.Backup.startTimers();
    registerServiceWorkerSafely();
  }

  DMHub.App = {
    openSection: openSection,
    setRollLogOpen: setRollLogOpen
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.DMHub = window.DMHub || {});
