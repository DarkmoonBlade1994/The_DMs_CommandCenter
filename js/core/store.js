/* ==========================================================================
   DM Hub — Central Reactive State Store & localStorage Auto-Save
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const STORAGE_KEY = 'dm_hub_state_v1';
  const SCHEMA_VERSION = 1;
  const MAX_ROLL_LOG = 50;

  function createDefaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: null,
      lastExternalBackupAt: null,
      hasSeenBackupWizard: false,
      settings: {
        theme: 'dark', // 'dark' | 'light'
        critRule: 'raw', // 'raw' | 'double-dice-value' | 'double-all' | 'crunchy'
        nat20AutoHit: true,
        enemyInitiativeMode: 'individual', // 'individual' | 'clustered'
        cloneInitiativeMode: 'individual', // 'individual' | 'shared'
        autoConcentrationToast: true,
        defaultRollMathVisible: 'compact', // 'compact' | 'detailed'
        periodicFolderSync: false,
        nextFolderBackupSlot: 1
      },
      party: [],
      encounter: {
        title: 'Active Encounter',
        mode: 'initiative', // 'initiative' | 'freeform'
        round: 1,
        activeIndex: 0,
        combatants: []
      },
      bestiary: [],
      preparedEncounters: [],
      notes: '',
      rollLog: []
    };
  }

  let state = createDefaultState();
  let listeners = [];
  let dirtySnapshot = false;
  let dirtyFolder = false;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeLoadedState(raw) {
    const def = createDefaultState();
    if (!raw || typeof raw !== 'object') return def;

    const merged = Object.assign({}, def, raw);
    merged.schemaVersion = SCHEMA_VERSION;
    merged.settings = Object.assign({}, def.settings, raw.settings || {});
    merged.encounter = Object.assign({}, def.encounter, raw.encounter || {});
    merged.party = Array.isArray(raw.party) ? raw.party : [];
    merged.bestiary = Array.isArray(raw.bestiary) ? raw.bestiary : [];
    merged.preparedEncounters = Array.isArray(raw.preparedEncounters) ? raw.preparedEncounters : [];
    merged.encounter.combatants = Array.isArray(merged.encounter.combatants) ? merged.encounter.combatants : [];
    merged.notes = typeof raw.notes === 'string' ? raw.notes : '';
    merged.rollLog = Array.isArray(raw.rollLog) ? raw.rollLog.slice(0, MAX_ROLL_LOG) : [];
    return merged;
  }

  function persistToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      // Ignore quota or storage restriction errors silently; user can still export JSON
      console.warn('DMHub localStorage save warning:', err && err.message);
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = mergeLoadedState(parsed);
      }
    } catch (err) {
      console.warn('DMHub localStorage load warning:', err && err.message);
      state = createDefaultState();
    }
  }

  function notify(changedScope) {
    listeners.forEach(function (fn) {
      try {
        fn(state, changedScope || 'all');
      } catch (err) {
        console.error('DMHub listener error:', err);
      }
    });
  }

  function commit(changedScope, opts) {
    const markDirty = !(opts && opts.skipDirty);
    if (markDirty) {
      state.updatedAt = new Date().toISOString();
      dirtySnapshot = true;
      dirtyFolder = true;
    }
    persistToLocalStorage();
    notify(changedScope || 'all');
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      listeners = listeners.filter(function (item) {
        return item !== fn;
      });
    };
  }

  function getState() {
    return state;
  }

  function exportSerializableState() {
    return deepClone(state);
  }

  function replaceEntireState(newRawState) {
    state = mergeLoadedState(newRawState);
    dirtySnapshot = false;
    persistToLocalStorage();
    notify('all');
  }

  function hasMeaningfulData() {
    return (
      state.encounter.combatants.length > 0 ||
      state.party.length > 0 ||
      state.bestiary.length > 0 ||
      state.preparedEncounters.length > 0 ||
      state.notes.trim().length > 0
    );
  }

  function getSummaryText() {
    const enemies = state.encounter.combatants.filter(function (c) { return !c.isPc; }).length;
    const pcs = state.party.length;
    return (state.encounter.title || 'Encounter') + ' • ' + enemies + ' enemies, ' + pcs + ' PCs';
  }

  /* ------------------------------------------------------------------------
     Encounter & Combatant Actions
     ------------------------------------------------------------------------ */

  function sortCombatantsByInitiative() {
    const enc = state.encounter;
    const activeId = enc.combatants[enc.activeIndex] ? enc.combatants[enc.activeIndex].id : null;

    enc.combatants.sort(function (a, b) {
      const initDiff = (Number(b.initiative) || 0) - (Number(a.initiative) || 0);
      if (initDiff !== 0) return initDiff;
      const dexA = a.abilities && Number.isFinite(a.abilities.dex) ? a.abilities.dex : 10;
      const dexB = b.abilities && Number.isFinite(b.abilities.dex) ? b.abilities.dex : 10;
      if (dexB !== dexA) return dexB - dexA;
      if (a.isPc !== b.isPc) return a.isPc ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });

    if (activeId) {
      const idx = enc.combatants.findIndex(function (c) { return c.id === activeId; });
      enc.activeIndex = idx >= 0 ? idx : 0;
    } else {
      enc.activeIndex = 0;
    }
  }

  function setEncounterMode(mode) {
    state.encounter.mode = mode === 'freeform' ? 'freeform' : 'initiative';
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
  }

  function setEncounterTitle(title) {
    state.encounter.title = String(title || '').trim() || 'Active Encounter';
    commit('encounter');
  }

  function isClusteredEnemy(c) {
    return Boolean(c && !c.isPc && !c.soloInitiative);
  }

  function getTurnGroups() {
    const list = state.encounter.combatants;
    if (!list.length) return [];
    const clustered = state.settings.enemyInitiativeMode === 'clustered';
    if (!clustered) {
      return list.map(function (_c, idx) { return [idx]; });
    }

    const groups = [];
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (isClusteredEnemy(c)) {
        const lastGrp = groups[groups.length - 1];
        if (
          lastGrp &&
          isClusteredEnemy(list[lastGrp[0]]) &&
          Number(list[lastGrp[0]].initiative) === Number(c.initiative)
        ) {
          lastGrp.push(i);
          continue;
        }
      }
      groups.push([i]);
    }
    return groups;
  }

  function getActiveTurnIndices() {
    const groups = getTurnGroups();
    if (!groups.length) return [];
    const idx = Math.max(0, Math.min(state.encounter.activeIndex || 0, state.encounter.combatants.length - 1));
    const found = groups.find(function (g) { return g.indexOf(idx) !== -1; });
    return found || groups[0];
  }

  function alignClusteredEnemiesToSharedInit() {
    const clustered = state.encounter.combatants.filter(isClusteredEnemy);
    if (clustered.length < 2) return;
    const targetInit = clustered.reduce(function (mx, c) {
      return Math.max(mx, Number(c.initiative) || 0);
    }, -99);
    clustered.forEach(function (c) {
      c.initiative = targetInit;
    });
  }

  function setEnemyInitiativeMode(mode) {
    const nextMode = mode === 'clustered' ? 'clustered' : 'individual';
    state.settings.enemyInitiativeMode = nextMode;
    if (nextMode === 'clustered') {
      alignClusteredEnemiesToSharedInit();
      if (state.encounter.mode === 'initiative') {
        sortCombatantsByInitiative();
      }
    }
    commit('all');
  }

  function toggleCombatantSoloInit(id) {
    const target = state.encounter.combatants.find(function (c) { return c.id === id; });
    if (!target || target.isPc) return;
    target.soloInitiative = !target.soloInitiative;
    if (state.settings.enemyInitiativeMode === 'clustered' && !target.soloInitiative) {
      const otherClustered = state.encounter.combatants.find(function (c) {
        return c.id !== target.id && isClusteredEnemy(c);
      });
      if (otherClustered) {
        target.initiative = otherClustered.initiative;
      }
    }
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
  }

  function nextTurn() {
    const groups = getTurnGroups();
    if (!groups.length) return;
    const curIdx = Math.max(0, Math.min(state.encounter.activeIndex || 0, state.encounter.combatants.length - 1));
    let grpPos = groups.findIndex(function (g) { return g.indexOf(curIdx) !== -1; });
    if (grpPos === -1) grpPos = 0;

    let nextPos = grpPos + 1;
    if (nextPos >= groups.length) {
      nextPos = 0;
      state.encounter.round += 1;
    }
    state.encounter.activeIndex = groups[nextPos][0];
    commit('encounter');
  }

  function prevTurn() {
    const groups = getTurnGroups();
    if (!groups.length) return;
    const curIdx = Math.max(0, Math.min(state.encounter.activeIndex || 0, state.encounter.combatants.length - 1));
    let grpPos = groups.findIndex(function (g) { return g.indexOf(curIdx) !== -1; });
    if (grpPos === -1) grpPos = 0;

    let prevPos = grpPos - 1;
    if (prevPos < 0) {
      prevPos = groups.length - 1;
      state.encounter.round = Math.max(1, state.encounter.round - 1);
    }
    state.encounter.activeIndex = groups[prevPos][0];
    commit('encounter');
  }

  function resetCombatTracker() {
    state.encounter.round = 1;
    state.encounter.activeIndex = 0;
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
  }

  function clearCurrentEncounter(opts) {
    const keepParty = Boolean(opts && opts.keepParty);
    state.encounter.combatants = keepParty
      ? state.encounter.combatants.filter(function (c) { return c.isPc; })
      : [];
    state.encounter.round = 1;
    state.encounter.activeIndex = 0;
    state.encounter.title = 'Active Encounter';
    if (state.encounter.mode === 'initiative' && state.encounter.combatants.length > 1) {
      sortCombatantsByInitiative();
    }
    commit('encounter');
  }

  function rollEnemyInitiatives() {
    const rolledSummary = [];
    const rolledBreakdown = [];
    const isClusterMode = state.settings.enemyInitiativeMode === 'clustered';

    if (isClusterMode) {
      const clusteredEnemies = state.encounter.combatants.filter(isClusteredEnemy);
      const soloEnemies = state.encounter.combatants.filter(function (c) { return !c.isPc && c.soloInitiative; });

      if (clusteredEnemies.length > 0) {
        const bestDexMod = clusteredEnemies.reduce(function (mx, c) {
          const dex = c.abilities && Number.isFinite(c.abilities.dex) ? c.abilities.dex : 10;
          return Math.max(mx, DMHub.DiceEngine.abilityMod(dex));
        }, -10);
        const clusterRoll = Math.floor(Math.random() * 20) + 1;
        const clusterTotal = clusterRoll + bestDexMod;
        const names = clusteredEnemies.map(function (c) { return c.name; });
        clusteredEnemies.forEach(function (c) { c.initiative = clusterTotal; });
        rolledSummary.push('Enemy Cluster (' + clusteredEnemies.length + '): ' + clusterTotal);
        rolledBreakdown.push('Enemy Cluster [' + names.join(', ') + ']: d20 [' + clusterRoll + '] ' + DMHub.DiceEngine.formatSigned(bestDexMod) + ' = ' + clusterTotal);
      }

      soloEnemies.forEach(function (c) {
        const dex = c.abilities && Number.isFinite(c.abilities.dex) ? c.abilities.dex : 10;
        const mod = DMHub.DiceEngine.abilityMod(dex);
        const roll = Math.floor(Math.random() * 20) + 1;
        c.initiative = roll + mod;
        rolledSummary.push(c.name + ' (Solo): ' + c.initiative);
        rolledBreakdown.push(c.name + ' (Solo): d20 [' + roll + '] ' + DMHub.DiceEngine.formatSigned(mod) + ' = ' + c.initiative);
      });
    } else {
      state.encounter.combatants.forEach(function (c) {
        if (!c.isPc) {
          const dex = c.abilities && Number.isFinite(c.abilities.dex) ? c.abilities.dex : 10;
          const mod = DMHub.DiceEngine.abilityMod(dex);
          const roll = Math.floor(Math.random() * 20) + 1;
          c.initiative = roll + mod;
          rolledSummary.push(c.name + ': ' + c.initiative);
          rolledBreakdown.push(c.name + ': d20 [' + roll + '] ' + DMHub.DiceEngine.formatSigned(mod) + ' = ' + c.initiative);
        }
      });
    }

    if (rolledBreakdown.length > 0) {
      state.rollLog.unshift({
        id: 'roll-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        kind: 'initiative',
        title: isClusterMode ? 'Initiative Roll (Clustered + Solo)' : 'Initiative Roll (Enemies)',
        summary: rolledSummary.join(', '),
        breakdown: rolledBreakdown.join('\n')
      });
      if (state.rollLog.length > MAX_ROLL_LOG) {
        state.rollLog = state.rollLog.slice(0, MAX_ROLL_LOG);
      }
    }
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
  }

  function updateCombatantInitiative(id, value) {
    const target = state.encounter.combatants.find(function (c) { return c.id === id; });
    if (!target) return;
    const nextVal = parseInt(value, 10) || 0;
    if (state.settings.enemyInitiativeMode === 'clustered' && isClusteredEnemy(target)) {
      state.encounter.combatants.forEach(function (c) {
        if (isClusteredEnemy(c)) c.initiative = nextVal;
      });
    } else {
      target.initiative = nextVal;
    }
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
  }

  function addCombatant(combatant) {
    state.encounter.combatants.push(combatant);
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
  }

  /**
   * Batch-add multiple monster templates with quantities, smart auto-numbering,
   * and cluster/individual initiative rolling + Roll Log entry.
   * entries: [{ template, count, soloInitiative }]
   */
  function addEnemiesBatch(entries) {
    if (!Array.isArray(entries) || !entries.length) return 0;

    const isClusterMode = state.settings.enemyInitiativeMode === 'clustered';
    const existingClusterPeer = isClusterMode
      ? state.encounter.combatants.find(isClusteredEnemy)
      : null;

    const created = [];
    const rolledSummary = [];
    const rolledBreakdown = [];

    entries.forEach(function (entry) {
      const qty = Math.max(1, Math.min(50, parseInt(entry.count, 10) || 1));
      const tpl = entry.template;
      if (!tpl || !tpl.name) return;
      const isSolo = entry.soloInitiative != null ? Boolean(entry.soloInitiative) : Boolean(tpl.soloInitiative);
      const baseName = String(tpl.name).trim();
      const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exactRx = new RegExp('^' + escaped + '$', 'i');
      const numRx = new RegExp('^' + escaped + '\\s+(\\d+)$', 'i');

      let maxNum = 0;
      let existingBare = null;
      const allPool = state.encounter.combatants.concat(created);
      allPool.forEach(function (c) {
        if (exactRx.test(c.name)) {
          existingBare = c;
          maxNum = Math.max(maxNum, 1);
        } else {
          const m = c.name.match(numRx);
          if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
        }
      });

      const needsNumbering = qty > 1 || maxNum > 0;
      if (needsNumbering && existingBare) {
        existingBare.name = baseName + ' 1';
      }

      for (let i = 0; i < qty; i++) {
        const displayName = needsNumbering ? baseName + ' ' + (maxNum + i + 1) : baseName;
        const cmb = DMHub.SRD.createCombatantFromTemplate(tpl, {
          name: displayName,
          soloInitiative: isSolo
        });
        created.push(cmb);
      }
    });

    if (!created.length) return 0;

    if (isClusterMode) {
      const newClustered = created.filter(function (c) { return !c.soloInitiative; });
      const newSolos = created.filter(function (c) { return c.soloInitiative; });

      if (newClustered.length > 0) {
        if (existingClusterPeer) {
          newClustered.forEach(function (c) { c.initiative = existingClusterPeer.initiative; });
        } else {
          const bestMod = newClustered.reduce(function (mx, c) {
            const dex = c.abilities && Number.isFinite(c.abilities.dex) ? c.abilities.dex : 10;
            return Math.max(mx, DMHub.DiceEngine.abilityMod(dex));
          }, -10);
          const raw = Math.floor(Math.random() * 20) + 1;
          const total = raw + bestMod;
          newClustered.forEach(function (c) { c.initiative = total; });
          rolledSummary.push('Enemy Cluster (' + newClustered.length + '): ' + total);
          rolledBreakdown.push(
            'Enemy Cluster [' + newClustered.map(function (c) { return c.name; }).join(', ') + ']: d20 [' + raw + '] ' +
            DMHub.DiceEngine.formatSigned(bestMod) + ' = ' + total
          );
        }
      }

      newSolos.forEach(function (c) {
        const dex = c.abilities && Number.isFinite(c.abilities.dex) ? c.abilities.dex : 10;
        const mod = DMHub.DiceEngine.abilityMod(dex);
        const raw = Math.floor(Math.random() * 20) + 1;
        c.initiative = raw + mod;
        rolledSummary.push(c.name + ' (Solo): ' + c.initiative);
        rolledBreakdown.push(c.name + ' (Solo): d20 [' + raw + '] ' + DMHub.DiceEngine.formatSigned(mod) + ' = ' + c.initiative);
      });
    } else {
      created.forEach(function (c) {
        const dex = c.abilities && Number.isFinite(c.abilities.dex) ? c.abilities.dex : 10;
        const mod = DMHub.DiceEngine.abilityMod(dex);
        const raw = Math.floor(Math.random() * 20) + 1;
        c.initiative = raw + mod;
        rolledSummary.push(c.name + ': ' + c.initiative);
        rolledBreakdown.push(c.name + ': d20 [' + raw + '] ' + DMHub.DiceEngine.formatSigned(mod) + ' = ' + c.initiative);
      });
    }

    created.forEach(function (c) {
      state.encounter.combatants.push(c);
    });

    if (rolledBreakdown.length > 0) {
      state.rollLog.unshift({
        id: 'roll-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        kind: 'initiative',
        title: created.length === 1 ? 'Initiative — ' + created[0].name : 'Initiative Roll (Added ' + created.length + ' Enemies)',
        summary: rolledSummary.join(', '),
        breakdown: rolledBreakdown.join('\n')
      });
      if (state.rollLog.length > MAX_ROLL_LOG) {
        state.rollLog = state.rollLog.slice(0, MAX_ROLL_LOG);
      }
    }

    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
    return created.length;
  }

  function updateCombatant(id, updater) {
    const idx = state.encounter.combatants.findIndex(function (c) { return c.id === id; });
    if (idx === -1) return null;
    const current = state.encounter.combatants[idx];
    const updated = typeof updater === 'function' ? updater(current) : Object.assign({}, current, updater);
    state.encounter.combatants[idx] = updated;
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
    return updated;
  }

  function removeCombatant(id) {
    const idx = state.encounter.combatants.findIndex(function (c) { return c.id === id; });
    if (idx === -1) return;
    state.encounter.combatants.splice(idx, 1);
    if (state.encounter.activeIndex >= state.encounter.combatants.length) {
      state.encounter.activeIndex = Math.max(0, state.encounter.combatants.length - 1);
    }
    commit('encounter');
  }

  /**
   * Apply HP damage or healing; returns { combatant, concentrationDC }
   */
  function applyHpDelta(id, amount, kind) {
    const val = Math.abs(parseInt(amount, 10) || 0);
    if (val <= 0) return null;
    const target = state.encounter.combatants.find(function (c) { return c.id === id; });
    if (!target) return null;

    let concentrationDC = null;

    if (kind === 'damage') {
      let remaining = val;
      if (target.tempHp > 0) {
        const absorbed = Math.min(target.tempHp, remaining);
        target.tempHp -= absorbed;
        remaining -= absorbed;
      }
      target.hp = Math.max(0, (Number(target.hp) || 0) - remaining);

      if (
        state.settings.autoConcentrationToast &&
        Array.isArray(target.conditions) &&
        target.conditions.indexOf('Concentrating') !== -1
      ) {
        concentrationDC = DMHub.DiceEngine.calcConcentrationDC(val);
      }
    } else if (kind === 'heal') {
      target.hp = Math.min(Number(target.maxHp) || 1, (Number(target.hp) || 0) + val);
    }

    commit('encounter');
    return { combatant: target, damageTaken: kind === 'damage' ? val : 0, concentrationDC: concentrationDC };
  }

  function setTempHp(id, amount) {
    const target = state.encounter.combatants.find(function (c) { return c.id === id; });
    if (!target) return;
    target.tempHp = Math.max(0, parseInt(amount, 10) || 0);
    commit('encounter');
  }

  function toggleCondition(id, conditionId) {
    const target = state.encounter.combatants.find(function (c) { return c.id === id; });
    if (!target) return;
    if (!Array.isArray(target.conditions)) target.conditions = [];
    const idx = target.conditions.indexOf(conditionId);
    if (idx === -1) {
      target.conditions.push(conditionId);
    } else {
      target.conditions.splice(idx, 1);
    }
    commit('encounter');
  }

  function toggleCombatantExpanded(id) {
    const target = state.encounter.combatants.find(function (c) { return c.id === id; });
    if (!target) return;
    target.expanded = !target.expanded;
    commit('encounter', { skipDirty: true });
  }

  /**
   * Smart Clone / Swarm with auto-numbering (e.g., Goblin -> Goblin 1, Goblin 2, Goblin 3)
   */
  function cloneCombatant(id) {
    const source = state.encounter.combatants.find(function (c) { return c.id === id; });
    if (!source || source.isPc) return null;

    const match = source.name.match(/^(.*?)(?:\s+(\d+))?$/);
    const baseName = (match && match[1] ? match[1] : source.name).trim();
    const hadNumber = Boolean(match && match[2]);

    // If original had no number, rename original to "<Base> 1"
    if (!hadNumber) {
      source.name = baseName + ' 1';
    }

    // Find highest existing number for this baseName
    let maxNum = 1;
    const pattern = new RegExp('^' + baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(\\d+)$', 'i');
    state.encounter.combatants.forEach(function (c) {
      const m = c.name.match(pattern);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });

    const clone = deepClone(source);
    clone.id = 'cmb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    clone.name = baseName + ' ' + (maxNum + 1);
    clone.hp = clone.maxHp;
    clone.tempHp = 0;
    clone.conditions = [];
    clone.expanded = false;

    if (
      state.settings.cloneInitiativeMode === 'shared' ||
      (state.settings.enemyInitiativeMode === 'clustered' && !clone.soloInitiative)
    ) {
      const clusterPeer =
        state.settings.enemyInitiativeMode === 'clustered' && !clone.soloInitiative
          ? state.encounter.combatants.find(isClusteredEnemy)
          : null;
      clone.initiative = clusterPeer ? clusterPeer.initiative : source.initiative;
    } else {
      const dex = clone.abilities && Number.isFinite(clone.abilities.dex) ? clone.abilities.dex : 10;
      const mod = DMHub.DiceEngine.abilityMod(dex);
      const rawRoll = Math.floor(Math.random() * 20) + 1;
      clone.initiative = rawRoll + mod;
      state.rollLog.unshift({
        id: 'roll-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        kind: 'initiative',
        title: 'Initiative — ' + clone.name,
        summary: String(clone.initiative),
        breakdown: clone.name + ': d20 [' + rawRoll + '] ' + DMHub.DiceEngine.formatSigned(mod) + ' = ' + clone.initiative
      });
      if (state.rollLog.length > MAX_ROLL_LOG) {
        state.rollLog = state.rollLog.slice(0, MAX_ROLL_LOG);
      }
    }

    state.encounter.combatants.push(clone);
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
    return clone;
  }

  function dropPartyIntoEncounter() {
    let added = 0;
    state.party.forEach(function (pc) {
      const exists = state.encounter.combatants.some(function (c) {
        return c.isPc && (c.pcId === pc.id || c.name === pc.name);
      });
      if (!exists) {
        const cmb = DMHub.SRD.createCombatantFromPc(pc);
        state.encounter.combatants.push(cmb);
        added += 1;
      }
    });
    if (added > 0) {
      if (state.encounter.mode === 'initiative') {
        sortCombatantsByInitiative();
      }
      commit('encounter');
    }
    return added;
  }

  function dropSinglePcIntoEncounter(pcId) {
    const pc = state.party.find(function (p) { return p.id === pcId; });
    if (!pc) return false;
    const exists = state.encounter.combatants.some(function (c) {
      return c.isPc && c.pcId === pc.id;
    });
    if (exists) return false;
    state.encounter.combatants.push(DMHub.SRD.createCombatantFromPc(pc));
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
    return true;
  }

  /* ------------------------------------------------------------------------
     Party, Bestiary, Prepared Encounters, Notes, Roll Log & Settings
     ------------------------------------------------------------------------ */

  function savePc(pcData) {
    if (pcData.id) {
      const idx = state.party.findIndex(function (p) { return p.id === pcData.id; });
      if (idx !== -1) {
        state.party[idx] = Object.assign({}, state.party[idx], pcData);
      } else {
        state.party.push(pcData);
      }
      // Keep active PC combatant synced if present
      state.encounter.combatants.forEach(function (c) {
        if (c.isPc && c.pcId === pcData.id) {
          c.name = pcData.name;
          c.ac = Number(pcData.ac) || c.ac;
          c.maxHp = Number(pcData.maxHp) || c.maxHp;
          c.senses = 'Passive Perception ' + (pcData.passivePerception || 10);
          c.notes = pcData.notes || '';
        }
      });
    } else {
      pcData.id = 'pc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      state.party.push(pcData);
    }
    commit('prep');
  }

  function deletePc(pcId) {
    state.party = state.party.filter(function (p) { return p.id !== pcId; });
    commit('prep');
  }

  function saveBestiaryMonster(monsterData) {
    const entry = deepClone(monsterData);
    if (!entry.id) {
      entry.id = 'bst-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      state.bestiary.push(entry);
    } else {
      const idx = state.bestiary.findIndex(function (m) { return m.id === entry.id; });
      if (idx !== -1) {
        state.bestiary[idx] = entry;
      } else {
        state.bestiary.push(entry);
      }
    }
    commit('prep');
    return entry;
  }

  function deleteBestiaryMonster(id) {
    state.bestiary = state.bestiary.filter(function (m) { return m.id !== id; });
    commit('prep');
  }

  function saveCurrentEncounterToLibrary(title, notes) {
    const enemies = state.encounter.combatants
      .filter(function (c) { return !c.isPc; })
      .map(function (c) {
        const copy = deepClone(c);
        copy.hp = copy.maxHp;
        copy.tempHp = 0;
        copy.conditions = [];
        copy.expanded = false;
        return copy;
      });

    const entry = {
      id: 'prep-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: String(title || state.encounter.title || 'Saved Encounter').trim(),
      notes: String(notes || '').trim(),
      enemies: enemies
    };
    state.preparedEncounters.unshift(entry);
    commit('prep');
    return entry;
  }

  function deletePreparedEncounter(id) {
    state.preparedEncounters = state.preparedEncounters.filter(function (e) { return e.id !== id; });
    commit('prep');
  }

  function loadPreparedEncounterIntoCombat(id, includeParty) {
    const prep = state.preparedEncounters.find(function (e) { return e.id === id; });
    if (!prep) return false;

    const nextCombatants = [];
    if (includeParty) {
      state.party.forEach(function (pc) {
        nextCombatants.push(DMHub.SRD.createCombatantFromPc(pc));
      });
    }
    prep.enemies.forEach(function (enemy) {
      const clone = deepClone(enemy);
      clone.id = 'cmb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      clone.hp = clone.maxHp;
      clone.tempHp = 0;
      clone.conditions = [];
      clone.expanded = false;
      nextCombatants.push(clone);
    });

    state.encounter.title = prep.name;
    state.encounter.round = 1;
    state.encounter.activeIndex = 0;
    state.encounter.combatants = nextCombatants;
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    commit('encounter');
    return true;
  }

  function setNotes(text) {
    state.notes = String(text || '');
    commit('notes');
  }

  function appendNote(line) {
    const sep = state.notes.trim().length > 0 ? '\n' : '';
    state.notes = state.notes + sep + line;
    commit('notes');
  }

  function addRollLogEntry(entry) {
    const item = Object.assign(
      {
        id: 'roll-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString()
      },
      entry
    );
    state.rollLog.unshift(item);
    if (state.rollLog.length > MAX_ROLL_LOG) {
      state.rollLog = state.rollLog.slice(0, MAX_ROLL_LOG);
    }
    commit('rollLog');
  }

  function clearRollLog() {
    state.rollLog = [];
    commit('rollLog');
  }

  function updateSettings(partial) {
    state.settings = Object.assign({}, state.settings, partial);
    commit('settings');
  }

  function markExternalBackupCompleted(nextSlot) {
    state.lastExternalBackupAt = new Date().toISOString();
    if (typeof nextSlot === 'number') {
      state.settings.nextFolderBackupSlot = nextSlot;
    }
    dirtyFolder = false;
    persistToLocalStorage();
    notify('backup');
  }

  function markBackupWizardSeen() {
    state.hasSeenBackupWizard = true;
    persistToLocalStorage();
  }

  function loadSampleData() {
    const sample = DMHub.SRD.buildSampleData();
    state.party = sample.party;
    state.bestiary = sample.bestiary;
    state.preparedEncounters = sample.preparedEncounters;
    state.encounter.title = sample.encounterTitle;
    state.encounter.round = 1;
    state.encounter.activeIndex = 0;
    state.encounter.combatants = sample.combatants;
    if (state.encounter.mode === 'initiative') {
      sortCombatantsByInitiative();
    }
    if (!state.notes.trim()) {
      state.notes = 'Session 1 — Triboar Trail\n• Goblins spotted behind fallen oak tree.\n• Goblin Boss has a venom-tipped scimitar (Slashing + Poison).';
    }
    commit('all');
  }

  function clearAllData() {
    const keepWizard = state.hasSeenBackupWizard;
    state = createDefaultState();
    state.hasSeenBackupWizard = keepWizard;
    dirtySnapshot = false;
    dirtyFolder = false;
    persistToLocalStorage();
    notify('all');
  }

  loadFromLocalStorage();

  DMHub.Store = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    getState: getState,
    subscribe: subscribe,
    exportSerializableState: exportSerializableState,
    replaceEntireState: replaceEntireState,
    hasMeaningfulData: hasMeaningfulData,
    getSummaryText: getSummaryText,
    isDirtyForSnapshot: function () { return dirtySnapshot; },
    clearSnapshotDirty: function () { dirtySnapshot = false; },
    isDirtyForFolderSync: function () { return dirtyFolder; },
    clearFolderDirty: function () { dirtyFolder = false; },
    // Encounter
    setEncounterMode: setEncounterMode,
    setEncounterTitle: setEncounterTitle,
    setEnemyInitiativeMode: setEnemyInitiativeMode,
    toggleCombatantSoloInit: toggleCombatantSoloInit,
    getActiveTurnIndices: getActiveTurnIndices,
    sortCombatantsByInitiative: function () { sortCombatantsByInitiative(); commit('encounter'); },
    nextTurn: nextTurn,
    prevTurn: prevTurn,
    resetCombatTracker: resetCombatTracker,
    clearCurrentEncounter: clearCurrentEncounter,
    rollEnemyInitiatives: rollEnemyInitiatives,
    updateCombatantInitiative: updateCombatantInitiative,
    addCombatant: addCombatant,
    addEnemiesBatch: addEnemiesBatch,
    updateCombatant: updateCombatant,
    removeCombatant: removeCombatant,
    applyHpDelta: applyHpDelta,
    setTempHp: setTempHp,
    toggleCondition: toggleCondition,
    toggleCombatantExpanded: toggleCombatantExpanded,
    cloneCombatant: cloneCombatant,
    dropPartyIntoEncounter: dropPartyIntoEncounter,
    dropSinglePcIntoEncounter: dropSinglePcIntoEncounter,
    // Prep & Notes & Roll Log & Settings
    savePc: savePc,
    deletePc: deletePc,
    saveBestiaryMonster: saveBestiaryMonster,
    deleteBestiaryMonster: deleteBestiaryMonster,
    saveCurrentEncounterToLibrary: saveCurrentEncounterToLibrary,
    deletePreparedEncounter: deletePreparedEncounter,
    loadPreparedEncounterIntoCombat: loadPreparedEncounterIntoCombat,
    setNotes: setNotes,
    appendNote: appendNote,
    addRollLogEntry: addRollLogEntry,
    clearRollLog: clearRollLog,
    updateSettings: updateSettings,
    markExternalBackupCompleted: markExternalBackupCompleted,
    markBackupWizardSeen: markBackupWizardSeen,
    loadSampleData: loadSampleData,
    clearAllData: clearAllData
  };
})(window.DMHub = window.DMHub || {});
