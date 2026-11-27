/* ==========================================================================
   DM Hub — Shared UI Utilities (Escaping, Modals, Toasts, Condition Popover)
   ========================================================================== */

(function (DMHub) {
  'use strict';

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return 'Never';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return 'Never';
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /* ------------------------------------------------------------------------
     Non-Blocking Toast Queue
     ------------------------------------------------------------------------ */

  function showToast(options) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const opts = typeof options === 'string' ? { title: options } : (options || {});
    const tone = opts.tone || 'default'; // default | warning | success | danger
    const duration = typeof opts.duration === 'number' ? opts.duration : 5200;

    const toast = document.createElement('div');
    toast.className = 'toast' + (tone !== 'default' ? ' toast-' + tone : '');
    toast.setAttribute('role', 'status');

    const actionList = Array.isArray(opts.actions)
      ? opts.actions
      : (opts.actionLabel ? [{ label: opts.actionLabel, variant: 'btn-primary', onClick: opts.onAction }] : []);

    let actionsHtml = '';
    if (actionList.length) {
      actionsHtml = '<div class="toast-actions">' +
        actionList.map(function (act, idx) {
          const variant = act.variant || 'btn-primary';
          return '<button type="button" class="btn btn-sm ' + escapeHtml(variant) + '" data-toast-act="' + idx + '">' +
            escapeHtml(act.label) + '</button>';
        }).join('') +
      '</div>';
    }

    toast.innerHTML =
      '<div class="toast-body">' +
        (opts.title ? '<div class="toast-title">' + escapeHtml(opts.title) + '</div>' : '') +
        (opts.message ? '<div class="toast-message">' + escapeHtml(opts.message) + '</div>' : '') +
        actionsHtml +
      '</div>' +
      '<button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Dismiss notification" data-toast-close>&times;</button>';

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }

    const closeBtn = toast.querySelector('[data-toast-close]');
    if (closeBtn) closeBtn.addEventListener('click', dismiss);

    actionList.forEach(function (act, idx) {
      const btn = toast.querySelector('[data-toast-act="' + idx + '"]');
      if (btn && typeof act.onClick === 'function') {
        btn.addEventListener('click', function () {
          act.onClick();
          dismiss();
        });
      }
    });

    while (container.children.length >= 3) {
      container.removeChild(container.firstElementChild);
    }

    container.appendChild(toast);
    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  function showConcentrationToast(combatant, damageTaken, dc) {
    if (!combatant) return;
    showToast({
      title: 'Concentration Check — DC ' + dc,
      message: combatant.name + ' took ' + damageTaken + ' damage while Concentrating.',
      tone: 'warning',
      duration: 10000,
      actions: [
        {
          label: 'Roll CON Save',
          variant: 'btn-primary',
          onClick: function () {
            const conScore = combatant.abilities && Number.isFinite(Number(combatant.abilities.con))
              ? Number(combatant.abilities.con)
              : 10;
            const conMod = DMHub.DiceEngine.abilityMod(conScore);
            const rawRoll = Math.floor(Math.random() * 20) + 1;
            const total = rawRoll + conMod;
            const passed = total >= dc;

            DMHub.Store.addRollLogEntry({
              kind: 'concentration',
              title: 'Concentration Save — ' + combatant.name + ' (DC ' + dc + ')',
              summary: (passed ? 'PASS' : 'FAIL') + ' (' + total + ' vs. DC ' + dc + ')',
              breakdown: 'CON Save: d20 [' + rawRoll + '] ' + DMHub.DiceEngine.formatSigned(conMod) + ' = ' + total + ' vs. DC ' + dc
            });

            if (!passed) {
              DMHub.Store.toggleCondition(combatant.id, 'Concentrating');
            }

            showToast({
              title: (passed ? 'Concentration Held!' : 'Concentration Broken!'),
              message: combatant.name + ' rolled ' + total + ' (d20 [' + rawRoll + '] ' + DMHub.DiceEngine.formatSigned(conMod) + ') vs. DC ' + dc + '.',
              tone: passed ? 'success' : 'danger',
              duration: 5000
            });
          }
        },
        {
          label: 'Drop Conc.',
          variant: 'btn-danger-soft',
          onClick: function () {
            DMHub.Store.toggleCondition(combatant.id, 'Concentrating');
          }
        }
      ]
    });
  }

  /* ------------------------------------------------------------------------
     Modal Dialog Manager
     ------------------------------------------------------------------------ */

  let activeModalCloseHandler = null;

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = '';
    root.classList.add('hidden');
    if (activeModalCloseHandler) {
      const cb = activeModalCloseHandler;
      activeModalCloseHandler = null;
      cb();
    }
  }

  function openModal(options) {
    const root = document.getElementById('modal-root');
    if (!root) return;

    activeModalCloseHandler = options.onClose || null;
    root.classList.remove('hidden');
    root.innerHTML =
      '<div class="modal-backdrop" id="active-modal-backdrop">' +
        '<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="active-modal-title">' +
          '<div class="modal-header">' +
            '<h2 class="modal-title" id="active-modal-title">' + escapeHtml(options.title || '') + '</h2>' +
            '<button type="button" class="btn btn-ghost btn-icon" id="active-modal-close" aria-label="Close modal">&times;</button>' +
          '</div>' +
          '<div class="modal-body" id="active-modal-body">' + (options.bodyHtml || '') + '</div>' +
          (options.footerHtml ? '<div class="modal-footer" id="active-modal-footer">' + options.footerHtml + '</div>' : '') +
        '</div>' +
      '</div>';

    const backdrop = document.getElementById('active-modal-backdrop');
    const closeBtn = document.getElementById('active-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) closeModal();
      });
    }

    if (typeof options.onMount === 'function') {
      options.onMount(root);
    }
  }

  /* ------------------------------------------------------------------------
     Condition Rules Floating Popover
     ------------------------------------------------------------------------ */

  let popoverEl = null;

  function hideConditionPopover() {
    if (popoverEl && popoverEl.parentNode) {
      popoverEl.parentNode.removeChild(popoverEl);
    }
    popoverEl = null;
  }

  function showConditionPopover(anchorEl, conditionId, onRemove) {
    hideConditionPopover();

    const rule = DMHub.SRD.CONDITIONS_MAP[conditionId] || 'Standard D&D 5e condition.';
    const pop = document.createElement('div');
    pop.className = 'cond-popover';
    pop.setAttribute('role', 'tooltip');
    pop.innerHTML =
      '<div class="cond-popover-title">' + escapeHtml(conditionId) + '</div>' +
      '<div class="cond-popover-text">' + escapeHtml(rule) + '</div>' +
      '<div style="display:flex;justify-content:space-between;gap:8px;">' +
        '<button type="button" class="btn btn-sm btn-danger-soft" data-pop-remove>Remove</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-pop-close>Close</button>' +
      '</div>';

    document.body.appendChild(pop);
    popoverEl = pop;

    const rect = anchorEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;

    if (left + popRect.width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popRect.width - 12);
    }
    if (top + popRect.height > window.innerHeight - 12) {
      top = Math.max(12, rect.top - popRect.height - 8);
    }
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';

    pop.querySelector('[data-pop-close]').addEventListener('click', hideConditionPopover);
    pop.querySelector('[data-pop-remove]').addEventListener('click', function () {
      if (typeof onRemove === 'function') onRemove();
      hideConditionPopover();
    });
  }

  document.addEventListener('click', function (e) {
    if (popoverEl && !popoverEl.contains(e.target) && !e.target.closest('[data-cond-pill]')) {
      hideConditionPopover();
    }
  });

  DMHub.UI = {
    escapeHtml: escapeHtml,
    formatTime: formatTime,
    formatDateTime: formatDateTime,
    showToast: showToast,
    showConcentrationToast: showConcentrationToast,
    openModal: openModal,
    closeModal: closeModal,
    showConditionPopover: showConditionPopover,
    hideConditionPopover: hideConditionPopover
  };
})(window.DMHub = window.DMHub || {});
