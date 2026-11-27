/* ==========================================================================
   DM Hub — Hideable Roll Log Drawer (Last 50 Rolls + Die-by-Die Breakdowns)
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const U = function () { return DMHub.UI; };
  const S = function () { return DMHub.Store; };

  function render() {
    const body = document.getElementById('roll-log-drawer-body');
    const badge = document.getElementById('roll-log-count');
    const logs = S().getState().rollLog || [];

    if (badge) {
      badge.textContent = String(logs.length);
    }

    if (!body) return;
    const esc = U().escapeHtml;

    if (!logs.length) {
      body.innerHTML =
        '<div class="empty-state">' +
          '<h3 class="empty-state-title">No Rolls Logged Yet</h3>' +
          '<p class="empty-state-desc">Your last 50 attack batches, split-damage totals, and quick dice rolls will appear here with full die-by-die transparency.</p>' +
        '</div>';
      return;
    }

    body.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<span class="section-subtitle">Showing ' + logs.length + ' of max 50 recent rolls</span>' +
        '<button type="button" class="btn btn-sm btn-danger-soft" id="btn-clear-roll-log">Clear Log</button>' +
      '</div>' +
      '<div class="log-list">' +
        logs.map(function (entry) {
          return '<article class="log-entry">' +
            '<div class="log-entry-head">' +
              '<span class="log-entry-title">' + esc(entry.title) + '</span>' +
              '<span class="log-entry-time">' + esc(U().formatTime(entry.timestamp)) + '</span>' +
            '</div>' +
            '<div class="log-entry-summary">' + esc(entry.summary) + '</div>' +
            '<div class="log-entry-breakdown">' + esc(entry.breakdown) + '</div>' +
          '</article>';
        }).join('') +
      '</div>';

    const clearBtn = body.querySelector('#btn-clear-roll-log');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        S().clearRollLog();
      });
    }
  }

  DMHub.RollLogView = {
    render: render
  };
})(window.DMHub = window.DMHub || {});
