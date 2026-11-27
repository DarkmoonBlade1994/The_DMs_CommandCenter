/* ==========================================================================
   DM Hub — Prep Library View
   Saved Party Roster, Local Bestiary, and Prepared Encounter Library
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const U = function () { return DMHub.UI; };
  const S = function () { return DMHub.Store; };

  let activeSubTab = 'party'; // 'party' | 'bestiary' | 'encounters'
  let lastContainer = null;

  function openPcEditorModal(existingPc) {
    const esc = U().escapeHtml;
    U().openModal({
      title: existingPc ? 'Edit PC — ' + existingPc.name : 'Add Player Character',
      bodyHtml:
        '<div class="field-group"><label class="field-label" for="pc-name">Character Name</label>' +
          '<input type="text" id="pc-name" class="input" value="' + esc(existingPc ? existingPc.name : '') + '" placeholder="e.g., Bram Ironfoot"></div>' +
        '<div class="form-grid-2">' +
          '<div class="field-group"><label class="field-label" for="pc-ac">Armor Class (AC)</label>' +
            '<input type="number" inputmode="numeric" id="pc-ac" class="input tabular" value="' + esc(existingPc ? existingPc.ac : 15) + '"></div>' +
          '<div class="field-group"><label class="field-label" for="pc-hp">Max HP (Optional)</label>' +
            '<input type="number" inputmode="numeric" id="pc-hp" class="input tabular" value="' + esc(existingPc ? existingPc.maxHp : 24) + '"></div>' +
        '</div>' +
        '<div class="form-grid-2">' +
          '<div class="field-group"><label class="field-label" for="pc-pp">Passive Perception</label>' +
            '<input type="number" inputmode="numeric" id="pc-pp" class="input tabular" value="' + esc(existingPc ? existingPc.passivePerception : 12) + '"></div>' +
          '<div class="field-group"><label class="field-label" for="pc-init-mod">Initiative Mod</label>' +
            '<input type="number" inputmode="numeric" id="pc-init-mod" class="input tabular" value="' + esc(existingPc ? existingPc.initMod : 1) + '"></div>' +
        '</div>' +
        '<div class="field-group"><label class="field-label" for="pc-notes">Notes (Class, Resistances, Spells)</label>' +
          '<textarea id="pc-notes" class="textarea" style="min-height:70px;">' + esc(existingPc ? existingPc.notes : '') + '</textarea></div>',
      footerHtml:
        '<button type="button" class="btn" id="pc-cancel">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="pc-save">Save PC</button>',
      onMount: function (root) {
        root.querySelector('#pc-cancel').addEventListener('click', U().closeModal);
        root.querySelector('#pc-save').addEventListener('click', function () {
          const name = root.querySelector('#pc-name').value.trim();
          if (!name) {
            U().showToast({ title: 'Name required', message: 'Enter a character name.', tone: 'warning' });
            return;
          }
          S().savePc({
            id: existingPc ? existingPc.id : null,
            name: name,
            ac: Math.max(1, parseInt(root.querySelector('#pc-ac').value, 10) || 10),
            maxHp: Math.max(1, parseInt(root.querySelector('#pc-hp').value, 10) || 20),
            passivePerception: parseInt(root.querySelector('#pc-pp').value, 10) || 10,
            initMod: parseInt(root.querySelector('#pc-init-mod').value, 10) || 0,
            notes: root.querySelector('#pc-notes').value.trim()
          });
          U().closeModal();
          U().showToast({ title: 'PC Saved', message: name + ' updated in Party Roster.', tone: 'success' });
        });
      }
    });
  }

  function renderPartyTab(state, esc) {
    const party = state.party;
    const rows = party.length
      ? '<div class="list-stack">' +
          party.map(function (pc) {
            return '<div class="item-row">' +
              '<div class="item-row-main">' +
                '<div class="item-row-title">' + esc(pc.name) + '</div>' +
                '<div class="item-row-meta mono">AC ' + esc(pc.ac) + ' &bull; PP ' + esc(pc.passivePerception || 10) + ' &bull; HP ' + esc(pc.maxHp || 20) + '</div>' +
                (pc.notes ? '<div class="item-row-meta" style="margin-top:2px;">' + esc(pc.notes) + '</div>' : '') +
              '</div>' +
              '<div class="item-row-actions">' +
                '<button type="button" class="btn btn-sm btn-primary" data-drop-pc="' + esc(pc.id) + '">+ Combat</button>' +
                '<button type="button" class="btn btn-sm" data-edit-pc="' + esc(pc.id) + '">Edit</button>' +
                '<button type="button" class="btn btn-sm btn-danger-soft" data-del-pc="' + esc(pc.id) + '">Remove</button>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>'
      : '<div class="empty-state">' +
          '<h3 class="empty-state-title">No Party Members Yet</h3>' +
          '<p class="empty-state-desc">Store your PCs once so you can drop them into any encounter and target their AC directly in the Attack Resolver.</p>' +
        '</div>';

    return (
      '<div class="section-header">' +
        '<div><h3 class="section-title">Saved Party Roster</h3><div class="section-subtitle">Auto-populates targets in Attack Resolver</div></div>' +
        '<div class="card-quick-btns">' +
          (party.length ? '<button type="button" class="btn btn-sm" id="prep-drop-all-party">Drop All</button>' : '') +
          '<button type="button" class="btn btn-sm btn-primary" id="prep-add-pc">+ Add PC</button>' +
        '</div>' +
      '</div>' +
      rows
    );
  }

  function renderBestiaryTab(state, esc) {
    const list = state.bestiary;
    const rows = list.length
      ? '<div class="list-stack">' +
          list.map(function (m) {
            const atkCount = Array.isArray(m.attacks) ? m.attacks.length : 0;
            return '<div class="item-row">' +
              '<div class="item-row-main">' +
                '<div class="item-row-title">' + esc(m.name) + '</div>' +
                '<div class="item-row-meta mono">AC ' + esc(m.ac) + ' &bull; HP ' + esc(m.maxHp) + ' &bull; ' + atkCount + ' attack' + (atkCount === 1 ? '' : 's') + '</div>' +
              '</div>' +
              '<div class="item-row-actions">' +
                '<button type="button" class="btn btn-sm btn-primary" data-add-from-bestiary="' + esc(m.id) + '">+ Combat</button>' +
                '<button type="button" class="btn btn-sm" data-edit-bestiary="' + esc(m.id) + '">Edit</button>' +
                '<button type="button" class="btn btn-sm btn-danger-soft" data-del-bestiary="' + esc(m.id) + '">Remove</button>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>'
      : '<div class="empty-state">' +
          '<h3 class="empty-state-title">Local Bestiary Empty</h3>' +
          '<p class="empty-state-desc">Save custom monsters here or load the Starter Sample Data to get SRD Goblins, Wolves, Giant Spiders, and more.</p>' +
        '</div>';

    return (
      '<div class="section-header">' +
        '<div><h3 class="section-title">Local Bestiary</h3><div class="section-subtitle">Reusable stat blocks for instant combat setup</div></div>' +
        '<button type="button" class="btn btn-sm btn-primary" id="prep-add-bestiary">+ New Monster</button>' +
      '</div>' +
      rows
    );
  }

  function renderEncountersTab(state, esc) {
    const list = state.preparedEncounters;
    const rows = list.length
      ? '<div class="list-stack">' +
          list.map(function (enc) {
            const count = Array.isArray(enc.enemies) ? enc.enemies.length : 0;
            const names = (enc.enemies || []).map(function (e) { return e.name; }).slice(0, 4).join(', ');
            return '<div class="item-row">' +
              '<div class="item-row-main">' +
                '<div class="item-row-title">' + esc(enc.name) + '</div>' +
                '<div class="item-row-meta">' + count + ' enemies: ' + esc(names || 'None') + '</div>' +
                (enc.notes ? '<div class="item-row-meta" style="margin-top:2px;">' + esc(enc.notes) + '</div>' : '') +
              '</div>' +
              '<div class="item-row-actions">' +
                '<button type="button" class="btn btn-sm btn-primary" data-load-prep-enc="' + esc(enc.id) + '">Load into Combat</button>' +
                '<button type="button" class="btn btn-sm btn-danger-soft" data-del-prep-enc="' + esc(enc.id) + '">&times;</button>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>'
      : '<div class="empty-state">' +
          '<h3 class="empty-state-title">No Prepared Encounters Yet</h3>' +
          '<p class="empty-state-desc">Build an encounter in the Combat Hub and click "Save Encounter" to reuse it anytime with one tap.</p>' +
        '</div>';

    return (
      '<div class="section-header">' +
        '<div><h3 class="section-title">Prepared Encounter Library</h3><div class="section-subtitle">Stage upcoming fights ahead of game night</div></div>' +
      '</div>' +
      rows
    );
  }

  function render(targetContainer) {
    const container = targetContainer || lastContainer || document.getElementById('view-prep');
    if (!container) return;
    lastContainer = container;

    const state = S().getState();
    const esc = U().escapeHtml;

    let tabBody = '';
    if (activeSubTab === 'party') tabBody = renderPartyTab(state, esc);
    else if (activeSubTab === 'bestiary') tabBody = renderBestiaryTab(state, esc);
    else tabBody = renderEncountersTab(state, esc);

    container.innerHTML =
      '<div class="surface-card">' +
        '<div class="sub-tabs" role="tablist">' +
          '<button type="button" class="btn' + (activeSubTab === 'party' ? ' btn-primary' : '') + '" data-prep-tab="party">Party (' + state.party.length + ')</button>' +
          '<button type="button" class="btn' + (activeSubTab === 'bestiary' ? ' btn-primary' : '') + '" data-prep-tab="bestiary">Bestiary (' + state.bestiary.length + ')</button>' +
          '<button type="button" class="btn' + (activeSubTab === 'encounters' ? ' btn-primary' : '') + '" data-prep-tab="encounters">Encounters (' + state.preparedEncounters.length + ')</button>' +
        '</div>' +
        tabBody +
      '</div>';

    bindEvents(container);
  }

  function bindEvents(container) {
    container.querySelectorAll('[data-prep-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeSubTab = btn.getAttribute('data-prep-tab');
        render(container);
      });
    });

    const btnAddPc = container.querySelector('#prep-add-pc');
    if (btnAddPc) btnAddPc.addEventListener('click', function () { openPcEditorModal(null); });

    const btnDropAll = container.querySelector('#prep-drop-all-party');
    if (btnDropAll) {
      btnDropAll.addEventListener('click', function () {
        const added = S().dropPartyIntoEncounter();
        U().showToast({
          title: added > 0 ? 'Party Dropped into Combat' : 'Party Already in Combat',
          message: added > 0 ? added + ' PC(s) added.' : 'All saved PCs are already active.',
          tone: added > 0 ? 'success' : 'default'
        });
      });
    }

    container.querySelectorAll('[data-drop-pc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const ok = S().dropSinglePcIntoEncounter(btn.getAttribute('data-drop-pc'));
        U().showToast({
          title: ok ? 'Added to Combat' : 'Already in Combat',
          tone: ok ? 'success' : 'default',
          duration: 2200
        });
      });
    });

    container.querySelectorAll('[data-edit-pc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const pc = S().getState().party.find(function (p) { return p.id === btn.getAttribute('data-edit-pc'); });
        if (pc) openPcEditorModal(pc);
      });
    });

    container.querySelectorAll('[data-del-pc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const pc = S().getState().party.find(function (p) { return p.id === btn.getAttribute('data-del-pc'); });
        S().deletePc(btn.getAttribute('data-del-pc'));
        if (pc) U().showToast({ title: 'PC Removed', message: pc.name + ' removed from Party Roster.', duration: 2200 });
      });
    });

    // Bestiary
    const btnAddBestiary = container.querySelector('#prep-add-bestiary');
    if (btnAddBestiary) {
      btnAddBestiary.addEventListener('click', function () {
        DMHub.EncounterView.openMonsterEditorModal({
          title: 'New Bestiary Monster',
          forBestiary: true,
          onSave: function (payload) {
            S().saveBestiaryMonster(payload);
            U().showToast({ title: 'Saved to Bestiary', message: payload.name + ' added.', tone: 'success' });
          }
        });
      });
    }

    container.querySelectorAll('[data-add-from-bestiary]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const st = S().getState();
        const m = st.bestiary.find(function (x) { return x.id === btn.getAttribute('data-add-from-bestiary'); });
        if (!m) return;
        const clusterPeer = st.settings.enemyInitiativeMode === 'clustered' && !m.soloInitiative
          ? st.encounter.combatants.find(function (c) { return !c.isPc && !c.soloInitiative; })
          : null;
        let initRoll;
        if (clusterPeer) {
          initRoll = clusterPeer.initiative;
          S().addCombatant(DMHub.SRD.createCombatantFromTemplate(m, { initiative: initRoll }));
          U().showToast({ title: 'Added to Combat', message: m.name + ' joined enemy cluster (Init ' + initRoll + ').', tone: 'success' });
        } else {
          const dex = m.abilities && Number.isFinite(m.abilities.dex) ? m.abilities.dex : 10;
          const dexMod = DMHub.DiceEngine.abilityMod(dex);
          const rawRoll = Math.floor(Math.random() * 20) + 1;
          initRoll = rawRoll + dexMod;
          S().addCombatant(DMHub.SRD.createCombatantFromTemplate(m, { initiative: initRoll }));
          S().addRollLogEntry({
            kind: 'initiative',
            title: 'Initiative — ' + m.name,
            summary: String(initRoll),
            breakdown: m.name + ': d20 [' + rawRoll + '] ' + DMHub.DiceEngine.formatSigned(dexMod) + ' = ' + initRoll
          });
          U().showToast({ title: 'Added to Combat', message: m.name + ' rolled Init ' + initRoll + '.', tone: 'success' });
        }
      });
    });

    container.querySelectorAll('[data-edit-bestiary]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const m = S().getState().bestiary.find(function (x) { return x.id === btn.getAttribute('data-edit-bestiary'); });
        if (!m) return;
        DMHub.EncounterView.openMonsterEditorModal({
          title: 'Edit Bestiary — ' + m.name,
          monster: m,
          forBestiary: true,
          onSave: function (payload) {
            payload.id = m.id;
            S().saveBestiaryMonster(payload);
            U().showToast({ title: 'Monster Updated', message: payload.name + ' saved in Bestiary.', tone: 'success' });
          }
        });
      });
    });

    container.querySelectorAll('[data-del-bestiary]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const m = S().getState().bestiary.find(function (x) { return x.id === btn.getAttribute('data-del-bestiary'); });
        S().deleteBestiaryMonster(btn.getAttribute('data-del-bestiary'));
        if (m) U().showToast({ title: 'Monster Removed', message: m.name + ' removed from Bestiary.', duration: 2200 });
      });
    });

    // Prepared Encounters
    container.querySelectorAll('[data-load-prep-enc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-load-prep-enc');
        const ok = S().loadPreparedEncounterIntoCombat(id, true);
        if (ok) {
          U().showToast({ title: 'Encounter Loaded', message: 'Populated Combat Hub with enemies + saved party.', tone: 'success' });
          if (DMHub.App) DMHub.App.openSection('combat');
        }
      });
    });

    container.querySelectorAll('[data-del-prep-enc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S().deletePreparedEncounter(btn.getAttribute('data-del-prep-enc'));
      });
    });
  }

  DMHub.PrepView = {
    render: render
  };
})(window.DMHub = window.DMHub || {});
