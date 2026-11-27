/* ==========================================================================
   DM Hub — Battlefield Overview Panel (Left of Main Rolodex)
   At-a-glance Party & Enemy HP status with color-coded health indicators
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const U = function () { return DMHub.UI; };
  const S = function () { return DMHub.Store; };

  function healthStatus(hp, maxHp) {
    if (hp <= 0) return { cls: 'status-dead', barCls: 'hp-critical', label: 'Down' };
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    if (ratio <= 0.25) return { cls: 'status-critical', barCls: 'hp-critical', label: 'Critical' };
    if (ratio <= 0.5) return { cls: 'status-bloodied', barCls: 'hp-bloodied', label: 'Bloodied' };
    return { cls: 'status-healthy', barCls: 'hp-healthy', label: 'Healthy' };
  }

  function renderRow(c, isActiveTurn, esc) {
    const st = healthStatus(Number(c.hp) || 0, Number(c.maxHp) || 1);
    const pct = c.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((c.hp / c.maxHp) * 100))) : 0;
    const condCount = Array.isArray(c.conditions) ? c.conditions.length : 0;
    const tempStr = Number(c.tempHp) > 0 ? ' +' + c.tempHp : '';

    return (
      '<button type="button" class="overview-row ' + st.cls + (isActiveTurn ? ' is-active-turn' : '') + '" data-jump-cmb="' + esc(c.id) + '" title="Jump to ' + esc(c.name) + '">' +
        '<div class="overview-row-top">' +
          '<span class="overview-name">' + (isActiveTurn ? '&#10022; ' : '') + esc(c.name) + '</span>' +
          '<span class="overview-hp tabular">' + esc(c.hp) + '/' + esc(c.maxHp) + esc(tempStr) + '</span>' +
        '</div>' +
        '<div class="overview-bar-track"><div class="overview-bar-fill ' + st.barCls + '" style="width:' + pct + '%"></div></div>' +
        '<div class="overview-meta">' +
          '<span>AC ' + esc(c.ac) + (condCount ? ' &bull; ' + condCount + ' cond' : '') + '</span>' +
          '<span>' + esc(st.label) + '</span>' +
        '</div>' +
      '</button>'
    );
  }

  function renderGroup(title, list, activeIds, esc) {
    const alive = list.filter(function (c) { return Number(c.hp) > 0; }).length;
    const body = list.length
      ? '<div class="overview-list">' +
          list.map(function (c) { return renderRow(c, Boolean(activeIds && activeIds[c.id]), esc); }).join('') +
        '</div>'
      : '<div class="section-subtitle" style="padding:4px 0;">None in combat</div>';

    return (
      '<div>' +
        '<div class="overview-group-head">' +
          '<span>' + esc(title) + '</span>' +
          '<span class="mono">' + alive + '/' + list.length + ' up</span>' +
        '</div>' +
        body +
      '</div>'
    );
  }

  function render() {
    const container = document.getElementById('view-overview');
    if (!container) return;

    const state = S().getState();
    const enc = state.encounter;
    const combatants = enc.combatants || [];
    const esc = U().escapeHtml;

    if (!combatants.length) {
      container.innerHTML =
        '<section class="surface-card overview-card" aria-label="Battlefield Overview">' +
          '<div class="section-header" style="margin-bottom:6px;">' +
            '<h2 class="section-title" style="font-size:1rem;">Battlefield Overview</h2>' +
          '</div>' +
          '<p class="section-subtitle">Party and enemy HP status will appear here at a glance once combatants enter the fray.</p>' +
        '</section>';
      return;
    }

    const activeIndices = enc.mode === 'initiative' && S().getActiveTurnIndices
      ? S().getActiveTurnIndices()
      : [];
    const activeIds = {};
    activeIndices.forEach(function (idx) {
      if (combatants[idx]) activeIds[combatants[idx].id] = true;
    });

    const pcs = combatants.filter(function (c) { return c.isPc; });
    const enemies = combatants.filter(function (c) { return !c.isPc; });

    container.innerHTML =
      '<section class="surface-card overview-card" aria-label="Battlefield Overview">' +
        '<div class="section-header" style="margin-bottom:10px;">' +
          '<div>' +
            '<h2 class="section-title" style="font-size:1rem;">Battlefield Overview</h2>' +
            '<div class="section-subtitle">At-a-glance status &bull; Tap to locate</div>' +
          '</div>' +
        '</div>' +
        '<div class="overview-groups-wrap">' +
          renderGroup('Party', pcs, activeIds, esc) +
          renderGroup('Enemies', enemies, activeIds, esc) +
        '</div>' +
      '</section>';

    container.querySelectorAll('[data-jump-cmb]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-jump-cmb');
        const card = document.querySelector('[data-combatant-card="' + id + '"]');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('is-flash');
          setTimeout(function () { card.classList.remove('is-flash'); }, 900);
        }
      });
    });
  }

  DMHub.OverviewView = {
    render: render
  };
})(window.DMHub = window.DMHub || {});
