/* ==========================================================================
   DM Hub — Emergency Scratchpad & 1-Click Offline Name Generator
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const U = function () { return DMHub.UI; };
  const S = function () { return DMHub.Store; };

  let lastContainer = null;
  let selectedAncestry = 'Any';
  let selectedVenue = 'Any Establishment';
  let lastNpc = null;
  let lastVenue = null;

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        U().showToast({ title: 'Copied', message: '"' + text + '" copied to clipboard.', duration: 2000 });
      }).catch(function () {
        U().showToast({ title: text, message: 'Ready to use!', duration: 2200 });
      });
    } else {
      U().showToast({ title: text, message: 'Pinned or ready to use!', duration: 2200 });
    }
  }

  function render(targetContainer) {
    const container = targetContainer || lastContainer || document.getElementById('view-notes');
    if (!container) return;
    lastContainer = container;

    const state = S().getState();
    const esc = U().escapeHtml;

    if (!lastNpc) lastNpc = DMHub.NameGen.generateNpc(selectedAncestry);
    if (!lastVenue) lastVenue = DMHub.NameGen.generateVenue(selectedVenue);

    const ancestryOpts = DMHub.NameGen.ANCESTRIES.map(function (a) {
      return '<option value="' + esc(a) + '"' + (a === selectedAncestry ? ' selected' : '') + '>' + esc(a) + '</option>';
    }).join('');

    const venueOpts = DMHub.NameGen.VENUE_TYPES.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === selectedVenue ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');

    container.innerHTML =
      '<div class="surface-card">' +
        '<div class="section-header">' +
          '<div>' +
            '<h2 class="section-title">Emergency Scratchpad</h2>' +
            '<div class="section-subtitle">Auto-saves locally on every keystroke</div>' +
          '</div>' +
          '<button type="button" class="btn btn-sm" id="btn-notes-timestamp">+ Timestamp</button>' +
        '</div>' +
        '<textarea id="emergency-scratchpad" class="textarea" style="min-height:190px;" placeholder="Jot down improvised NPCs, loot, marching order, or plot hooks...">' + esc(state.notes) + '</textarea>' +
      '</div>' +

      '<div class="surface-card">' +
        '<div class="section-header">' +
          '<div>' +
            '<h3 class="section-title">1-Click Name Generator</h3>' +
            '<div class="section-subtitle">100% offline fantasy NPCs &amp; establishments</div>' +
          '</div>' +
        '</div>' +

        '<div class="list-stack" style="gap:14px;">' +
          '<div class="field-group">' +
            '<label class="field-label" for="npc-ancestry-select">Fantasy NPC (Ancestry / Vibe)</label>' +
            '<div class="custom-formula-row">' +
              '<select id="npc-ancestry-select" class="select">' + ancestryOpts + '</select>' +
              '<button type="button" class="btn btn-primary" id="btn-gen-npc">Generate NPC</button>' +
            '</div>' +
          '</div>' +

          '<div class="generated-name-box">' +
            '<div style="min-width:0;flex:1 1 180px;">' +
              '<div class="generated-name-text" id="gen-npc-name">' + esc(lastNpc.name) + '</div>' +
              '<div class="generated-name-sub">' + esc(lastNpc.detail) + '</div>' +
            '</div>' +
            '<div class="card-quick-btns">' +
              '<button type="button" class="btn btn-sm" id="btn-copy-npc">Copy</button>' +
              '<button type="button" class="btn btn-sm btn-primary" id="btn-pin-npc">+ Notes</button>' +
            '</div>' +
          '</div>' +

          '<div class="field-group">' +
            '<label class="field-label" for="venue-type-select">Establishment Type</label>' +
            '<div class="custom-formula-row">' +
              '<select id="venue-type-select" class="select">' + venueOpts + '</select>' +
              '<button type="button" class="btn btn-primary" id="btn-gen-venue">Generate Place</button>' +
            '</div>' +
          '</div>' +

          '<div class="generated-name-box">' +
            '<div style="min-width:0;flex:1 1 180px;">' +
              '<div class="generated-name-text" id="gen-venue-name">' + esc(lastVenue.name) + '</div>' +
              '<div class="generated-name-sub">' + esc(lastVenue.detail) + '</div>' +
            '</div>' +
            '<div class="card-quick-btns">' +
              '<button type="button" class="btn btn-sm" id="btn-copy-venue">Copy</button>' +
              '<button type="button" class="btn btn-sm btn-primary" id="btn-pin-venue">+ Notes</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    bindEvents(container);
  }

  function bindEvents(container) {
    const pad = container.querySelector('#emergency-scratchpad');
    if (pad) {
      pad.addEventListener('input', function () {
        S().setNotes(pad.value);
      });
    }

    const btnTs = container.querySelector('#btn-notes-timestamp');
    if (btnTs && pad) {
      btnTs.addEventListener('click', function () {
        const stamp = '[' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '] ';
        const next = (pad.value.trim() ? pad.value + '\n' : '') + stamp;
        pad.value = next;
        S().setNotes(next);
        pad.focus();
      });
    }

    const ancSel = container.querySelector('#npc-ancestry-select');
    if (ancSel) {
      ancSel.addEventListener('change', function () {
        selectedAncestry = ancSel.value;
      });
    }

    const btnNpc = container.querySelector('#btn-gen-npc');
    if (btnNpc) {
      btnNpc.addEventListener('click', function () {
        lastNpc = DMHub.NameGen.generateNpc(selectedAncestry);
        render(container);
      });
    }

    const btnCopyNpc = container.querySelector('#btn-copy-npc');
    if (btnCopyNpc) btnCopyNpc.addEventListener('click', function () { copyText(lastNpc.name); });

    const btnPinNpc = container.querySelector('#btn-pin-npc');
    if (btnPinNpc) {
      btnPinNpc.addEventListener('click', function () {
        S().appendNote('• NPC: ' + lastNpc.name + ' (' + lastNpc.detail + ')');
        render(container);
        U().showToast({ title: 'Pinned to Scratchpad', message: lastNpc.name + ' saved to your notes.', tone: 'success', duration: 2200 });
      });
    }

    const venSel = container.querySelector('#venue-type-select');
    if (venSel) {
      venSel.addEventListener('change', function () {
        selectedVenue = venSel.value;
      });
    }

    const btnVenue = container.querySelector('#btn-gen-venue');
    if (btnVenue) {
      btnVenue.addEventListener('click', function () {
        lastVenue = DMHub.NameGen.generateVenue(selectedVenue);
        render(container);
      });
    }

    const btnCopyVenue = container.querySelector('#btn-copy-venue');
    if (btnCopyVenue) btnCopyVenue.addEventListener('click', function () { copyText(lastVenue.name); });

    const btnPinVenue = container.querySelector('#btn-pin-venue');
    if (btnPinVenue) {
      btnPinVenue.addEventListener('click', function () {
        S().appendNote('• Place: ' + lastVenue.name + ' (' + lastVenue.detail + ')');
        render(container);
        U().showToast({ title: 'Pinned to Scratchpad', message: lastVenue.name + ' saved to your notes.', tone: 'success', duration: 2200 });
      });
    }
  }

  DMHub.NotesView = {
    render: render
  };
})(window.DMHub = window.DMHub || {});
