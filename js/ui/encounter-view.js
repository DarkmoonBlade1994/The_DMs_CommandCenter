/* ==========================================================================
   DM Hub — Encounter & Monster Hub View
   Initiative vs. Freeform Mode, Fast HP Math, Temp HP, Quick Clone/Swarm,
   Expandable Stat Blocks, Interactive 5e Condition Badges & Concentration Toast
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const U = function () { return DMHub.UI; };
  const S = function () { return DMHub.Store; };
  const D = function () { return DMHub.DiceEngine; };

  function hpClass(hp, maxHp) {
    if (maxHp <= 0) return 'hp-critical';
    const ratio = hp / maxHp;
    if (ratio <= 0.25) return 'hp-critical';
    if (ratio <= 0.5) return 'hp-bloodied';
    return 'hp-healthy';
  }

  function renderAbilityBoxes(abilities, combatantId) {
    const ab = abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    return '<div class="stat-abilities-grid">' +
      keys.map(function (k) {
        const score = Number.isFinite(Number(ab[k])) ? Number(ab[k]) : 10;
        const mod = D().abilityMod(score);
        return '<button type="button" class="ability-box" data-roll-ability="' + k + '" data-ability-cmb="' + U().escapeHtml(combatantId || '') + '" title="Roll ' + k.toUpperCase() + ' check (1d20 ' + D().formatSigned(mod) + ')">' +
          '<div class="ability-label">' + k.toUpperCase() + '</div>' +
          '<div class="ability-mod">' + D().formatSigned(mod) + '</div>' +
          '<div class="ability-score">(' + score + ')</div>' +
        '</button>';
      }).join('') +
    '</div>';
  }

  function renderAttacksList(combatant) {
    const attacks = Array.isArray(combatant.attacks) ? combatant.attacks : [];
    if (!attacks.length) {
      return '<div class="section-subtitle">No attacks saved on this stat block. Click Edit to add attacks.</div>';
    }
    return '<div class="list-stack">' +
      attacks.map(function (atk, idx) {
        const comps = (atk.components || []).map(function (c) {
          return U().escapeHtml(c.formula) + ' ' + U().escapeHtml(c.type);
        }).join(' + ');
        return '<div class="stat-attack-item">' +
          '<div class="stat-attack-info">' +
            '<strong>' + U().escapeHtml(atk.name || 'Attack') + '</strong>' +
            '<div class="stat-attack-meta">' + D().formatSigned(Number(atk.toHit) || 0) + ' to hit &bull; ' + (comps || '1d6') + '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-sm btn-primary" data-use-attack="' + U().escapeHtml(combatant.id) + '" data-attack-idx="' + idx + '">Roll Attack &rarr;</button>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function renderCombatantCard(c, idx, isInitMode, isActiveTurn, hasActedThisRound, isClusterMode, activeGroupSize) {
    const esc = U().escapeHtml;
    const pct = c.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((c.hp / c.maxHp) * 100))) : 0;
    const isDead = Number(c.hp) <= 0;
    const conds = Array.isArray(c.conditions) ? c.conditions : [];
    const activeTurnLabel = activeGroupSize > 1 ? '&#10022; Active Cluster' : '&#10022; Active Turn';

    const cardClasses = [
      'combatant-card',
      c.isPc ? 'is-pc' : '',
      isInitMode && isActiveTurn ? 'is-active-turn' : '',
      isInitMode && hasActedThisRound ? 'is-acted-this-round' : '',
      isDead ? 'is-defeated' : ''
    ].filter(Boolean).join(' ');

    const initHtml = isInitMode
      ? '<div class="init-input-wrap">' +
          '<span class="init-label">Init</span>' +
          '<input type="number" class="init-input tabular" value="' + esc(c.initiative) + '" aria-label="Initiative for ' + esc(c.name) + '" data-init-input="' + esc(c.id) + '">' +
        '</div>'
      : '';

    const tempPill = Number(c.tempHp) > 0
      ? '<span class="temp-hp-pill">+' + esc(c.tempHp) + ' Temp</span>'
      : '';

    const condPillsHtml = conds.map(function (condId) {
      const extraClass = condId === 'Concentrating' ? ' is-concentrating' : '';
      return '<button type="button" class="cond-pill' + extraClass + '" data-cond-pill="' + esc(condId) + '" data-combatant-id="' + esc(c.id) + '">' +
        esc(condId) +
      '</button>';
    }).join('');

    let statDrawerHtml = '';
    if (c.expanded) {
      statDrawerHtml =
        '<div class="stat-drawer">' +
          renderAbilityBoxes(c.abilities, c.id) +
          '<div class="stat-details-list">' +
            '<div><strong>Speed:</strong> ' + esc(c.speed || '30 ft.') + '</div>' +
            (c.saves ? '<div><strong>Saves:</strong> ' + esc(c.saves) + '</div>' : '') +
            (c.resistances ? '<div><strong>Resistances / Vuln:</strong> ' + esc(c.resistances) + '</div>' : '') +
            (c.immunities ? '<div><strong>Immunities:</strong> ' + esc(c.immunities) + '</div>' : '') +
            (c.senses ? '<div><strong>Senses:</strong> ' + esc(c.senses) + '</div>' : '') +
            (c.notes ? '<div><strong>Notes:</strong> ' + esc(c.notes) + '</div>' : '') +
          '</div>' +
          (!c.isPc
            ? '<div><div class="field-label" style="margin-bottom:6px;">Attacks</div>' + renderAttacksList(c) + '</div>'
            : '') +
          '<div class="card-quick-btns">' +
            '<button type="button" class="btn btn-sm" data-edit-combatant="' + esc(c.id) + '">Edit Details</button>' +
            (!c.isPc
              ? '<button type="button" class="btn btn-sm" data-save-bestiary="' + esc(c.id) + '">Save to Bestiary</button>'
              : '') +
          '</div>' +
        '</div>';
    }

    const soloToggleHtml = isInitMode && isClusterMode && !c.isPc
      ? '<button type="button" class="btn btn-sm ' + (c.soloInitiative ? 'btn-primary' : '') + '" data-toggle-solo="' + esc(c.id) + '" title="Toggle Solo/Boss turn exception vs. Enemy Cluster">' +
          (c.soloInitiative ? '&#9733; Solo Turn' : 'In Cluster') +
        '</button>'
      : '';

    return (
      '<article class="' + cardClasses + '" data-combatant-card="' + esc(c.id) + '">' +
        '<div class="card-header-row">' +
          '<div class="card-identity">' +
            initHtml +
            '<div class="combatant-name-block">' +
              '<div class="combatant-name">' +
                '<span>' + esc(c.name) + '</span>' +
                (c.isPc ? '<span class="role-tag role-tag-pc">PC</span>' : '') +
                (isInitMode && isClusterMode && !c.isPc && c.soloInitiative ? '<span class="role-tag role-tag-turn">Solo / Boss</span>' : '') +
                (isInitMode && isActiveTurn ? '<span class="role-tag role-tag-turn">' + activeTurnLabel + '</span>' : '') +
                (isDead ? '<span class="role-tag role-tag-dead">0 HP</span>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="card-meta-badges">' +
            '<span class="ac-badge tabular" title="Armor Class"><span>AC</span> ' + esc(c.ac) + '</span>' +
          '</div>' +
        '</div>' +

        '<div class="hp-section">' +
          '<div class="hp-readout-row">' +
            '<div class="hp-numbers tabular">' +
              '<span data-hp-current="' + esc(c.id) + '">' + esc(c.hp) + '</span>' +
              '<span class="hp-max">/ ' + esc(c.maxHp) + ' HP</span>' +
              tempPill +
            '</div>' +
          '</div>' +
          '<div class="hp-track"><div class="hp-fill ' + hpClass(c.hp, c.maxHp) + '" style="width:' + pct + '%"></div></div>' +
          '<div class="hp-math-row">' +
            '<button type="button" class="btn btn-danger" data-hp-dmg="' + esc(c.id) + '">&minus; Dmg</button>' +
            '<input type="number" inputmode="numeric" min="0" placeholder="Amt" class="input hp-delta-input tabular" aria-label="HP amount for ' + esc(c.name) + '" data-hp-input="' + esc(c.id) + '">' +
            '<button type="button" class="btn btn-heal" data-hp-heal="' + esc(c.id) + '">+ Heal</button>' +
            '<button type="button" class="btn btn-sm" title="Set Temporary HP" data-hp-temp="' + esc(c.id) + '">Temp</button>' +
          '</div>' +
        '</div>' +

        '<div class="conditions-row">' +
          condPillsHtml +
          '<button type="button" class="btn btn-sm btn-ghost" data-open-conds="' + esc(c.id) + '">+ Condition</button>' +
        '</div>' +

        '<div class="card-footer-row">' +
          '<div class="card-quick-btns">' +
            (!c.isPc
              ? '<button type="button" class="btn btn-sm btn-primary" data-quick-attack="' + esc(c.id) + '" title="Roll this enemy\'s standard attack against a target">&#9876; Attack</button>'
              : '') +
            '<button type="button" class="btn btn-sm" data-toggle-stats="' + esc(c.id) + '">' +
              (c.expanded ? 'Stats &#9652;' : 'Stats &#9662;') +
            '</button>' +
            (!c.isPc
              ? '<button type="button" class="btn btn-sm" data-clone-combatant="' + esc(c.id) + '">+ Copy</button>'
              : '') +
            soloToggleHtml +
          '</div>' +
          '<button type="button" class="btn btn-sm btn-ghost" aria-label="Remove ' + esc(c.name) + '" data-remove-combatant="' + esc(c.id) + '">Remove</button>' +
        '</div>' +
        statDrawerHtml +
      '</article>'
    );
  }

  /* ------------------------------------------------------------------------
     Modals: Condition Picker, Temp HP, Monster Add/Edit, Save Encounter
     ------------------------------------------------------------------------ */

  function openConditionPickerModal(combatantId) {
    const c = S().getState().encounter.combatants.find(function (x) { return x.id === combatantId; });
    if (!c) return;
    const active = Array.isArray(c.conditions) ? c.conditions : [];
    const esc = U().escapeHtml;

    const bodyHtml =
      '<p class="section-subtitle">Tap any condition to toggle it on <strong>' + esc(c.name) + '</strong>.</p>' +
      '<div class="condition-picker-grid">' +
        DMHub.SRD.CONDITIONS.map(function (cond) {
          const isOn = active.indexOf(cond.id) !== -1;
          return '<button type="button" class="cond-choice-btn' + (isOn ? ' is-active' : '') + '" data-pick-cond="' + esc(cond.id) + '">' +
            '<span>' + esc(cond.id) + '</span>' +
            '<span>' + (isOn ? '&#10003;' : '+') + '</span>' +
          '</button>';
        }).join('') +
      '</div>';

    U().openModal({
      title: 'Conditions — ' + c.name,
      bodyHtml: bodyHtml,
      footerHtml: '<button type="button" class="btn btn-primary" id="cond-modal-done">Done</button>',
      onMount: function (root) {
        root.querySelectorAll('[data-pick-cond]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const condId = btn.getAttribute('data-pick-cond');
            S().toggleCondition(combatantId, condId);
            const nowOn = btn.classList.toggle('is-active');
            btn.lastElementChild.innerHTML = nowOn ? '&#10003;' : '+';
          });
        });
        root.querySelector('#cond-modal-done').addEventListener('click', U().closeModal);
      }
    });
  }

  function openTempHpModal(combatantId) {
    const c = S().getState().encounter.combatants.find(function (x) { return x.id === combatantId; });
    if (!c) return;
    const esc = U().escapeHtml;

    U().openModal({
      title: 'Temporary HP — ' + c.name,
      bodyHtml:
        '<p class="section-subtitle">Temporary HP absorbs damage before regular HP and cannot be healed.</p>' +
        '<div class="field-group">' +
          '<label class="field-label" for="temp-hp-val">Temporary HP Amount</label>' +
          '<input type="number" inputmode="numeric" min="0" id="temp-hp-val" class="input tabular" value="' + esc(c.tempHp || 0) + '">' +
        '</div>',
      footerHtml:
        '<button type="button" class="btn" id="temp-hp-clear">Clear Temp HP</button>' +
        '<button type="button" class="btn btn-primary" id="temp-hp-save">Apply</button>',
      onMount: function (root) {
        const input = root.querySelector('#temp-hp-val');
        input.focus();
        input.select();
        root.querySelector('#temp-hp-clear').addEventListener('click', function () {
          S().setTempHp(combatantId, 0);
          U().closeModal();
        });
        root.querySelector('#temp-hp-save').addEventListener('click', function () {
          S().setTempHp(combatantId, input.value);
          U().closeModal();
        });
      }
    });
  }

  function buildAttackEditorRow(atk, idx) {
    const esc = U().escapeHtml;
    const first = (atk.components && atk.components[0]) || { formula: '1d6+2', type: 'Slashing' };
    const second = (atk.components && atk.components[1]) || { formula: '', type: 'Poison' };
    const typeOptions = function (selected) {
      return DMHub.SRD.DAMAGE_TYPES.map(function (t) {
        return '<option value="' + esc(t) + '"' + (t === selected ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('');
    };

    return (
      '<div class="surface-card" style="padding:10px;" data-atk-row="' + idx + '">' +
        '<div class="form-grid-2" style="margin-bottom:8px;">' +
          '<div class="field-group"><label class="field-label">Attack Name</label>' +
            '<input type="text" class="input" data-atk-name value="' + esc(atk.name || '') + '" placeholder="e.g., Bite"></div>' +
          '<div class="field-group"><label class="field-label">To-Hit Bonus</label>' +
            '<input type="number" class="input tabular" data-atk-hit value="' + esc(atk.toHit != null ? atk.toHit : 4) + '"></div>' +
        '</div>' +
        '<div class="form-grid-2" style="margin-bottom:8px;">' +
          '<div class="field-group"><label class="field-label">Primary Damage</label>' +
            '<input type="text" class="input mono" data-atk-f1 value="' + esc(first.formula) + '" placeholder="1d8+3"></div>' +
          '<div class="field-group"><label class="field-label">Type</label>' +
            '<select class="select" data-atk-t1>' + typeOptions(first.type) + '</select></div>' +
        '</div>' +
        '<div class="form-grid-2">' +
          '<div class="field-group"><label class="field-label">Extra Damage (Opt.)</label>' +
            '<input type="text" class="input mono" data-atk-f2 value="' + esc(second.formula) + '" placeholder="2d6"></div>' +
          '<div class="field-group"><label class="field-label">Extra Type</label>' +
            '<select class="select" data-atk-t2>' + typeOptions(second.type) + '</select></div>' +
        '</div>' +
        '<div style="margin-top:8px;text-align:right;">' +
          '<button type="button" class="btn btn-sm btn-danger-soft" data-remove-atk-row>Remove Attack</button>' +
        '</div>' +
      '</div>'
    );
  }

  /**
   * Reusable Monster / Combatant Editor Modal (used for Add Enemy, Edit Combatant, and Bestiary CRUD)
   */
  function openMonsterEditorModal(options) {
    const opts = options || {};
    const existing = opts.monster || null;
    const isPc = Boolean(existing && existing.isPc);
    const esc = U().escapeHtml;
    const ab = (existing && existing.abilities) || { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 };
    const attacks = existing && Array.isArray(existing.attacks) && existing.attacks.length
      ? existing.attacks
      : (isPc ? [] : [{ name: 'Attack', toHit: 4, components: [{ formula: '1d6+2', type: 'Slashing' }] }]);

    const bestiaryOptions = S().getState().bestiary;
    const quickPickHtml = !existing && !opts.forBestiary && bestiaryOptions.length
      ? '<div class="field-group">' +
          '<label class="field-label" for="m-bestiary-fill">Quick-Fill from Local Bestiary</label>' +
          '<select id="m-bestiary-fill" class="select">' +
            '<option value="">— Create Custom Enemy —</option>' +
            bestiaryOptions.map(function (b) {
              return '<option value="' + esc(b.id) + '">' + esc(b.name) + ' (AC ' + b.ac + ', HP ' + b.maxHp + ')</option>';
            }).join('') +
          '</select>' +
        '</div>'
      : '';

    const bodyHtml =
      quickPickHtml +
      '<div class="form-grid-2">' +
        '<div class="field-group"><label class="field-label" for="m-name">Name</label>' +
          '<input type="text" id="m-name" class="input" value="' + esc(existing ? existing.name : '') + '" placeholder="e.g., Goblin Archer"></div>' +
        '<div class="field-group"><label class="field-label" for="m-speed">Speed</label>' +
          '<input type="text" id="m-speed" class="input" value="' + esc(existing ? existing.speed : '30 ft.') + '"></div>' +
      '</div>' +
      '<div class="form-grid-3">' +
        '<div class="field-group"><label class="field-label" for="m-ac">AC</label>' +
          '<input type="number" id="m-ac" class="input tabular" value="' + esc(existing ? existing.ac : 13) + '"></div>' +
        '<div class="field-group"><label class="field-label" for="m-hp">Max HP</label>' +
          '<input type="number" id="m-hp" class="input tabular" value="' + esc(existing ? existing.maxHp : 15) + '"></div>' +
        (!opts.forBestiary
          ? '<div class="field-group"><label class="field-label" for="m-init">Initiative</label>' +
              '<input type="number" id="m-init" class="input tabular" value="' + esc(existing ? existing.initiative : 10) + '"></div>'
          : '<div class="field-group"><label class="field-label" for="m-init">Init Mod</label>' +
              '<input type="text" id="m-init" class="input tabular" value="Auto (DEX)" disabled></div>') +
      '</div>' +
      '<div><div class="field-label" style="margin-bottom:6px;">Ability Scores</div>' +
        '<div class="form-grid-6">' +
          ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(function (k) {
            return '<div class="field-group"><label class="field-label" for="m-' + k + '">' + k.toUpperCase() + '</label>' +
              '<input type="number" id="m-' + k + '" class="input tabular" value="' + esc(ab[k] != null ? ab[k] : 10) + '"></div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="form-grid-2">' +
        '<div class="field-group"><label class="field-label" for="m-saves">Saving Throws</label>' +
          '<input type="text" id="m-saves" class="input" value="' + esc(existing ? existing.saves : '') + '" placeholder="DEX +4, WIS +2"></div>' +
        '<div class="field-group"><label class="field-label" for="m-senses">Senses / Passive Perc.</label>' +
          '<input type="text" id="m-senses" class="input" value="' + esc(existing ? existing.senses : '') + '" placeholder="Darkvision 60 ft., PP 11"></div>' +
      '</div>' +
      '<div class="form-grid-2">' +
        '<div class="field-group"><label class="field-label" for="m-res">Resistances / Vuln.</label>' +
          '<input type="text" id="m-res" class="input" value="' + esc(existing ? existing.resistances : '') + '" placeholder="Fire, Cold"></div>' +
        '<div class="field-group"><label class="field-label" for="m-imm">Immunities</label>' +
          '<input type="text" id="m-imm" class="input" value="' + esc(existing ? existing.immunities : '') + '" placeholder="Poison"></div>' +
      '</div>' +
      '<div class="field-group"><label class="field-label" for="m-notes">Quick Notes / Traits</label>' +
        '<textarea id="m-notes" class="textarea" style="min-height:70px;">' + esc(existing ? existing.notes : '') + '</textarea></div>' +
      (!isPc
        ? '<div>' +
            '<div class="section-header" style="margin-bottom:8px;">' +
              '<span class="field-label">Attacks</span>' +
              '<button type="button" class="btn btn-sm" id="m-add-atk">+ Add Attack</button>' +
            '</div>' +
            '<div id="m-attacks-container" class="list-stack">' +
              attacks.map(buildAttackEditorRow).join('') +
            '</div>' +
          '</div>'
        : '');

    U().openModal({
      title: opts.title || (existing ? 'Edit ' + existing.name : 'Add Enemy'),
      bodyHtml: bodyHtml,
      footerHtml:
        '<button type="button" class="btn" id="m-cancel">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="m-save">Save</button>',
      onMount: function (root) {
        const atkContainer = root.querySelector('#m-attacks-container');

        function wireRemoveButtons() {
          if (!atkContainer) return;
          atkContainer.querySelectorAll('[data-remove-atk-row]').forEach(function (btn) {
            btn.onclick = function () {
              btn.closest('[data-atk-row]').remove();
            };
          });
        }
        wireRemoveButtons();

        const addAtkBtn = root.querySelector('#m-add-atk');
        if (addAtkBtn && atkContainer) {
          addAtkBtn.addEventListener('click', function () {
            const idx = atkContainer.children.length;
            const wrapper = document.createElement('div');
            wrapper.innerHTML = buildAttackEditorRow({ name: '', toHit: 4, components: [{ formula: '1d6+2', type: 'Slashing' }] }, idx);
            atkContainer.appendChild(wrapper.firstElementChild);
            wireRemoveButtons();
          });
        }

        const quickFill = root.querySelector('#m-bestiary-fill');
        if (quickFill) {
          quickFill.addEventListener('change', function () {
            const b = bestiaryOptions.find(function (x) { return x.id === quickFill.value; });
            if (!b) return;
            root.querySelector('#m-name').value = b.name;
            root.querySelector('#m-speed').value = b.speed || '30 ft.';
            root.querySelector('#m-ac').value = b.ac;
            root.querySelector('#m-hp').value = b.maxHp;
            const dexMod = D().abilityMod(b.abilities ? b.abilities.dex : 10);
            root.querySelector('#m-init').value = Math.floor(Math.random() * 20) + 1 + dexMod;
            ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) {
              root.querySelector('#m-' + k).value = (b.abilities && b.abilities[k]) || 10;
            });
            root.querySelector('#m-saves').value = b.saves || '';
            root.querySelector('#m-senses').value = b.senses || '';
            root.querySelector('#m-res').value = b.resistances || '';
            root.querySelector('#m-imm').value = b.immunities || '';
            root.querySelector('#m-notes').value = b.notes || '';
            if (atkContainer) {
              atkContainer.innerHTML = (b.attacks || []).map(buildAttackEditorRow).join('');
              wireRemoveButtons();
            }
          });
        }

        root.querySelector('#m-cancel').addEventListener('click', U().closeModal);
        root.querySelector('#m-save').addEventListener('click', function () {
          const name = root.querySelector('#m-name').value.trim();
          if (!name) {
            U().showToast({ title: 'Name required', message: 'Please enter a name before saving.', tone: 'warning' });
            return;
          }
          const maxHp = Math.max(1, parseInt(root.querySelector('#m-hp').value, 10) || 10);
          const ac = Math.max(1, parseInt(root.querySelector('#m-ac').value, 10) || 10);
          const abilities = {};
          ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) {
            abilities[k] = parseInt(root.querySelector('#m-' + k).value, 10) || 10;
          });

          const collectedAttacks = [];
          if (atkContainer) {
            atkContainer.querySelectorAll('[data-atk-row]').forEach(function (row) {
              const aName = row.querySelector('[data-atk-name]').value.trim() || 'Attack';
              const aHit = parseInt(row.querySelector('[data-atk-hit]').value, 10) || 0;
              const f1 = row.querySelector('[data-atk-f1]').value.trim();
              const t1 = row.querySelector('[data-atk-t1]').value;
              const f2 = row.querySelector('[data-atk-f2]').value.trim();
              const t2 = row.querySelector('[data-atk-t2]').value;
              const comps = [];
              if (f1) comps.push({ formula: f1, type: t1 });
              if (f2) comps.push({ formula: f2, type: t2 });
              if (comps.length) {
                collectedAttacks.push({ name: aName, toHit: aHit, components: comps });
              }
            });
          }

          const payload = {
            name: name,
            ac: ac,
            maxHp: maxHp,
            speed: root.querySelector('#m-speed').value.trim() || '30 ft.',
            abilities: abilities,
            saves: root.querySelector('#m-saves').value.trim(),
            senses: root.querySelector('#m-senses').value.trim(),
            resistances: root.querySelector('#m-res').value.trim(),
            immunities: root.querySelector('#m-imm').value.trim(),
            notes: root.querySelector('#m-notes').value.trim(),
            attacks: collectedAttacks
          };

          if (typeof opts.onSave === 'function') {
            opts.onSave(payload, parseInt(root.querySelector('#m-init').value, 10) || 10);
          }
          U().closeModal();
        });
      }
    });
  }

  function openSaveEncounterModal() {
    const enc = S().getState().encounter;
    const esc = U().escapeHtml;
    U().openModal({
      title: 'Save Encounter to Library',
      bodyHtml:
        '<p class="section-subtitle">Saves all current enemies at full HP into your Prepared Encounter Library and takes an automatic rolling snapshot.</p>' +
        '<div class="field-group">' +
          '<label class="field-label" for="save-enc-name">Encounter Name</label>' +
          '<input type="text" id="save-enc-name" class="input" value="' + esc(enc.title) + '">' +
        '</div>' +
        '<div class="field-group">' +
          '<label class="field-label" for="save-enc-notes">Prep Notes (Optional)</label>' +
          '<textarea id="save-enc-notes" class="textarea" style="min-height:70px;" placeholder="Terrain, ambush triggers, loot..."></textarea>' +
        '</div>',
      footerHtml:
        '<button type="button" class="btn" id="save-enc-cancel">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="save-enc-confirm">Save Encounter</button>',
      onMount: function (root) {
        root.querySelector('#save-enc-cancel').addEventListener('click', U().closeModal);
        root.querySelector('#save-enc-confirm').addEventListener('click', function () {
          const title = root.querySelector('#save-enc-name').value.trim() || 'Prepared Encounter';
          const notes = root.querySelector('#save-enc-notes').value.trim();
          S().setEncounterTitle(title);
          S().saveCurrentEncounterToLibrary(title, notes);
          DMHub.Backup.createSnapshot('encounter-save');
          U().closeModal();
          U().showToast({ title: 'Encounter Saved', message: '"' + title + '" added to Prep Library + Snapshot saved.', tone: 'success' });
        });
      }
    });
  }

  /* ------------------------------------------------------------------------
     Main Encounter Hub Render
     ------------------------------------------------------------------------ */

  function render() {
    const container = document.getElementById('view-combat');
    if (!container) return;

    const state = S().getState();
    const enc = state.encounter;
    const isInitMode = enc.mode === 'initiative';
    const isClusterMode = state.settings.enemyInitiativeMode === 'clustered';
    const esc = U().escapeHtml;

    const turnBarHtml = isInitMode && enc.combatants.length > 0
      ? '<div class="turn-bar" id="initiative-turn-bar">' +
          '<div class="round-badge tabular" id="round-counter-badge">Round ' + esc(enc.round) + '</div>' +
          '<div class="turn-controls">' +
            '<button type="button" class="btn btn-sm" id="btn-prev-turn">&larr; Prev</button>' +
            '<button type="button" class="btn btn-sm btn-primary" id="btn-next-turn">Next Turn &rarr;</button>' +
            '<button type="button" class="btn btn-sm" id="btn-roll-enemy-init" title="Roll d20 + DEX for enemies">Roll Enemy Init</button>' +
            '<button type="button" class="btn btn-sm ' + (isClusterMode ? 'btn-primary' : '') + '" id="btn-toggle-cluster-mode" title="Cluster minions on one turn with Solo Boss exceptions">' +
              (isClusterMode ? 'Clustered: On' : 'Cluster Enemies') +
            '</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" id="btn-reset-combat">Reset</button>' +
          '</div>' +
        '</div>'
      : '';

    let listHtml = '';
    if (enc.combatants.length > 0) {
      let cardsHtml = '';
      if (isInitMode) {
        const len = enc.combatants.length;
        const activeIndices = S().getActiveTurnIndices ? S().getActiveTurnIndices() : [Math.max(0, Math.min(enc.activeIndex || 0, len - 1))];
        const activeSet = {};
        activeIndices.forEach(function (idx) { activeSet[idx] = true; });
        const startIdx = activeIndices.length ? activeIndices[0] : 0;
        const activeGroupSize = activeIndices.length;
        const parts = [];

        // Active turn (or active enemy cluster) pinned to top, followed by remaining combatants in current round
        for (let i = startIdx; i < len; i++) {
          parts.push(renderCombatantCard(enc.combatants[i], i, true, Boolean(activeSet[i]), false, isClusterMode, activeGroupSize));
        }

        // Wrapped-around combatants queued for the next round (rolodex loop)
        if (startIdx > 0) {
          parts.push(
            '<div class="rolodex-round-divider" id="rolodex-round-divider">' +
              '<span>Round ' + esc(enc.round + 1) + ' Begins</span>' +
            '</div>'
          );
          for (let j = 0; j < startIdx; j++) {
            parts.push(renderCombatantCard(enc.combatants[j], j, true, false, true, isClusterMode, activeGroupSize));
          }
        }
        cardsHtml = parts.join('');
      } else {
        cardsHtml = enc.combatants.map(function (c, i) {
          return renderCombatantCard(c, i, false, false, false, false, 1);
        }).join('');
      }
      listHtml = '<div class="combatant-list" id="combatant-list">' + cardsHtml + '</div>';
    } else {
      listHtml = '<div class="empty-state" id="encounter-empty-state">' +
        '<h3 class="empty-state-title">Your Battlefield Awaits</h3>' +
        '<p class="empty-state-desc">Add enemies manually, drop in your saved party, or load the starter Goblin Ambush sample encounter to test everything right away.</p>' +
        '<div class="empty-state-actions">' +
          '<button type="button" class="btn btn-primary" id="btn-empty-sample">Load Sample Encounter</button>' +
          '<button type="button" class="btn" id="btn-empty-add">+ Add Enemy</button>' +
        '</div>' +
      '</div>';
    }

    container.innerHTML =
      '<section class="surface-card" aria-label="Encounter and Monster Hub">' +
        '<div class="encounter-toolbar">' +
          '<div class="encounter-top-row">' +
            '<div>' +
              '<h2 class="section-title" id="encounter-heading">' + esc(enc.title) + '</h2>' +
              '<div class="section-subtitle">' +
                (isInitMode
                  ? (isClusterMode ? 'Initiative Rolodex &bull; Clustered minions + Solo Boss exceptions' : 'Initiative Rolodex &bull; Active turn pinned to top')
                  : 'Freeform Mode &bull; Fast HP, stats &amp; conditions') +
              '</div>' +
            '</div>' +
            '<div class="segmented" role="group" aria-label="Encounter mode toggle">' +
              '<button type="button" class="seg-btn' + (isInitMode ? ' is-active' : '') + '" id="mode-btn-initiative" data-set-mode="initiative">Initiative</button>' +
              '<button type="button" class="seg-btn' + (!isInitMode ? ' is-active' : '') + '" id="mode-btn-freeform" data-set-mode="freeform">Freeform</button>' +
            '</div>' +
          '</div>' +

          '<div class="encounter-actions-row">' +
            '<button type="button" class="btn btn-primary btn-sm" id="btn-add-enemy">+ Add Enemy</button>' +
            (state.party.length > 0
              ? '<button type="button" class="btn btn-sm" id="btn-drop-party">+ Drop Party (' + state.party.length + ')</button>'
              : '') +
            '<button type="button" class="btn btn-sm" id="btn-save-encounter">Save Encounter</button>' +
            (enc.combatants.length > 0
              ? '<button type="button" class="btn btn-sm btn-danger-soft" id="btn-clear-encounter" title="Clear this fight without ending the session">Clear Encounter</button>'
              : '') +
            '<button type="button" class="btn btn-sm" id="btn-end-session" title="Capture a session-end rolling snapshot">End Session</button>' +
          '</div>' +

          turnBarHtml +
        '</div>' +

        listHtml +
      '</section>';

    bindEvents(container);
  }

  function openClearEncounterModal() {
    const combatants = S().getState().encounter.combatants;
    const hasPcs = combatants.some(function (c) { return c.isPc; });
    const hasEnemies = combatants.some(function (c) { return !c.isPc; });

    U().openModal({
      title: 'Clear Current Encounter?',
      bodyHtml:
        '<p class="section-subtitle">Resets the active combat tracker and Round counter to 1 without ending your session. Your Saved Party, Bestiary, Notes, Roll Log, and Snapshots stay untouched.</p>',
      footerHtml:
        '<button type="button" class="btn" id="clear-enc-cancel">Cancel</button>' +
        (hasPcs && hasEnemies
          ? '<button type="button" class="btn btn-primary" id="clear-enc-enemies">Clear Enemies (Keep Party)</button>'
          : '') +
        '<button type="button" class="btn btn-danger" id="clear-enc-all">Clear All Combatants</button>',
      onMount: function (root) {
        root.querySelector('#clear-enc-cancel').addEventListener('click', U().closeModal);
        const btnEnemies = root.querySelector('#clear-enc-enemies');
        if (btnEnemies) {
          btnEnemies.addEventListener('click', function () {
            S().clearCurrentEncounter({ keepParty: true });
            U().closeModal();
            U().showToast({
              title: 'Enemies Cleared',
              message: 'Party kept intact & Round reset to 1. Ready for the next encounter!',
              tone: 'success'
            });
          });
        }
        root.querySelector('#clear-enc-all').addEventListener('click', function () {
          S().clearCurrentEncounter({ keepParty: false });
          U().closeModal();
          U().showToast({
            title: 'Encounter Cleared',
            message: 'Combat tracker cleared & Round reset to 1. Session data untouched.',
            tone: 'default'
          });
        });
      }
    });
  }

  /**
   * Batch Enemy Roster Builder Modal:
   * Pick multiple monsters & quantities from Local Bestiary and/or build custom
   * stat blocks on the spot, queue them in a staged roster list, and add all to Combat.
   */
  function openAddEnemiesBatchModal() {
    const esc = U().escapeHtml;
    const isClusterMode = S().getState().settings.enemyInitiativeMode === 'clustered';
    const bestiaryList = S().getState().bestiary;
    let activeTab = bestiaryList.length > 0 ? 'bestiary' : 'custom';
    let filterText = '';
    const queue = []; // [{ key, template, count, soloInitiative, isCustom }]

    function totalQueued() {
      return queue.reduce(function (sum, item) { return sum + item.count; }, 0);
    }

    function findQueued(key) {
      return queue.find(function (item) { return item.key === key; });
    }

    function setBestiaryQty(monster, delta) {
      const key = 'bst:' + monster.id;
      const existing = findQueued(key);
      if (existing) {
        existing.count = Math.max(0, Math.min(30, existing.count + delta));
        if (existing.count === 0) {
          const idx = queue.indexOf(existing);
          if (idx !== -1) queue.splice(idx, 1);
        }
      } else if (delta > 0) {
        queue.push({
          key: key,
          template: monster,
          count: Math.min(30, delta),
          soloInitiative: Boolean(monster.soloInitiative),
          isCustom: false
        });
      }
    }

    const dmgOpts = function (sel) {
      return DMHub.SRD.DAMAGE_TYPES.map(function (t) {
        return '<option value="' + esc(t) + '"' + (t === sel ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('');
    };

    U().openModal({
      title: 'Add Enemies to Combat',
      bodyHtml: '<div id="batch-enemy-modal-body" class="list-stack" style="gap:12px;"></div>',
      footerHtml:
        '<button type="button" class="btn" id="batch-enemy-cancel">Cancel</button>' +
        '<button type="button" class="btn btn-primary" id="batch-enemy-confirm" disabled>Add to Combat</button>',
      onMount: function (root) {
        const body = root.querySelector('#batch-enemy-modal-body');
        const btnConfirm = root.querySelector('#batch-enemy-confirm');
        root.querySelector('#batch-enemy-cancel').addEventListener('click', U().closeModal);

        function syncConfirmBtn() {
          const total = totalQueued();
          btnConfirm.disabled = total === 0;
          btnConfirm.textContent = total === 0
            ? 'Add to Combat'
            : (total === 1 ? 'Add 1 Enemy to Combat' : 'Add ' + total + ' Enemies to Combat');
        }

        function renderModalContent() {
          const currentBestiary = S().getState().bestiary;
          const filtered = filterText.trim()
            ? currentBestiary.filter(function (m) {
                return m.name.toLowerCase().indexOf(filterText.trim().toLowerCase()) !== -1;
              })
            : currentBestiary;

          const tabBarHtml =
            '<div class="segmented segmented-full" role="tablist">' +
              '<button type="button" class="seg-btn' + (activeTab === 'bestiary' ? ' is-active' : '') + '" data-batch-tab="bestiary">From Bestiary (' + currentBestiary.length + ')</button>' +
              '<button type="button" class="seg-btn' + (activeTab === 'custom' ? ' is-active' : '') + '" data-batch-tab="custom">Custom Stat Block</button>' +
            '</div>';

          let mainPanelHtml = '';
          if (activeTab === 'bestiary') {
            const listRows = filtered.length
              ? filtered.map(function (m) {
                  const q = findQueued('bst:' + m.id);
                  const qty = q ? q.count : 0;
                  const atkCount = Array.isArray(m.attacks) ? m.attacks.length : 0;
                  return (
                    '<div class="item-row" style="' + (qty > 0 ? 'border-color:var(--accent-primary-border);background:var(--accent-primary-soft);' : '') + '">' +
                      '<div class="item-row-main">' +
                        '<div class="item-row-title">' + esc(m.name) + '</div>' +
                        '<div class="item-row-meta mono">AC ' + esc(m.ac) + ' &bull; HP ' + esc(m.maxHp) + ' &bull; ' + atkCount + ' atk</div>' +
                      '</div>' +
                      '<div class="card-quick-btns">' +
                        '<button type="button" class="btn btn-sm" data-bst-dec="' + esc(m.id) + '"' + (qty <= 0 ? ' disabled' : '') + ' aria-label="Decrease ' + esc(m.name) + '">&minus;</button>' +
                        '<span class="mono" style="min-width:24px;text-align:center;font-weight:700;">' + qty + '</span>' +
                        '<button type="button" class="btn btn-sm btn-primary" data-bst-inc="' + esc(m.id) + '" aria-label="Increase ' + esc(m.name) + '">+</button>' +
                      '</div>' +
                    '</div>'
                  );
                }).join('')
              : '<p class="section-subtitle">' +
                  (currentBestiary.length ? 'No bestiary monsters match your filter.' : 'Your Local Bestiary is empty. Switch to Custom Stat Block to create monsters on the spot!') +
                '</p>';

            mainPanelHtml =
              (currentBestiary.length > 3
                ? '<input type="text" id="batch-bst-filter" class="input" value="' + esc(filterText) + '" placeholder="Filter bestiary by name...">'
                : '') +
              '<div class="list-stack" style="max-height:220px;overflow-y:auto;padding-right:2px;">' + listRows + '</div>';
          } else {
            mainPanelHtml =
              '<div class="surface-card" style="padding:12px;margin:0;">' +
                '<div class="list-stack" style="gap:8px;">' +
                  '<div class="form-grid-2">' +
                    '<div class="field-group"><label class="field-label" for="bc-name">Monster Name</label>' +
                      '<input type="text" id="bc-name" class="input" placeholder="e.g., Orc Raider"></div>' +
                    '<div class="field-group"><label class="field-label" for="bc-qty">Quantity</label>' +
                      '<input type="number" id="bc-qty" class="input tabular" min="1" max="30" value="1"></div>' +
                  '</div>' +
                  '<div class="form-grid-3">' +
                    '<div class="field-group"><label class="field-label" for="bc-ac">AC</label>' +
                      '<input type="number" id="bc-ac" class="input tabular" value="13"></div>' +
                    '<div class="field-group"><label class="field-label" for="bc-hp">Max HP</label>' +
                      '<input type="number" id="bc-hp" class="input tabular" value="15"></div>' +
                    '<div class="field-group"><label class="field-label" for="bc-dex">DEX (Init)</label>' +
                      '<input type="number" id="bc-dex" class="input tabular" value="12"></div>' +
                  '</div>' +
                  '<div class="form-grid-2">' +
                    '<div class="field-group"><label class="field-label" for="bc-speed">Speed</label>' +
                      '<input type="text" id="bc-speed" class="input" value="30 ft."></div>' +
                    '<div class="field-group"><label class="field-label" for="bc-aname">Primary Attack</label>' +
                      '<input type="text" id="bc-aname" class="input" value="Greataxe" placeholder="e.g., Bite"></div>' +
                  '</div>' +
                  '<div class="form-grid-3">' +
                    '<div class="field-group"><label class="field-label" for="bc-ahit">To-Hit</label>' +
                      '<input type="number" id="bc-ahit" class="input tabular" value="4"></div>' +
                    '<div class="field-group"><label class="field-label" for="bc-f1">Damage</label>' +
                      '<input type="text" id="bc-f1" class="input mono" value="1d8+2" placeholder="1d8+2"></div>' +
                    '<div class="field-group"><label class="field-label" for="bc-t1">Type</label>' +
                      '<select id="bc-t1" class="select">' + dmgOpts('Slashing') + '</select></div>' +
                  '</div>' +
                  '<div class="form-grid-2">' +
                    '<div class="field-group"><label class="field-label" for="bc-f2">Extra Damage (Opt.)</label>' +
                      '<input type="text" id="bc-f2" class="input mono" placeholder="e.g., 2d6"></div>' +
                    '<div class="field-group"><label class="field-label" for="bc-t2">Extra Type</label>' +
                      '<select id="bc-t2" class="select">' + dmgOpts('Poison') + '</select></div>' +
                  '</div>' +
                  '<div class="field-group"><label class="field-label" for="bc-notes">Quick Notes / Traits</label>' +
                    '<input type="text" id="bc-notes" class="input" placeholder="Pack Tactics, Darkvision 60 ft..."></div>' +
                  '<div class="card-quick-btns" style="justify-content:space-between;margin-top:2px;">' +
                    '<div class="card-quick-btns">' +
                      '<label style="display:inline-flex;align-items:center;gap:6px;font-size:0.76rem;color:var(--text-secondary);cursor:pointer;">' +
                        '<input type="checkbox" id="bc-save-bestiary" checked> Save to Bestiary' +
                      '</label>' +
                      (isClusterMode
                        ? '<label style="display:inline-flex;align-items:center;gap:6px;font-size:0.76rem;color:var(--text-secondary);cursor:pointer;">' +
                            '<input type="checkbox" id="bc-solo"> &#9733; Solo Boss' +
                          '</label>'
                        : '') +
                    '</div>' +
                    '<button type="button" class="btn btn-sm btn-primary" id="btn-queue-custom">+ Add to Roster</button>' +
                  '</div>' +
                '</div>' +
              '</div>';
          }

          const total = totalQueued();
          const queueHtml =
            '<div class="surface-card" style="padding:11px;margin:0;border-color:' + (total > 0 ? 'var(--accent-secondary-border)' : 'var(--border-subtle)') + ';">' +
              '<div class="section-header" style="margin-bottom:6px;">' +
                '<span class="field-label" style="color:var(--accent-secondary-text);">Staged Encounter Roster (' + total + ')</span>' +
                (total > 0 ? '<button type="button" class="btn btn-sm btn-ghost" id="btn-clear-queue">Clear List</button>' : '') +
              '</div>' +
              (queue.length
                ? '<div class="list-stack" style="gap:6px;max-height:150px;overflow-y:auto;">' +
                    queue.map(function (item) {
                      return '<div class="item-row" style="padding:7px 9px;">' +
                        '<div class="item-row-main">' +
                          '<div class="item-row-title">' + esc(item.template.name) + ' <span class="mono" style="color:var(--accent-secondary-text);">&times;' + item.count + '</span></div>' +
                          '<div class="item-row-meta mono">AC ' + esc(item.template.ac) + ' &bull; HP ' + esc(item.template.maxHp) + (item.isCustom ? ' &bull; Custom' : '') + '</div>' +
                        '</div>' +
                        '<div class="card-quick-btns">' +
                          (isClusterMode
                            ? '<button type="button" class="btn btn-sm ' + (item.soloInitiative ? 'btn-primary' : '') + '" data-q-solo="' + esc(item.key) + '">' + (item.soloInitiative ? '&#9733; Solo' : 'Cluster') + '</button>'
                            : '') +
                          '<button type="button" class="btn btn-sm" data-q-dec="' + esc(item.key) + '">&minus;</button>' +
                          '<button type="button" class="btn btn-sm" data-q-inc="' + esc(item.key) + '">+</button>' +
                          '<button type="button" class="btn btn-sm btn-danger-soft" data-q-rm="' + esc(item.key) + '">&times;</button>' +
                        '</div>' +
                      '</div>';
                    }).join('') +
                  '</div>'
                : '<p class="section-subtitle">Select monsters above (and set quantities) or create a custom stat block to build your encounter roster.</p>') +
            '</div>';

          body.innerHTML = tabBarHtml + mainPanelHtml + queueHtml;
          syncConfirmBtn();

          // Wire tab switch
          body.querySelectorAll('[data-batch-tab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              activeTab = btn.getAttribute('data-batch-tab');
              renderModalContent();
            });
          });

          // Wire Bestiary filter & +/- controls
          const flt = body.querySelector('#batch-bst-filter');
          if (flt) {
            flt.addEventListener('input', function () {
              filterText = flt.value;
              const pos = flt.selectionStart;
              renderModalContent();
              const nextFlt = body.querySelector('#batch-bst-filter');
              if (nextFlt) {
                nextFlt.focus();
                nextFlt.setSelectionRange(pos, pos);
              }
            });
          }

          body.querySelectorAll('[data-bst-inc]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              const m = S().getState().bestiary.find(function (x) { return x.id === btn.getAttribute('data-bst-inc'); });
              if (m) { setBestiaryQty(m, 1); renderModalContent(); }
            });
          });
          body.querySelectorAll('[data-bst-dec]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              const m = S().getState().bestiary.find(function (x) { return x.id === btn.getAttribute('data-bst-dec'); });
              if (m) { setBestiaryQty(m, -1); renderModalContent(); }
            });
          });

          // Wire Custom monster queue button
          const btnQCustom = body.querySelector('#btn-queue-custom');
          if (btnQCustom) {
            btnQCustom.addEventListener('click', function () {
              const nm = body.querySelector('#bc-name').value.trim();
              if (!nm) {
                U().showToast({ title: 'Name Required', message: 'Enter a monster name first.', tone: 'warning' });
                body.querySelector('#bc-name').focus();
                return;
              }
              const qty = Math.max(1, Math.min(30, parseInt(body.querySelector('#bc-qty').value, 10) || 1));
              const ac = Math.max(1, parseInt(body.querySelector('#bc-ac').value, 10) || 12);
              const maxHp = Math.max(1, parseInt(body.querySelector('#bc-hp').value, 10) || 12);
              const dex = Math.max(1, parseInt(body.querySelector('#bc-dex').value, 10) || 10);
              const speed = body.querySelector('#bc-speed').value.trim() || '30 ft.';
              const aname = body.querySelector('#bc-aname').value.trim() || 'Attack';
              const ahit = parseInt(body.querySelector('#bc-ahit').value, 10) || 0;
              const f1 = body.querySelector('#bc-f1').value.trim() || '1d6+2';
              const t1 = body.querySelector('#bc-t1').value;
              const f2 = body.querySelector('#bc-f2').value.trim();
              const t2 = body.querySelector('#bc-t2').value;
              const notes = body.querySelector('#bc-notes').value.trim();
              const saveToBst = Boolean(body.querySelector('#bc-save-bestiary') && body.querySelector('#bc-save-bestiary').checked);
              const isSolo = Boolean(body.querySelector('#bc-solo') && body.querySelector('#bc-solo').checked);

              const comps = [{ formula: f1, type: t1 }];
              if (f2) comps.push({ formula: f2, type: t2 });

              const tpl = {
                name: nm,
                ac: ac,
                maxHp: maxHp,
                speed: speed,
                abilities: { str: 12, dex: dex, con: 12, int: 8, wis: 10, cha: 8 },
                notes: notes,
                soloInitiative: isSolo,
                attacks: [{ name: aname, toHit: ahit, components: comps }]
              };

              if (saveToBst) {
                const saved = S().saveBestiaryMonster(tpl);
                setBestiaryQty(saved, qty);
                const qItem = findQueued('bst:' + saved.id);
                if (qItem) qItem.soloInitiative = isSolo;
              } else {
                queue.push({
                  key: 'cst:' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
                  template: tpl,
                  count: qty,
                  soloInitiative: isSolo,
                  isCustom: true
                });
              }

              U().showToast({ title: 'Added to Roster', message: nm + ' ×' + qty + ' queued for combat.', tone: 'success', duration: 1800 });
              renderModalContent();
            });
          }

          // Wire Staged Queue controls
          const btnClearQ = body.querySelector('#btn-clear-queue');
          if (btnClearQ) {
            btnClearQ.addEventListener('click', function () {
              queue.length = 0;
              renderModalContent();
            });
          }
          body.querySelectorAll('[data-q-inc]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              const item = findQueued(btn.getAttribute('data-q-inc'));
              if (item) { item.count = Math.min(30, item.count + 1); renderModalContent(); }
            });
          });
          body.querySelectorAll('[data-q-dec]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              const item = findQueued(btn.getAttribute('data-q-dec'));
              if (!item) return;
              item.count -= 1;
              if (item.count <= 0) {
                const idx = queue.indexOf(item);
                if (idx !== -1) queue.splice(idx, 1);
              }
              renderModalContent();
            });
          });
          body.querySelectorAll('[data-q-rm]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              const item = findQueued(btn.getAttribute('data-q-rm'));
              const idx = queue.indexOf(item);
              if (idx !== -1) queue.splice(idx, 1);
              renderModalContent();
            });
          });
          body.querySelectorAll('[data-q-solo]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              const item = findQueued(btn.getAttribute('data-q-solo'));
              if (item) { item.soloInitiative = !item.soloInitiative; renderModalContent(); }
            });
          });
        }

        btnConfirm.addEventListener('click', function () {
          if (!queue.length) return;
          const addedCount = S().addEnemiesBatch(queue);
          U().closeModal();
          U().showToast({
            title: addedCount === 1 ? 'Added 1 Enemy to Combat' : 'Added ' + addedCount + ' Enemies to Combat',
            message: 'Initiative rolled, logged to Roll Log & sorted.',
            tone: 'success'
          });
        });

        renderModalContent();
      }
    });
  }

  /**
   * Quick Standard Attack Modal launched directly from any enemy stat card.
   * Pick target (auto-fills AC), attack count, Normal/Advantage/Disadvantage,
   * and situational To-Hit modifier -> Roll Attack -> Reaction Overrides ->
   * Roll Split Damage -> 1-Click Apply Damage to target (with Concentration DC toast).
   */
  function openQuickAttackModal(combatantId) {
    const state = S().getState();
    const attacker = state.encounter.combatants.find(function (c) { return c.id === combatantId; });
    if (!attacker) return;

    const esc = U().escapeHtml;
    const attacks = Array.isArray(attacker.attacks) && attacker.attacks.length
      ? attacker.attacks
      : [{ name: 'Standard Attack', toHit: 4, components: [{ formula: '1d6+2', type: 'Slashing' }] }];

    // Build target choices: Active PCs first, then Saved Party PCs, then other active combatants, then Manual AC
    const targetChoices = [];
    const seenPcIds = {};
    state.encounter.combatants.forEach(function (c) {
      if (c.isPc) {
        if (c.pcId) seenPcIds[c.pcId] = true;
        targetChoices.push({ key: 'cmb:' + c.id, combatantId: c.id, name: c.name, ac: Number(c.ac) || 10, group: 'Active Party' });
      }
    });
    state.party.forEach(function (pc) {
      if (!seenPcIds[pc.id] && !targetChoices.some(function (t) { return t.name === pc.name; })) {
        targetChoices.push({ key: 'pc:' + pc.id, combatantId: null, name: pc.name, ac: Number(pc.ac) || 10, group: 'Saved Party' });
      }
    });
    state.encounter.combatants.forEach(function (c) {
      if (!c.isPc && c.id !== attacker.id) {
        targetChoices.push({ key: 'cmb:' + c.id, combatantId: c.id, name: c.name, ac: Number(c.ac) || 10, group: 'Other Combatants' });
      }
    });

    const qa = {
      attackIdx: 0,
      targetKey: targetChoices.length ? targetChoices[0].key : 'manual',
      targetAC: targetChoices.length ? targetChoices[0].ac : 15,
      numAttacks: 1,
      mode: 'normal', // 'normal' | 'advantage' | 'disadvantage'
      extraMod: 0,
      batch: null,
      damage: null,
      showMath: state.settings.defaultRollMathVisible === 'detailed',
      damageApplied: false
    };

    function getSelectedAttack() {
      return attacks[qa.attackIdx] || attacks[0];
    }

    function getSelectedTarget() {
      return targetChoices.find(function (t) { return t.key === qa.targetKey; }) || null;
    }

    function recalcDamageTotals() {
      if (!qa.damage) return;
      qa.damage.rows.forEach(function (r) {
        r.effectiveTotal = D().applyDamageMultiplier(r.rawTotal, r.multiplier);
      });
      qa.damage.grandTotal = qa.damage.rows.reduce(function (acc, r) { return acc + r.effectiveTotal; }, 0);
    }

    U().openModal({
      title: attacker.name + ' — Quick Attack',
      bodyHtml: '<div id="qa-modal-body" class="list-stack" style="gap:12px;"></div>',
      footerHtml:
        '<button type="button" class="btn" id="qa-close-btn">Close</button>' +
        '<button type="button" class="btn btn-primary" id="qa-roll-btn">&#9876; Roll Attack</button>',
      onMount: function (root) {
        const body = root.querySelector('#qa-modal-body');
        const btnRoll = root.querySelector('#qa-roll-btn');
        root.querySelector('#qa-close-btn').addEventListener('click', U().closeModal);

        function doRollAttack() {
          const atk = getSelectedAttack();
          const tgt = getSelectedTarget();
          const tgtName = tgt ? tgt.name : 'Manual AC';
          const effectiveBonus = (Number(atk.toHit) || 0) + (Number(qa.extraMod) || 0);
          const cfg = S().getState().settings;

          qa.batch = D().rollBatchAttacks({
            count: qa.numAttacks,
            toHitBonus: effectiveBonus,
            targetAC: qa.targetAC,
            mode: qa.mode,
            nat20AutoHit: cfg.nat20AutoHit
          });
          qa.damage = null;
          qa.damageApplied = false;

          let hits = 0, crits = 0;
          qa.batch.attacks.forEach(function (a) {
            if (a.status === 'hit') hits++;
            else if (a.status === 'crit') crits++;
          });
          const summary = (hits + crits) === 0
            ? 'All Missed vs. AC ' + qa.targetAC
            : (hits ? hits + ' Hit' + (hits > 1 ? 's' : '') : '') +
              (hits && crits ? ', ' : '') +
              (crits ? crits + ' Crit' + (crits > 1 ? 's' : '') : '') +
              ' vs. AC ' + qa.targetAC + ' (' + tgtName + ')';

          S().addRollLogEntry({
            kind: 'attack',
            title: attacker.name + ' — ' + atk.name + ' (' + qa.numAttacks + '×)',
            summary: summary,
            breakdown: qa.batch.attacks.map(function (a) {
              return '#' + a.index + ' [' + a.status.toUpperCase() + ']: ' + a.breakdown;
            }).join('\n')
          });

          renderQa();
        }

        function doRollDamage() {
          if (!qa.batch) return;
          let hits = 0, crits = 0;
          qa.batch.attacks.forEach(function (a) {
            if (a.status === 'hit') hits++;
            else if (a.status === 'crit') crits++;
          });
          if (hits + crits === 0) return;

          const atk = getSelectedAttack();
          const cfg = S().getState().settings;
          qa.damage = D().rollSplitDamage({
            hits: hits,
            crits: crits,
            components: atk.components || [{ formula: '1d6+2', type: 'Slashing' }],
            critRule: cfg.critRule
          });
          qa.damageApplied = false;

          S().addRollLogEntry({
            kind: 'damage',
            title: attacker.name + ' — ' + atk.name + ' Damage',
            summary: qa.damage.grandTotal + ' Total (' + qa.damage.rows.map(function (r) { return r.effectiveTotal + ' ' + r.type; }).join(' + ') + ')',
            breakdown: qa.damage.rows.map(function (r) {
              return r.type + ':\n  ' + r.breakdownLines.join('\n  ');
            }).join('\n')
          });

          renderQa();
        }

        function renderQa() {
          const atk = getSelectedAttack();
          const effectiveBonus = (Number(atk.toHit) || 0) + (Number(qa.extraMod) || 0);
          const compText = (atk.components || []).map(function (c) { return c.formula + ' ' + c.type; }).join(' + ');

          const atkSelectHtml = attacks.length > 1
            ? '<div class="field-group">' +
                '<label class="field-label" for="qa-atk-select">Attack Action</label>' +
                '<select id="qa-atk-select" class="select">' +
                  attacks.map(function (a, i) {
                    const cs = (a.components || []).map(function (c) { return c.formula + ' ' + c.type; }).join(' + ');
                    return '<option value="' + i + '"' + (i === qa.attackIdx ? ' selected' : '') + '>' +
                      esc(a.name) + ' (' + D().formatSigned(Number(a.toHit) || 0) + ' • ' + esc(cs) + ')' +
                    '</option>';
                  }).join('') +
                '</select>' +
              '</div>'
            : '<div class="item-row" style="padding:8px 10px;">' +
                '<div><strong>' + esc(atk.name) + '</strong>' +
                '<div class="section-subtitle mono">' + D().formatSigned(Number(atk.toHit) || 0) + ' to hit &bull; ' + esc(compText) + '</div></div>' +
                '<span class="role-tag role-tag-turn">Standard Attack</span>' +
              '</div>';

          const targetOptsHtml =
            targetChoices.map(function (t) {
              return '<option value="' + esc(t.key) + '"' + (t.key === qa.targetKey ? ' selected' : '') + '>' +
                esc(t.name) + ' (AC ' + esc(t.ac) + ')' +
              '</option>';
            }).join('') +
            '<option value="manual"' + (qa.targetKey === 'manual' ? ' selected' : '') + '>Manual AC</option>';

          const setupHtml =
            atkSelectHtml +
            '<div class="form-grid-2">' +
              '<div class="field-group">' +
                '<label class="field-label" for="qa-target">Target</label>' +
                '<select id="qa-target" class="select">' + targetOptsHtml + '</select>' +
              '</div>' +
              '<div class="field-group">' +
                '<label class="field-label" for="qa-ac">Target AC</label>' +
                '<input type="number" id="qa-ac" class="input tabular" min="1" max="40" value="' + esc(qa.targetAC) + '">' +
              '</div>' +
            '</div>' +
            '<div class="form-grid-2">' +
              '<div class="field-group">' +
                '<label class="field-label">Number of Attacks</label>' +
                '<div class="stepper-control">' +
                  '<button type="button" class="btn btn-sm" id="qa-num-dec">&minus;</button>' +
                  '<input type="number" id="qa-num-in" class="input tabular" min="1" max="20" value="' + esc(qa.numAttacks) + '">' +
                  '<button type="button" class="btn btn-sm" id="qa-num-inc">+</button>' +
                '</div>' +
              '</div>' +
              '<div class="field-group">' +
                '<label class="field-label">Extra To-Hit Mod (Total ' + D().formatSigned(effectiveBonus) + ')</label>' +
                '<div class="stepper-control">' +
                  '<button type="button" class="btn btn-sm" id="qa-mod-dec">&minus;</button>' +
                  '<input type="number" id="qa-mod-in" class="input tabular" value="' + esc(qa.extraMod) + '">' +
                  '<button type="button" class="btn btn-sm" id="qa-mod-inc">+</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="field-group">' +
              '<label class="field-label">Roll Modifier</label>' +
              '<div class="segmented segmented-full">' +
                '<button type="button" class="seg-btn' + (qa.mode === 'normal' ? ' is-active' : '') + '" data-qa-mode="normal">Normal</button>' +
                '<button type="button" class="seg-btn' + (qa.mode === 'advantage' ? ' is-active' : '') + '" data-qa-mode="advantage">Advantage</button>' +
                '<button type="button" class="seg-btn' + (qa.mode === 'disadvantage' ? ' is-active' : '') + '" data-qa-mode="disadvantage">Disadvantage</button>' +
              '</div>' +
            '</div>';

          let resultsHtml = '';
          if (qa.batch) {
            let hits = 0, crits = 0;
            qa.batch.attacks.forEach(function (a) {
              if (a.status === 'hit') hits++;
              else if (a.status === 'crit') crits++;
            });
            const tgt = getSelectedTarget();
            const summaryText = (hits + crits) === 0
              ? 'All Missed vs. AC ' + qa.batch.targetAC
              : (hits ? hits + ' Hit' + (hits > 1 ? 's' : '') : '') +
                (hits && crits ? ', ' : '') +
                (crits ? crits + ' Crit' + (crits > 1 ? 's' : '') : '') +
                ' vs. AC ' + qa.batch.targetAC;

            const chipsHtml = qa.batch.attacks.map(function (a, i) {
              const cls = a.status === 'crit' ? 'is-crit' : (a.status === 'hit' ? 'is-hit' : 'is-miss');
              const lbl = a.status === 'crit' ? 'CRIT!' : (a.status === 'hit' ? 'HIT' : 'MISS');
              return '<button type="button" class="attack-chip ' + cls + '" data-qa-chip="' + i + '" title="Tap to toggle Hit/Miss (e.g., Shield reaction)">' +
                '<div class="attack-chip-top"><span>#' + a.index + '</span><span class="mono">' + a.total + '</span></div>' +
                '<div class="attack-chip-status">' + lbl + (a.overridden ? ' *' : '') + '</div>' +
                (qa.showMath ? '<div class="section-subtitle mono" style="font-size:0.68rem;">' + esc(a.breakdown) + '</div>' : '') +
              '</button>';
            }).join('');

            let dmgHtml = '';
            if (qa.damage) {
              const rowsHtml = qa.damage.rows.map(function (r, idx) {
                const pills = [
                  ['normal', '1×'],
                  ['resist', '½ Res'],
                  ['vuln', '2× Vuln'],
                  ['immune', '0 Imm']
                ].map(function (pair) {
                  return '<button type="button" class="mult-pill' + (r.multiplier === pair[0] ? ' is-active' : '') + '" data-mult="' + pair[0] + '" data-qa-mrow="' + idx + '" data-qa-mval="' + pair[0] + '">' + pair[1] + '</button>';
                }).join('');

                return '<div class="split-damage-row">' +
                  '<div class="split-damage-top">' +
                    '<span class="damage-type-name">' + esc(r.type) + '</span>' +
                    '<span class="damage-type-amount tabular">' + r.effectiveTotal + (r.effectiveTotal !== r.rawTotal ? '<span class="damage-raw-note">(raw ' + r.rawTotal + ')</span>' : '') + '</span>' +
                  '</div>' +
                  '<div class="mult-pills">' + pills + '</div>' +
                  (qa.showMath ? '<div class="die-math-box" style="white-space:pre-wrap;">' + esc(r.breakdownLines.join('\n')) + '</div>' : '') +
                '</div>';
              }).join('');

              const canApply = Boolean(tgt && tgt.combatantId && qa.damage.grandTotal > 0);
              dmgHtml =
                '<div class="list-stack" style="gap:8px;margin-top:8px;">' + rowsHtml + '</div>' +
                '<div class="grand-total-bar">' +
                  '<span class="grand-total-label">Grand Total Damage</span>' +
                  '<span class="grand-total-value tabular">' + qa.damage.grandTotal + '</span>' +
                '</div>' +
                (canApply
                  ? '<button type="button" class="btn btn-danger btn-block" id="qa-apply-dmg"' + (qa.damageApplied ? ' disabled' : '') + ' style="margin-top:8px;">' +
                      (qa.damageApplied ? '&#10003; Applied ' + qa.damage.grandTotal + ' Damage to ' + esc(tgt.name) : 'Apply ' + qa.damage.grandTotal + ' Damage to ' + esc(tgt.name)) +
                    '</button>'
                  : '');
            }

            resultsHtml =
              '<div class="surface-card" style="padding:12px;margin:0;border-color:var(--accent-primary-border);">' +
                '<div class="section-header" style="margin-bottom:8px;">' +
                  '<strong style="font-size:0.95rem;">' + esc(summaryText) + '</strong>' +
                  '<button type="button" class="btn btn-sm btn-ghost" id="qa-toggle-math">' + (qa.showMath ? 'Hide Die Math' : 'Show Die Math') + '</button>' +
                '</div>' +
                '<div class="section-subtitle" style="margin-bottom:8px;">Tap any roll chip to toggle Hit/Miss for reactions like <em>Shield</em>.</div>' +
                '<div class="attack-chips-grid">' + chipsHtml + '</div>' +
                ((hits + crits) > 0
                  ? '<button type="button" class="btn btn-primary btn-block" id="qa-roll-dmg-btn" style="margin-top:8px;">' +
                      (qa.damage ? 'Re-roll Damage (' + (hits + crits) + ' Hit' + (hits + crits > 1 ? 's' : '') + ')' : 'Roll Damage (' + (hits + crits) + ' Confirmed)') +
                    '</button>'
                  : '') +
                dmgHtml +
              '</div>';
          }

          body.innerHTML = setupHtml + resultsHtml;
          btnRoll.innerHTML = qa.batch ? '&#9876; Roll Again' : '&#9876; Roll Attack';

          // Bind setup controls
          const atkSel = body.querySelector('#qa-atk-select');
          if (atkSel) {
            atkSel.addEventListener('change', function () {
              qa.attackIdx = parseInt(atkSel.value, 10) || 0;
              qa.batch = null;
              qa.damage = null;
              renderQa();
            });
          }

          const tgtSel = body.querySelector('#qa-target');
          if (tgtSel) {
            tgtSel.addEventListener('change', function () {
              qa.targetKey = tgtSel.value;
              const t = getSelectedTarget();
              if (t) qa.targetAC = t.ac;
              renderQa();
            });
          }

          const acIn = body.querySelector('#qa-ac');
          if (acIn) {
            acIn.addEventListener('change', function () {
              qa.targetAC = Math.max(1, Math.min(40, parseInt(acIn.value, 10) || 10));
            });
          }

          body.querySelector('#qa-num-dec').addEventListener('click', function () {
            qa.numAttacks = Math.max(1, qa.numAttacks - 1);
            renderQa();
          });
          body.querySelector('#qa-num-inc').addEventListener('click', function () {
            qa.numAttacks = Math.min(20, qa.numAttacks + 1);
            renderQa();
          });
          body.querySelector('#qa-num-in').addEventListener('change', function (e) {
            qa.numAttacks = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1));
            renderQa();
          });

          body.querySelector('#qa-mod-dec').addEventListener('click', function () {
            qa.extraMod -= 1;
            renderQa();
          });
          body.querySelector('#qa-mod-inc').addEventListener('click', function () {
            qa.extraMod += 1;
            renderQa();
          });
          body.querySelector('#qa-mod-in').addEventListener('change', function (e) {
            qa.extraMod = parseInt(e.target.value, 10) || 0;
            renderQa();
          });

          body.querySelectorAll('[data-qa-mode]').forEach(function (b) {
            b.addEventListener('click', function () {
              qa.mode = b.getAttribute('data-qa-mode');
              renderQa();
            });
          });

          const btnMath = body.querySelector('#qa-toggle-math');
          if (btnMath) {
            btnMath.addEventListener('click', function () {
              qa.showMath = !qa.showMath;
              renderQa();
            });
          }

          body.querySelectorAll('[data-qa-chip]').forEach(function (chip) {
            chip.addEventListener('click', function () {
              const idx = parseInt(chip.getAttribute('data-qa-chip'), 10);
              const item = qa.batch && qa.batch.attacks[idx];
              if (!item) return;
              if (item.status === 'miss') item.status = item.initialStatus === 'crit' ? 'crit' : 'hit';
              else item.status = 'miss';
              item.overridden = item.status !== item.initialStatus;
              qa.damage = null;
              qa.damageApplied = false;
              renderQa();
            });
          });

          const btnDmg = body.querySelector('#qa-roll-dmg-btn');
          if (btnDmg) btnDmg.addEventListener('click', doRollDamage);

          body.querySelectorAll('[data-qa-mrow]').forEach(function (pill) {
            pill.addEventListener('click', function () {
              const rIdx = parseInt(pill.getAttribute('data-qa-mrow'), 10);
              const mult = pill.getAttribute('data-qa-mval');
              if (qa.damage && qa.damage.rows[rIdx]) {
                qa.damage.rows[rIdx].multiplier = mult;
                recalcDamageTotals();
                qa.damageApplied = false;
                renderQa();
              }
            });
          });

          const btnApply = body.querySelector('#qa-apply-dmg');
          if (btnApply) {
            btnApply.addEventListener('click', function () {
              const tgt = getSelectedTarget();
              if (!tgt || !tgt.combatantId || !qa.damage || qa.damage.grandTotal <= 0) return;
              const res = S().applyHpDelta(tgt.combatantId, qa.damage.grandTotal, 'damage');
              qa.damageApplied = true;
              renderQa();
              U().showToast({
                title: 'Damage Applied',
                message: tgt.name + ' took ' + qa.damage.grandTotal + ' damage.',
                tone: 'danger',
                duration: 2400
              });
              if (res && res.concentrationDC !== null) {
                U().showConcentrationToast(res.combatant, res.damageTaken, res.concentrationDC);
              }
            });
          }
        }

        btnRoll.addEventListener('click', doRollAttack);
        renderQa();
      }
    });
  }

  function handleApplyHp(id, kind, container) {
    const input = container.querySelector('[data-hp-input="' + id + '"]');
    if (!input) return;
    const val = parseInt(input.value, 10);
    if (!val || val <= 0) {
      input.focus();
      return;
    }
    input.value = '';
    const res = S().applyHpDelta(id, val, kind);
    if (res && res.concentrationDC !== null) {
      U().showConcentrationToast(res.combatant, res.damageTaken, res.concentrationDC);
    }
  }

  function bindEvents(container) {
    container.querySelectorAll('[data-set-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S().setEncounterMode(btn.getAttribute('data-set-mode'));
      });
    });

    const btnAdd = container.querySelector('#btn-add-enemy');
    const btnEmptyAdd = container.querySelector('#btn-empty-add');
    if (btnAdd) btnAdd.addEventListener('click', openAddEnemiesBatchModal);
    if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', openAddEnemiesBatchModal);

    const btnEmptySample = container.querySelector('#btn-empty-sample');
    if (btnEmptySample) {
      btnEmptySample.addEventListener('click', function () {
        S().loadSampleData();
        U().showToast({ title: 'Sample Encounter Loaded', message: '3 PCs, Goblins, Goblin Boss, and a Wolf are ready.', tone: 'success' });
      });
    }

    const btnDropParty = container.querySelector('#btn-drop-party');
    if (btnDropParty) {
      btnDropParty.addEventListener('click', function () {
        const count = S().dropPartyIntoEncounter();
        U().showToast({
          title: count > 0 ? 'Party Joined Encounter' : 'Party Already Present',
          message: count > 0 ? count + ' PC(s) added to the tracker.' : 'All saved PCs are already in this encounter.',
          tone: count > 0 ? 'success' : 'default'
        });
      });
    }

    const btnSaveEnc = container.querySelector('#btn-save-encounter');
    if (btnSaveEnc) btnSaveEnc.addEventListener('click', openSaveEncounterModal);

    const btnClearEnc = container.querySelector('#btn-clear-encounter');
    if (btnClearEnc) btnClearEnc.addEventListener('click', openClearEncounterModal);

    const btnEndSession = container.querySelector('#btn-end-session');
    if (btnEndSession) {
      btnEndSession.addEventListener('click', function () {
        DMHub.Backup.createSnapshot('session-end').then(function () {
          U().showToast({
            title: 'Session Snapshot Saved',
            message: 'Captured to your 4-slot rolling backup history.',
            tone: 'success',
            actionLabel: 'Open Backups',
            onAction: function () { DMHub.App.openSection('settings'); }
          });
        });
      });
    }

    const btnNext = container.querySelector('#btn-next-turn');
    if (btnNext) btnNext.addEventListener('click', S().nextTurn);

    const btnPrev = container.querySelector('#btn-prev-turn');
    if (btnPrev) btnPrev.addEventListener('click', S().prevTurn);

    const btnRollInit = container.querySelector('#btn-roll-enemy-init');
    if (btnRollInit) {
      btnRollInit.addEventListener('click', function () {
        S().rollEnemyInitiatives();
        U().showToast({ title: 'Enemy Initiative Rolled', message: 'Logged to Roll Log & sorted high-to-low.', tone: 'default', duration: 2800 });
      });
    }

    const btnCluster = container.querySelector('#btn-toggle-cluster-mode');
    if (btnCluster) {
      btnCluster.addEventListener('click', function () {
        const cur = S().getState().settings.enemyInitiativeMode;
        const next = cur === 'clustered' ? 'individual' : 'clustered';
        S().setEnemyInitiativeMode(next);
        U().showToast({
          title: next === 'clustered' ? 'Enemy Clustering Active' : 'Individual Enemy Turns',
          message: next === 'clustered' ? 'Minions share one turn; tap "In Cluster" on any boss to make it Solo.' : 'Every enemy acts on its own turn.',
          duration: 3000
        });
      });
    }

    container.querySelectorAll('[data-toggle-solo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-toggle-solo');
        S().toggleCombatantSoloInit(id);
      });
    });

    const btnReset = container.querySelector('#btn-reset-combat');
    if (btnReset) btnReset.addEventListener('click', S().resetCombatTracker);

    // Initiative number changes
    container.querySelectorAll('[data-init-input]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        S().updateCombatantInitiative(inp.getAttribute('data-init-input'), inp.value);
      });
    });

    // Fast HP Math
    container.querySelectorAll('[data-hp-dmg]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleApplyHp(btn.getAttribute('data-hp-dmg'), 'damage', container);
      });
    });

    container.querySelectorAll('[data-hp-heal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleApplyHp(btn.getAttribute('data-hp-heal'), 'heal', container);
      });
    });

    container.querySelectorAll('[data-hp-input]').forEach(function (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleApplyHp(inp.getAttribute('data-hp-input'), 'damage', container);
        }
      });
    });

    container.querySelectorAll('[data-hp-temp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openTempHpModal(btn.getAttribute('data-hp-temp'));
      });
    });

    // Conditions
    container.querySelectorAll('[data-open-conds]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConditionPickerModal(btn.getAttribute('data-open-conds'));
      });
    });

    container.querySelectorAll('[data-cond-pill]').forEach(function (pill) {
      pill.addEventListener('click', function (e) {
        e.stopPropagation();
        const condId = pill.getAttribute('data-cond-pill');
        const cmbId = pill.getAttribute('data-combatant-id');
        U().showConditionPopover(pill, condId, function () {
          S().toggleCondition(cmbId, condId);
        });
      });
    });

    // Stats Expand / Clone / Edit / Save Bestiary / Remove / Use Attack
    container.querySelectorAll('[data-quick-attack]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openQuickAttackModal(btn.getAttribute('data-quick-attack'));
      });
    });

    container.querySelectorAll('[data-toggle-stats]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S().toggleCombatantExpanded(btn.getAttribute('data-toggle-stats'));
      });
    });

    container.querySelectorAll('[data-clone-combatant]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const cloned = S().cloneCombatant(btn.getAttribute('data-clone-combatant'));
        if (cloned) {
          U().showToast({ title: 'Cloned ' + cloned.name, message: 'Added to encounter at full HP.', duration: 2200 });
        }
      });
    });

    container.querySelectorAll('[data-edit-combatant]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-edit-combatant');
        const c = S().getState().encounter.combatants.find(function (x) { return x.id === id; });
        if (!c) return;
        openMonsterEditorModal({
          title: 'Edit ' + c.name,
          monster: c,
          onSave: function (payload, initVal) {
            S().updateCombatant(id, function (curr) {
              return Object.assign({}, curr, payload, {
                initiative: initVal,
                hp: Math.min(curr.hp, payload.maxHp)
              });
            });
          }
        });
      });
    });

    container.querySelectorAll('[data-save-bestiary]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-save-bestiary');
        const c = S().getState().encounter.combatants.find(function (x) { return x.id === id; });
        if (!c) return;
        const cleanName = c.name.replace(/\s+\d+$/, '').trim() || c.name;
        S().saveBestiaryMonster({
          name: cleanName,
          ac: c.ac,
          maxHp: c.maxHp,
          speed: c.speed,
          abilities: c.abilities,
          saves: c.saves,
          resistances: c.resistances,
          immunities: c.immunities,
          senses: c.senses,
          notes: c.notes,
          attacks: c.attacks
        });
        U().showToast({ title: 'Saved to Bestiary', message: '"' + cleanName + '" is now available in your Prep Bestiary.', tone: 'success' });
      });
    });

    container.querySelectorAll('[data-remove-combatant]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S().removeCombatant(btn.getAttribute('data-remove-combatant'));
      });
    });

    container.querySelectorAll('[data-roll-ability]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.getAttribute('data-roll-ability');
        const cmbId = btn.getAttribute('data-ability-cmb');
        const c = S().getState().encounter.combatants.find(function (x) { return x.id === cmbId; });
        if (!c) return;
        const score = c.abilities && Number.isFinite(Number(c.abilities[key])) ? Number(c.abilities[key]) : 10;
        const mod = D().abilityMod(score);
        const raw = Math.floor(Math.random() * 20) + 1;
        const total = raw + mod;
        const label = key.toUpperCase();
        S().addRollLogEntry({
          kind: 'ability',
          title: c.name + ' — ' + label + ' Check',
          summary: String(total),
          breakdown: label + ': d20 [' + raw + '] ' + D().formatSigned(mod) + ' = ' + total
        });
        U().showToast({
          title: c.name + ' ' + label + ' Check: ' + total,
          message: 'd20 [' + raw + '] ' + D().formatSigned(mod) + ' = ' + total,
          duration: 3600
        });
      });
    });

    container.querySelectorAll('[data-use-attack]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const cmbId = btn.getAttribute('data-use-attack');
        const atkIdx = parseInt(btn.getAttribute('data-attack-idx'), 10) || 0;
        if (DMHub.RollerView && DMHub.RollerView.loadMonsterAttack) {
          DMHub.RollerView.loadMonsterAttack(cmbId, atkIdx);
          if (window.innerWidth < 1024 && DMHub.App) {
            DMHub.App.openSection('roller');
          }
        }
      });
    });
  }

  DMHub.EncounterView = {
    render: render,
    openMonsterEditorModal: openMonsterEditorModal
  };
})(window.DMHub = window.DMHub || {});
