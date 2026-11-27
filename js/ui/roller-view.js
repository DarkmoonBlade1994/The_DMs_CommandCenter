/* ==========================================================================
   DM Hub — Smart Attack & Split-Damage Resolver + Standard Polyhedral Tray
   Step 1: Attack Setup -> Step 2: Batch Roll to Hit (Reaction Override) ->
   Step 3: Chained Split-Damage Roll (Resist / Vuln / Immune live toggles)
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const U = function () { return DMHub.UI; };
  const S = function () { return DMHub.Store; };
  const D = function () { return DMHub.DiceEngine; };

  // Ephemeral UI state for the active attack workflow
  const ui = {
    selectedSourceKey: 'custom', // 'custom' or '<combatantId>::<attackIdx>'
    attackName: 'Custom Attack',
    toHitBonus: 5,
    components: [
      { formula: '1d8+3', type: 'Piercing' },
      { formula: '2d6', type: 'Poison' }
    ],
    targetKey: 'manual', // 'manual' | 'pc:<id>' | 'cmb:<id>'
    targetName: 'Target',
    targetAC: 15,
    numAttacks: 2,
    rollMode: 'normal', // 'normal' | 'advantage' | 'disadvantage'
    showAttackMath: false,
    showDamageMath: false,
    showQuickMath: false,
    batchResult: null,
    damageResult: null,
    quickRollResult: null,
    polyPool: { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0 },
    polyMod: 0,
    customFormula: '1d20'
  };

  const POLY_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

  function buildPolyFormulaFromPool() {
    const parts = [];
    POLY_DICE.forEach(function (die) {
      const cnt = Number(ui.polyPool[die]) || 0;
      if (cnt > 0) parts.push(cnt + die);
    });
    if (!parts.length) {
      return ui.polyMod !== 0 ? String(ui.polyMod) : '';
    }
    let f = parts.join('+');
    if (ui.polyMod > 0) f += '+' + ui.polyMod;
    else if (ui.polyMod < 0) f += String(ui.polyMod);
    return f;
  }

  function hasQueuedPolyDice() {
    return POLY_DICE.some(function (d) { return (ui.polyPool[d] || 0) > 0; }) || ui.polyMod !== 0;
  }

  let lastDefaultMathSetting = null;

  function syncDefaultMathVisibility() {
    const current = S().getState().settings.defaultRollMathVisible;
    if (current !== lastDefaultMathSetting) {
      const detailed = current === 'detailed';
      ui.showAttackMath = detailed;
      ui.showDamageMath = detailed;
      ui.showQuickMath = detailed;
      lastDefaultMathSetting = current;
    }
  }

  function getActiveMonsterAttackOptions() {
    const list = [];
    const combatants = S().getState().encounter.combatants;
    combatants.forEach(function (c) {
      if (c.isPc || !Array.isArray(c.attacks)) return;
      c.attacks.forEach(function (atk, idx) {
        list.push({
          key: c.id + '::' + idx,
          combatantId: c.id,
          combatantName: c.name,
          attackIndex: idx,
          attack: atk
        });
      });
    });
    return list;
  }

  function getTargetOptions() {
    const state = S().getState();
    const pcs = state.party.map(function (p) {
      const inCombat = state.encounter.combatants.find(function (c) { return c.isPc && c.pcId === p.id; });
      return {
        key: 'pc:' + p.id,
        label: p.name + ' (AC ' + p.ac + ')',
        name: p.name,
        ac: Number(p.ac) || 10,
        combatantId: inCombat ? inCombat.id : null
      };
    });

    const enemies = state.encounter.combatants
      .filter(function (c) { return !c.isPc; })
      .map(function (c) {
        return {
          key: 'cmb:' + c.id,
          label: c.name + ' (AC ' + c.ac + ')',
          name: c.name,
          ac: Number(c.ac) || 10,
          combatantId: c.id
        };
      });

    return { pcs: pcs, enemies: enemies };
  }

  function resolveCurrentTargetCombatantId() {
    const targets = getTargetOptions();
    const all = targets.pcs.concat(targets.enemies);
    const match = all.find(function (t) { return t.key === ui.targetKey; });
    return match ? match.combatantId : null;
  }

  function loadMonsterAttack(combatantId, attackIdx) {
    const combatants = S().getState().encounter.combatants;
    const c = combatants.find(function (x) { return x.id === combatantId; });
    if (!c || !c.attacks || !c.attacks[attackIdx]) return;
    const atk = c.attacks[attackIdx];
    ui.selectedSourceKey = combatantId + '::' + attackIdx;
    ui.attackName = c.name + ' — ' + atk.name;
    ui.toHitBonus = Number(atk.toHit) || 0;
    ui.components = (atk.components || []).map(function (comp) {
      return { formula: comp.formula, type: comp.type };
    });
    if (!ui.components.length) {
      ui.components = [{ formula: '1d6+2', type: 'Slashing' }];
    }
    ui.batchResult = null;
    ui.damageResult = null;
    render();
    U().showToast({ title: 'Loaded Attack', message: ui.attackName + ' ready in Attack Resolver.', duration: 2200 });
  }

  function countConfirmedOutcomes() {
    if (!ui.batchResult) return { hits: 0, crits: 0, misses: 0 };
    let hits = 0;
    let crits = 0;
    let misses = 0;
    ui.batchResult.attacks.forEach(function (a) {
      if (a.status === 'crit') crits += 1;
      else if (a.status === 'hit') hits += 1;
      else misses += 1;
    });
    return { hits: hits, crits: crits, misses: misses };
  }

  function formatSummarySentence(counts, ac) {
    const parts = [];
    if (counts.hits > 0) parts.push(counts.hits + (counts.hits === 1 ? ' Hit' : ' Hits'));
    if (counts.crits > 0) parts.push(counts.crits + (counts.crits === 1 ? ' Crit' : ' Crits'));
    if (parts.length === 0) parts.push('All Missed');
    return parts.join(', ') + ' vs. AC ' + ac;
  }

  function getCritRuleLabel(ruleId) {
    const found = DMHub.SRD.CRIT_RULES.find(function (r) { return r.id === ruleId; });
    return found ? found.name : 'Roll Double Dice (RAW)';
  }

  function handleRollToHit() {
    const settings = S().getState().settings;
    const result = D().rollBatchAttacks({
      count: ui.numAttacks,
      toHitBonus: ui.toHitBonus,
      targetAC: ui.targetAC,
      mode: ui.rollMode,
      nat20AutoHit: settings.nat20AutoHit
    });

    ui.batchResult = result;
    ui.damageResult = null;
    ui.showAttackMath = settings.defaultRollMathVisible === 'detailed' || ui.showAttackMath;

    const counts = countConfirmedOutcomes();
    const summary = formatSummarySentence(counts, result.targetAC);
    const breakdown = result.attacks.map(function (a) {
      return '#' + a.index + ' (' + a.status.toUpperCase() + '): ' + a.breakdown;
    }).join('\n');

    S().addRollLogEntry({
      kind: 'attack',
      title: ui.attackName + ' (' + ui.numAttacks + '× vs ' + ui.targetName + ')',
      summary: summary,
      breakdown: breakdown
    });

    render();
  }

  function handleToggleAttackChip(index) {
    if (!ui.batchResult) return;
    const atk = ui.batchResult.attacks[index];
    if (!atk) return;

    if (atk.initialStatus === 'crit') {
      // Cycle Crit -> Hit -> Miss -> Crit (supports Silvery Barbs / Adamantine Armor / Shield)
      if (atk.status === 'crit') atk.status = 'hit';
      else if (atk.status === 'hit') atk.status = 'miss';
      else atk.status = 'crit';
    } else {
      atk.status = atk.status === 'miss' ? 'hit' : 'miss';
    }
    atk.overridden = atk.status !== atk.initialStatus;
    ui.damageResult = null;
    render();
  }

  function handleRollDamage() {
    if (!ui.batchResult) return;
    const counts = countConfirmedOutcomes();
    if (counts.hits + counts.crits <= 0) return;

    const settings = S().getState().settings;
    const validComps = ui.components.filter(function (c) { return String(c.formula || '').trim().length > 0; });
    if (!validComps.length) {
      U().showToast({ title: 'No Damage Dice', message: 'Add at least one damage formula in Step 1.', tone: 'warning' });
      return;
    }

    const dmg = D().rollSplitDamage({
      hits: counts.hits,
      crits: counts.crits,
      components: validComps,
      critRule: settings.critRule
    });

    ui.damageResult = dmg;
    ui.showDamageMath = settings.defaultRollMathVisible === 'detailed' || ui.showDamageMath;

    const rowSummaries = dmg.rows.map(function (r) {
      return r.type + ': ' + r.rawTotal;
    }).join(' | ');

    const breakdownLines = [];
    dmg.rows.forEach(function (r) {
      breakdownLines.push(r.type + ' (Raw ' + r.rawTotal + '):');
      r.breakdownLines.forEach(function (line) {
        breakdownLines.push('  ' + line);
      });
    });

    S().addRollLogEntry({
      kind: 'damage',
      title: ui.attackName + ' — Damage (' + counts.hits + 'H, ' + counts.crits + 'C)',
      summary: 'Total ' + dmg.grandTotal + ' (' + rowSummaries + ')',
      breakdown: breakdownLines.join('\n')
    });

    render();
  }

  function handleQuickRoll(formula, label) {
    const res = D().rollFormula(formula);
    if (!res.valid) {
      U().showToast({ title: 'Invalid Dice Formula', message: res.error, tone: 'warning' });
      return;
    }
    ui.quickRollResult = {
      label: label || formula,
      formula: res.formula,
      total: res.total,
      breakdown: res.breakdown
    };
    S().addRollLogEntry({
      kind: 'quick',
      title: label || ('Roll ' + res.formula),
      summary: String(res.total),
      breakdown: res.breakdown
    });
    render();
  }

  /* ------------------------------------------------------------------------
     Render Smart Attack Resolver & Polyhedral Tray
     ------------------------------------------------------------------------ */

  function renderStep1(esc) {
    const monsterAttacks = getActiveMonsterAttackOptions();
    const targets = getTargetOptions();

    const atkSourceOptions =
      '<option value="custom"' + (ui.selectedSourceKey === 'custom' ? ' selected' : '') + '>Custom Attack</option>' +
      monsterAttacks.map(function (item) {
        const comps = (item.attack.components || []).map(function (c) { return c.formula + ' ' + c.type; }).join(' + ');
        const text = item.combatantName + ' — ' + item.attack.name + ' (' + D().formatSigned(item.attack.toHit) + ', ' + comps + ')';
        return '<option value="' + esc(item.key) + '"' + (ui.selectedSourceKey === item.key ? ' selected' : '') + '>' + esc(text) + '</option>';
      }).join('');

    const targetOptionsHtml =
      '<option value="manual"' + (ui.targetKey === 'manual' ? ' selected' : '') + '>Manual AC</option>' +
      (targets.pcs.length
        ? '<optgroup label="Saved Party PCs">' +
            targets.pcs.map(function (t) {
              return '<option value="' + esc(t.key) + '"' + (ui.targetKey === t.key ? ' selected' : '') + '>' + esc(t.label) + '</option>';
            }).join('') +
          '</optgroup>'
        : '') +
      (targets.enemies.length
        ? '<optgroup label="Active Enemies">' +
            targets.enemies.map(function (t) {
              return '<option value="' + esc(t.key) + '"' + (ui.targetKey === t.key ? ' selected' : '') + '>' + esc(t.label) + '</option>';
            }).join('') +
          '</optgroup>'
        : '');

    const compRowsHtml = ui.components.map(function (comp, idx) {
      const typeOpts = DMHub.SRD.DAMAGE_TYPES.map(function (t) {
        return '<option value="' + esc(t) + '"' + (t === comp.type ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('');

      return '<div class="damage-comp-row">' +
        '<input type="text" class="input mono" value="' + esc(comp.formula) + '" placeholder="1d8+3" aria-label="Damage formula ' + (idx + 1) + '" data-comp-formula="' + idx + '">' +
        '<select class="select" aria-label="Damage type ' + (idx + 1) + '" data-comp-type="' + idx + '">' + typeOpts + '</select>' +
        (ui.components.length > 1
          ? '<button type="button" class="btn btn-icon btn-danger-soft" aria-label="Remove damage component" data-comp-remove="' + idx + '">&times;</button>'
          : '<span></span>') +
      '</div>';
    }).join('');

    return (
      '<div class="step-card" id="roller-step-1">' +
        '<div class="section-header">' +
          '<div>' +
            '<div class="step-label">Step 1 &bull; Attack Setup</div>' +
            '<h2 class="section-title">Smart Attack Resolver</h2>' +
          '</div>' +
        '</div>' +

        '<div class="list-stack" style="gap:12px;">' +
          '<div class="field-group">' +
            '<label class="field-label" for="atk-source-select">Attack Source</label>' +
            '<select id="atk-source-select" class="select">' + atkSourceOptions + '</select>' +
          '</div>' +

          '<div class="form-grid-2">' +
            '<div class="field-group">' +
              '<label class="field-label" for="atk-target-select">Target</label>' +
              '<select id="atk-target-select" class="select">' + targetOptionsHtml + '</select>' +
            '</div>' +
            '<div class="field-group">' +
              '<label class="field-label" for="atk-target-ac">Target AC</label>' +
              '<input type="number" inputmode="numeric" id="atk-target-ac" class="input tabular" value="' + esc(ui.targetAC) + '">' +
            '</div>' +
          '</div>' +

          '<div class="form-grid-2">' +
            '<div class="field-group">' +
              '<label class="field-label" for="atk-to-hit">To-Hit Bonus</label>' +
              '<input type="number" inputmode="numeric" id="atk-to-hit" class="input tabular" value="' + esc(ui.toHitBonus) + '">' +
            '</div>' +
            '<div class="field-group">' +
              '<label class="field-label" for="atk-count">Number of Attacks</label>' +
              '<div class="stepper-control">' +
                '<button type="button" class="btn" id="atk-count-dec" aria-label="Decrease attacks">&minus;</button>' +
                '<input type="number" inputmode="numeric" min="1" max="50" id="atk-count" class="input tabular" value="' + esc(ui.numAttacks) + '">' +
                '<button type="button" class="btn" id="atk-count-inc" aria-label="Increase attacks">+</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="field-group">' +
            '<span class="field-label">Roll Mode</span>' +
            '<div class="segmented segmented-full" role="group" aria-label="Advantage mode">' +
              '<button type="button" class="seg-btn' + (ui.rollMode === 'normal' ? ' is-active' : '') + '" id="roll-mode-normal" data-roll-mode="normal">Normal</button>' +
              '<button type="button" class="seg-btn' + (ui.rollMode === 'advantage' ? ' is-active' : '') + '" id="roll-mode-advantage" data-roll-mode="advantage">Advantage</button>' +
              '<button type="button" class="seg-btn' + (ui.rollMode === 'disadvantage' ? ' is-active' : '') + '" id="roll-mode-disadvantage" data-roll-mode="disadvantage">Disadvantage</button>' +
            '</div>' +
          '</div>' +

          '<div class="field-group">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
              '<span class="field-label">Damage Components</span>' +
              '<button type="button" class="btn btn-sm btn-ghost" id="btn-add-dmg-comp">+ Add Type</button>' +
            '</div>' +
            '<div class="damage-comp-list">' + compRowsHtml + '</div>' +
          '</div>' +

          '<button type="button" class="btn btn-primary btn-lg btn-block" id="btn-roll-to-hit">Roll To Hit (' + esc(ui.numAttacks) + '&times;)</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderStep2(esc) {
    if (!ui.batchResult) return '';
    const counts = countConfirmedOutcomes();
    const confirmedTotal = counts.hits + counts.crits;
    const summaryText = formatSummarySentence(counts, ui.batchResult.targetAC);

    const chipsHtml = ui.batchResult.attacks.map(function (a, i) {
      const cls = a.status === 'crit' ? 'is-crit' : (a.status === 'hit' ? 'is-hit' : 'is-miss');
      const label = a.status === 'crit' ? '&#9733; Crit' : (a.status === 'hit' ? 'Hit' : 'Miss');
      return '<button type="button" class="attack-chip ' + cls + '" data-toggle-chip="' + i + '" title="Tap to override Hit/Miss (e.g. Shield)">' +
        '<div class="attack-chip-top">' +
          '<span class="attack-chip-total tabular">#' + a.index + ': ' + a.total + '</span>' +
          '<span class="attack-chip-status">' + label + '</span>' +
        '</div>' +
        (a.overridden ? '<span class="override-tag">Overridden</span>' : '') +
        (ui.showAttackMath ? '<div class="attack-chip-math">' + esc(a.breakdown) + '</div>' : '') +
      '</button>';
    }).join('');

    return (
      '<div class="step-card" id="roller-step-2">' +
        '<div class="section-header" style="margin-bottom:8px;">' +
          '<span class="step-label" style="margin:0;">Step 2 &bull; Batch Roll to Hit</span>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="btn-toggle-atk-math">' +
            (ui.showAttackMath ? 'Hide Die Math' : 'Show Die Math') +
          '</button>' +
        '</div>' +

        '<div class="roll-summary-banner">' +
          '<div class="roll-summary-headline" id="attack-summary-headline">' + esc(summaryText) + '</div>' +
        '</div>' +

        '<p class="roll-summary-hint">Tap any attack chip to toggle Hit / Miss before rolling damage (e.g., if a PC casts <em>Shield</em>).</p>' +
        '<div class="attack-chips-grid" id="attack-chips-grid">' + chipsHtml + '</div>' +

        '<button type="button" class="btn btn-danger btn-lg btn-block" id="btn-roll-damage"' + (confirmedTotal === 0 ? ' disabled' : '') + '>' +
          (confirmedTotal > 0
            ? 'Roll Damage (' + counts.hits + ' Hit' + (counts.hits === 1 ? '' : 's') + ', ' + counts.crits + ' Crit' + (counts.crits === 1 ? '' : 's') + ')'
            : 'No Confirmed Hits') +
        '</button>' +
      '</div>'
    );
  }

  function renderStep3(esc) {
    if (!ui.damageResult) return '';
    const dmg = ui.damageResult;
    const targetCmbId = resolveCurrentTargetCombatantId();

    const rowsHtml = dmg.rows.map(function (row, idx) {
      const m = row.multiplier;
      const rawNote = m !== 'normal' ? '<span class="damage-raw-note">(raw ' + row.rawTotal + ')</span>' : '';
      const mathBox = ui.showDamageMath
        ? '<div class="die-math-box">' +
            row.breakdownLines.map(function (line) {
              return '<div>' + esc(line) + '</div>';
            }).join('') +
          '</div>'
        : '';

      return (
        '<div class="split-damage-row" data-damage-row="' + idx + '">' +
          '<div class="split-damage-top">' +
            '<span class="damage-type-name">' + esc(row.type) + '</span>' +
            '<span class="damage-type-amount tabular" data-damage-row-total="' + idx + '">' +
              esc(row.effectiveTotal) + rawNote +
            '</span>' +
          '</div>' +
          '<div class="mult-pills" role="group" aria-label="Multiplier for ' + esc(row.type) + '">' +
            '<button type="button" class="mult-pill' + (m === 'normal' ? ' is-active' : '') + '" data-dmg-mult-row="' + idx + '" data-mult="normal">Normal</button>' +
            '<button type="button" class="mult-pill' + (m === 'resist' ? ' is-active' : '') + '" data-dmg-mult-row="' + idx + '" data-mult="resist">Resist (&frac12;)</button>' +
            '<button type="button" class="mult-pill' + (m === 'vuln' ? ' is-active' : '') + '" data-dmg-mult-row="' + idx + '" data-mult="vuln">Vuln (2&times;)</button>' +
            '<button type="button" class="mult-pill' + (m === 'immune' ? ' is-active' : '') + '" data-dmg-mult-row="' + idx + '" data-mult="immune">Immune (0)</button>' +
          '</div>' +
          mathBox +
        '</div>'
      );
    }).join('');

    const applyBtnHtml = targetCmbId && dmg.grandTotal > 0
      ? '<button type="button" class="btn btn-primary btn-block" style="margin-top:10px;" id="btn-apply-dmg-to-target" data-target-cmb="' + esc(targetCmbId) + '">Apply ' + esc(dmg.grandTotal) + ' Damage to ' + esc(ui.targetName) + '</button>'
      : '';

    return (
      '<div class="step-card" id="roller-step-3">' +
        '<div class="section-header" style="margin-bottom:8px;">' +
          '<div>' +
            '<span class="step-label" style="margin:0;">Step 3 &bull; Split Damage</span>' +
            '<div class="section-subtitle">Crit Rule: ' + esc(getCritRuleLabel(dmg.critRule)) + '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="btn-toggle-dmg-math">' +
            (ui.showDamageMath ? 'Hide Die Math' : 'Show Die Math') +
          '</button>' +
        '</div>' +

        '<div class="split-damage-list">' + rowsHtml + '</div>' +

        '<div class="grand-total-bar">' +
          '<span class="grand-total-label">Grand Total Damage</span>' +
          '<span class="grand-total-value tabular" id="split-damage-grand-total">' + esc(dmg.grandTotal) + '</span>' +
        '</div>' +
        applyBtnHtml +
      '</div>'
    );
  }

  function renderPolyhedralTray(esc) {
    const quickHtml = ui.quickRollResult
      ? '<div class="quick-roll-result" id="quick-roll-result">' +
          '<div class="quick-roll-top">' +
            '<div>' +
              '<strong>' + esc(ui.quickRollResult.label) + '</strong>' +
              '<div class="section-subtitle mono">' + esc(ui.quickRollResult.formula) + '</div>' +
            '</div>' +
            '<div class="quick-roll-total tabular">' + esc(ui.quickRollResult.total) + '</div>' +
          '</div>' +
          '<div class="die-math-box">' + esc(ui.quickRollResult.breakdown) + '</div>' +
        '</div>'
      : '';

    const tilesHtml = POLY_DICE.map(function (die) {
      const cnt = Number(ui.polyPool[die]) || 0;
      const labelText = cnt > 0 ? (cnt + die) : die;
      return (
        '<div class="die-tile' + (cnt > 0 ? ' has-dice' : '') + '" data-die-tile="' + die + '">' +
          '<button type="button" class="die-step-btn" data-poly-dec="' + die + '" aria-label="Remove one ' + die + '"' + (cnt === 0 ? ' disabled' : '') + '>&minus;</button>' +
          '<button type="button" class="die-label-btn" data-poly-inc="' + die + '" title="Tap to add ' + die + '">' + esc(labelText) + '</button>' +
          '<button type="button" class="die-step-btn" data-poly-inc="' + die + '" aria-label="Add one ' + die + '">+</button>' +
        '</div>'
      );
    }).join('');

    const modTileHtml =
      '<div class="die-tile' + (ui.polyMod !== 0 ? ' has-dice' : '') + '">' +
        '<button type="button" class="die-step-btn" id="btn-poly-mod-dec" aria-label="Decrease modifier">&minus;</button>' +
        '<div class="die-label-btn" style="cursor:default;">Mod ' + esc(D().formatSigned(ui.polyMod)) + '</div>' +
        '<button type="button" class="die-step-btn" id="btn-poly-mod-inc" aria-label="Increase modifier">+</button>' +
      '</div>';

    return (
      '<div class="step-card" id="polyhedral-tray">' +
        '<div class="section-header" style="margin-bottom:10px;">' +
          '<div>' +
            '<h3 class="section-title" style="font-size:1.05rem;">Dice Tray</h3>' +
            '<div class="section-subtitle">Tap + / &minus; to build or fix a roll without typing</div>' +
          '</div>' +
        '</div>' +
        '<div class="poly-pool-grid">' +
          tilesHtml +
          modTileHtml +
        '</div>' +
        '<div class="poly-pool-actions">' +
          '<input type="text" id="custom-formula-input" class="input mono" value="' + esc(ui.customFormula) + '" placeholder="e.g., 4d6+2" aria-label="Custom dice formula">' +
          '<button type="button" class="btn btn-primary" id="btn-roll-custom">Roll</button>' +
          '<button type="button" class="btn btn-ghost" id="btn-clear-poly" title="Clear dice pool">Clear</button>' +
        '</div>' +
        quickHtml +
      '</div>'
    );
  }

  function render() {
    const container = document.getElementById('view-roller');
    if (!container) return;
    syncDefaultMathVisibility();
    const esc = U().escapeHtml;

    container.innerHTML =
      renderStep1(esc) +
      renderStep2(esc) +
      renderStep3(esc) +
      renderPolyhedralTray(esc);

    bindEvents(container);
  }

  function bindEvents(container) {
    const srcSelect = container.querySelector('#atk-source-select');
    if (srcSelect) {
      srcSelect.addEventListener('change', function () {
        ui.selectedSourceKey = srcSelect.value;
        if (srcSelect.value === 'custom') {
          ui.attackName = 'Custom Attack';
        } else {
          const parts = srcSelect.value.split('::');
          loadMonsterAttack(parts[0], parseInt(parts[1], 10));
          return;
        }
        render();
      });
    }

    const targetSelect = container.querySelector('#atk-target-select');
    if (targetSelect) {
      targetSelect.addEventListener('change', function () {
        ui.targetKey = targetSelect.value;
        if (ui.targetKey === 'manual') {
          ui.targetName = 'Target';
        } else {
          const all = getTargetOptions().pcs.concat(getTargetOptions().enemies);
          const match = all.find(function (t) { return t.key === ui.targetKey; });
          if (match) {
            ui.targetName = match.name;
            ui.targetAC = match.ac;
          }
        }
        render();
      });
    }

    const acInput = container.querySelector('#atk-target-ac');
    if (acInput) {
      acInput.addEventListener('input', function () {
        ui.targetAC = parseInt(acInput.value, 10) || 10;
      });
    }

    const toHitInput = container.querySelector('#atk-to-hit');
    if (toHitInput) {
      toHitInput.addEventListener('input', function () {
        ui.toHitBonus = parseInt(toHitInput.value, 10) || 0;
      });
    }

    const countInput = container.querySelector('#atk-count');
    if (countInput) {
      countInput.addEventListener('change', function () {
        ui.numAttacks = Math.max(1, Math.min(50, parseInt(countInput.value, 10) || 1));
        render();
      });
    }

    const btnDec = container.querySelector('#atk-count-dec');
    if (btnDec) {
      btnDec.addEventListener('click', function () {
        ui.numAttacks = Math.max(1, ui.numAttacks - 1);
        render();
      });
    }

    const btnInc = container.querySelector('#atk-count-inc');
    if (btnInc) {
      btnInc.addEventListener('click', function () {
        ui.numAttacks = Math.min(50, ui.numAttacks + 1);
        render();
      });
    }

    container.querySelectorAll('[data-roll-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.rollMode = btn.getAttribute('data-roll-mode');
        render();
      });
    });

    container.querySelectorAll('[data-comp-formula]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const idx = parseInt(inp.getAttribute('data-comp-formula'), 10);
        if (ui.components[idx]) ui.components[idx].formula = inp.value;
      });
    });

    container.querySelectorAll('[data-comp-type]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        const idx = parseInt(sel.getAttribute('data-comp-type'), 10);
        if (ui.components[idx]) ui.components[idx].type = sel.value;
      });
    });

    container.querySelectorAll('[data-comp-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-comp-remove'), 10);
        ui.components.splice(idx, 1);
        render();
      });
    });

    const btnAddComp = container.querySelector('#btn-add-dmg-comp');
    if (btnAddComp) {
      btnAddComp.addEventListener('click', function () {
        ui.components.push({ formula: '1d6', type: 'Fire' });
        render();
      });
    }

    const btnRollHit = container.querySelector('#btn-roll-to-hit');
    if (btnRollHit) btnRollHit.addEventListener('click', handleRollToHit);

    const btnToggleAtkMath = container.querySelector('#btn-toggle-atk-math');
    if (btnToggleAtkMath) {
      btnToggleAtkMath.addEventListener('click', function () {
        ui.showAttackMath = !ui.showAttackMath;
        render();
      });
    }

    container.querySelectorAll('[data-toggle-chip]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        handleToggleAttackChip(parseInt(chip.getAttribute('data-toggle-chip'), 10));
      });
    });

    const btnRollDmg = container.querySelector('#btn-roll-damage');
    if (btnRollDmg) btnRollDmg.addEventListener('click', handleRollDamage);

    const btnToggleDmgMath = container.querySelector('#btn-toggle-dmg-math');
    if (btnToggleDmgMath) {
      btnToggleDmgMath.addEventListener('click', function () {
        ui.showDamageMath = !ui.showDamageMath;
        render();
      });
    }

    container.querySelectorAll('[data-dmg-mult-row]').forEach(function (pill) {
      pill.addEventListener('click', function () {
        if (!ui.damageResult) return;
        const rowIdx = parseInt(pill.getAttribute('data-dmg-mult-row'), 10);
        const mult = pill.getAttribute('data-mult');
        if (ui.damageResult.rows[rowIdx]) {
          ui.damageResult.rows[rowIdx].multiplier = mult;
          D().recalculateSplitDamage(ui.damageResult);
          render();
        }
      });
    });

    const btnApplyDmg = container.querySelector('#btn-apply-dmg-to-target');
    if (btnApplyDmg && ui.damageResult) {
      btnApplyDmg.addEventListener('click', function () {
        const cmbId = btnApplyDmg.getAttribute('data-target-cmb');
        const total = ui.damageResult.grandTotal;
        const res = S().applyHpDelta(cmbId, total, 'damage');
        if (res) {
          U().showToast({
            title: 'Applied ' + total + ' Damage',
            message: res.combatant.name + ' is now at ' + res.combatant.hp + ' / ' + res.combatant.maxHp + ' HP.',
            tone: 'default'
          });
          if (res.concentrationDC !== null) {
            U().showConcentrationToast(res.combatant, total, res.concentrationDC);
          }
        }
      });
    }

    // Polyhedral Dice Pool Builder (+/-)
    function syncPoolToFormula() {
      const built = buildPolyFormulaFromPool();
      ui.customFormula = built || '1d20';
      render();
    }

    container.querySelectorAll('[data-poly-inc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const die = btn.getAttribute('data-poly-inc');
        ui.polyPool[die] = Math.min(50, (Number(ui.polyPool[die]) || 0) + 1);
        syncPoolToFormula();
      });
    });

    container.querySelectorAll('[data-poly-dec]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const die = btn.getAttribute('data-poly-dec');
        ui.polyPool[die] = Math.max(0, (Number(ui.polyPool[die]) || 0) - 1);
        syncPoolToFormula();
      });
    });

    const modDec = container.querySelector('#btn-poly-mod-dec');
    if (modDec) {
      modDec.addEventListener('click', function () {
        ui.polyMod -= 1;
        syncPoolToFormula();
      });
    }

    const modInc = container.querySelector('#btn-poly-mod-inc');
    if (modInc) {
      modInc.addEventListener('click', function () {
        ui.polyMod += 1;
        syncPoolToFormula();
      });
    }

    const btnClearPoly = container.querySelector('#btn-clear-poly');
    if (btnClearPoly) {
      btnClearPoly.addEventListener('click', function () {
        POLY_DICE.forEach(function (d) { ui.polyPool[d] = 0; });
        ui.polyMod = 0;
        ui.customFormula = '';
        render();
      });
    }

    const customInput = container.querySelector('#custom-formula-input');
    if (customInput) {
      customInput.addEventListener('input', function () {
        ui.customFormula = customInput.value;
      });
      customInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const expr = customInput.value.trim() || buildPolyFormulaFromPool();
          handleQuickRoll(expr, 'Dice Roll');
        }
      });
    }

    const btnCustom = container.querySelector('#btn-roll-custom');
    if (btnCustom && customInput) {
      btnCustom.addEventListener('click', function () {
        const expr = customInput.value.trim() || buildPolyFormulaFromPool();
        handleQuickRoll(expr, hasQueuedPolyDice() ? 'Dice Pool Roll' : 'Custom Roll');
      });
    }
  }

  DMHub.RollerView = {
    render: render,
    loadMonsterAttack: loadMonsterAttack
  };
})(window.DMHub = window.DMHub || {});
