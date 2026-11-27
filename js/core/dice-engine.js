/* ==========================================================================
   DM Hub — Pure Dice, Batch Attack & Split-Damage Rules Engine
   Supports all 4 5e Critical Hit rules, Advantage/Disadvantage, Nat 20/Nat 1,
   Split Damage Resistance/Vulnerability/Immunity, and Concentration DC.
   ========================================================================== */

(function (root) {
  'use strict';

  function defaultRng() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
    return Math.random();
  }

  function rollDie(sides, rng) {
    const fn = rng || defaultRng;
    return Math.floor(fn() * sides) + 1;
  }

  function formatSigned(n) {
    return n >= 0 ? '+' + n : String(n);
  }

  /**
   * Parse a standard D&D dice expression like "1d8+3", "2d6 + 1d4 - 1", "d20", "5"
   * Returns { valid, normalized, dice: [{ sign, count, sides }], flat: number, error }
   */
  function parseFormula(rawInput) {
    const cleaned = String(rawInput || '').replace(/\s+/g, '').toLowerCase();
    if (!cleaned) {
      return { valid: false, error: 'Empty dice formula' };
    }

    const tokenRegex = /([+-]?)(\d*d\d+|\d+)/g;
    let match;
    let consumed = 0;
    const dice = [];
    let flat = 0;

    while ((match = tokenRegex.exec(cleaned)) !== null) {
      if (match.index !== consumed) {
        return { valid: false, error: 'Invalid formula syntax: "' + rawInput + '"' };
      }
      consumed = tokenRegex.lastIndex;

      const sign = match[1] === '-' ? -1 : 1;
      const body = match[2];

      if (body.indexOf('d') !== -1) {
        const parts = body.split('d');
        const count = parts[0] === '' ? 1 : parseInt(parts[0], 10);
        const sides = parseInt(parts[1], 10);
        if (!Number.isFinite(count) || !Number.isFinite(sides) || count < 1 || count > 200 || sides < 2 || sides > 1000) {
          return { valid: false, error: 'Dice out of range (1-200 dice, d2-d1000)' };
        }
        dice.push({ sign: sign, count: count, sides: sides });
      } else {
        const val = parseInt(body, 10);
        if (!Number.isFinite(val)) {
          return { valid: false, error: 'Invalid number in formula' };
        }
        flat += sign * val;
      }
    }

    if (consumed !== cleaned.length || (dice.length === 0 && flat === 0 && cleaned !== '0')) {
      return { valid: false, error: 'Could not parse formula: "' + rawInput + '"' };
    }

    return {
      valid: true,
      normalized: cleaned,
      dice: dice,
      flat: flat
    };
  }

  /**
   * Roll a single ad-hoc formula (used by Polyhedral Tray & Custom Formula Bar)
   */
  function rollFormula(rawInput, rng) {
    const parsed = parseFormula(rawInput);
    if (!parsed.valid) {
      return { valid: false, error: parsed.error };
    }

    let total = parsed.flat;
    const parts = [];
    const termResults = [];

    parsed.dice.forEach(function (term) {
      const rolls = [];
      let sum = 0;
      for (let i = 0; i < term.count; i++) {
        const r = rollDie(term.sides, rng);
        rolls.push(r);
        sum += r;
      }
      total += term.sign * sum;
      termResults.push({
        sign: term.sign,
        count: term.count,
        sides: term.sides,
        rolls: rolls,
        sum: sum
      });
      const prefix = parts.length === 0
        ? (term.sign < 0 ? '-' : '')
        : (term.sign < 0 ? ' - ' : ' + ');
      parts.push(prefix + term.count + 'd' + term.sides + ' [' + rolls.join(', ') + ']');
    });

    if (parsed.flat !== 0 || parts.length === 0) {
      if (parts.length === 0) {
        parts.push(String(parsed.flat));
      } else {
        parts.push(parsed.flat > 0 ? ' + ' + parsed.flat : ' - ' + Math.abs(parsed.flat));
      }
    }

    const breakdown = parts.join('') + ' = ' + total;
    return {
      valid: true,
      formula: parsed.normalized,
      total: total,
      termResults: termResults,
      flat: parsed.flat,
      breakdown: breakdown
    };
  }

  /**
   * Step 2: Roll a batch of attacks against Target AC
   */
  function rollBatchAttacks(options) {
    const count = Math.max(1, Math.min(50, parseInt(options.count, 10) || 1));
    const toHitBonus = parseInt(options.toHitBonus, 10) || 0;
    const targetAC = parseInt(options.targetAC, 10) || 10;
    const mode = options.mode === 'advantage' || options.mode === 'disadvantage' ? options.mode : 'normal';
    const nat20AutoHit = options.nat20AutoHit !== false;
    const rng = options.rng || defaultRng;

    const attacks = [];

    for (let i = 0; i < count; i++) {
      let rawRolls;
      let kept;
      if (mode === 'normal') {
        const r = rollDie(20, rng);
        rawRolls = [r];
        kept = r;
      } else {
        const r1 = rollDie(20, rng);
        const r2 = rollDie(20, rng);
        rawRolls = [r1, r2];
        kept = mode === 'advantage' ? Math.max(r1, r2) : Math.min(r1, r2);
      }

      const total = kept + toHitBonus;
      const isNat20 = kept === 20;
      const isNat1 = kept === 1;

      let status;
      if (nat20AutoHit && isNat20) {
        status = 'crit';
      } else if (nat20AutoHit && isNat1) {
        status = 'miss';
      } else if (total >= targetAC) {
        status = isNat20 ? 'crit' : 'hit';
      } else {
        status = 'miss';
      }

      const modeTag = mode === 'advantage' ? ' (Adv)' : (mode === 'disadvantage' ? ' (Dis)' : '');
      const modStr = toHitBonus === 0 ? '' : (toHitBonus > 0 ? ' + ' + toHitBonus : ' - ' + Math.abs(toHitBonus));
      const breakdown = 'd20 [' + rawRolls.join(', ') + modeTag + ']' + modStr + ' = ' + total;

      attacks.push({
        index: i + 1,
        rawRolls: rawRolls,
        kept: kept,
        bonus: toHitBonus,
        total: total,
        isNat20: isNat20,
        isNat1: isNat1,
        initialStatus: status,
        status: status,
        overridden: false,
        breakdown: breakdown
      });
    }

    return {
      targetAC: targetAC,
      toHitBonus: toHitBonus,
      mode: mode,
      nat20AutoHit: nat20AutoHit,
      attacks: attacks
    };
  }

  /**
   * Roll a single damage component for either a normal Hit or a Critical Hit
   * under the active 5e Critical Hit House Rule.
   */
  function rollDamageComponent(formulaStr, isCrit, critRule, rng) {
    const parsed = parseFormula(formulaStr);
    if (!parsed.valid) {
      return { valid: false, total: 0, breakdown: 'Invalid (' + formulaStr + ')' };
    }

    const rule = critRule || 'raw';
    let diceSum = 0;
    const detailSegments = [];

    if (!isCrit) {
      parsed.dice.forEach(function (term) {
        const rolls = [];
        let s = 0;
        for (let i = 0; i < term.count; i++) {
          const r = rollDie(term.sides, rng);
          rolls.push(r);
          s += r;
        }
        diceSum += term.sign * s;
        detailSegments.push((term.sign < 0 ? '-' : '') + '[' + rolls.join(', ') + ']');
      });
      const total = Math.max(0, diceSum + parsed.flat);
      const modText = parsed.flat !== 0 ? ' ' + formatSigned(parsed.flat) : '';
      return {
        valid: true,
        total: total,
        breakdown: (detailSegments.length ? detailSegments.join(' + ') : '0') + modText + ' = ' + total
      };
    }

    // Critical Hit Calculation according to the 4 House Rules
    if (rule === 'raw') {
      // 1. Roll Double Dice (5e RAW): roll 2x damage dice + flat mod once
      parsed.dice.forEach(function (term) {
        const rolls = [];
        let s = 0;
        const doubledCount = term.count * 2;
        for (let i = 0; i < doubledCount; i++) {
          const r = rollDie(term.sides, rng);
          rolls.push(r);
          s += r;
        }
        diceSum += term.sign * s;
        detailSegments.push((term.sign < 0 ? '-' : '') + '[' + rolls.join(', ') + ']');
      });
      const total = Math.max(0, diceSum + parsed.flat);
      const modText = parsed.flat !== 0 ? ' ' + formatSigned(parsed.flat) : '';
      return {
        valid: true,
        total: total,
        breakdown: 'CRIT (2× dice): ' + (detailSegments.length ? detailSegments.join(' + ') : '0') + modText + ' = ' + total
      };
    }

    if (rule === 'double-dice-value') {
      // 2. Double Rolled Dice Value: (normal dice * 2) + flat mod once
      parsed.dice.forEach(function (term) {
        const rolls = [];
        let s = 0;
        for (let i = 0; i < term.count; i++) {
          const r = rollDie(term.sides, rng);
          rolls.push(r);
          s += r;
        }
        diceSum += term.sign * s;
        detailSegments.push((term.sign < 0 ? '-' : '') + '[' + rolls.join(', ') + ']');
      });
      const doubledDice = diceSum * 2;
      const total = Math.max(0, doubledDice + parsed.flat);
      const modText = parsed.flat !== 0 ? ' ' + formatSigned(parsed.flat) : '';
      return {
        valid: true,
        total: total,
        breakdown: 'CRIT (dice ×2): (' + (detailSegments.length ? detailSegments.join(' + ') : '0') + ')×2' + modText + ' = ' + total
      };
    }

    if (rule === 'double-all') {
      // 3. Double All Damage: (normal dice + flat mod) * 2
      parsed.dice.forEach(function (term) {
        const rolls = [];
        let s = 0;
        for (let i = 0; i < term.count; i++) {
          const r = rollDie(term.sides, rng);
          rolls.push(r);
          s += r;
        }
        diceSum += term.sign * s;
        detailSegments.push((term.sign < 0 ? '-' : '') + '[' + rolls.join(', ') + ']');
      });
      const baseTotal = diceSum + parsed.flat;
      const total = Math.max(0, baseTotal * 2);
      const modText = parsed.flat !== 0 ? ' ' + formatSigned(parsed.flat) : '';
      return {
        valid: true,
        total: total,
        breakdown: 'CRIT (all ×2): (' + (detailSegments.length ? detailSegments.join(' + ') : '0') + modText + ')×2 = ' + total
      };
    }

    // 4. Crunchy Crits (Max + Roll): max possible dice + normal dice roll + flat mod once
    let maxDiceTotal = 0;
    parsed.dice.forEach(function (term) {
      const rolls = [];
      let s = 0;
      for (let i = 0; i < term.count; i++) {
        const r = rollDie(term.sides, rng);
        rolls.push(r);
        s += r;
      }
      const termMax = term.sign * (term.count * term.sides);
      maxDiceTotal += termMax;
      diceSum += term.sign * s;
      detailSegments.push('max ' + termMax + ' + [' + rolls.join(', ') + ']');
    });
    const crunchyTotal = Math.max(0, maxDiceTotal + diceSum + parsed.flat);
    const modText = parsed.flat !== 0 ? ' ' + formatSigned(parsed.flat) : '';
    return {
      valid: true,
      total: crunchyTotal,
      breakdown: 'CRIT (Crunchy): ' + (detailSegments.length ? detailSegments.join(' + ') : '0') + modText + ' = ' + crunchyTotal
    };
  }

  /**
   * Apply Resistance / Vulnerability / Immunity to a raw damage subtotal
   */
  function applyDamageMultiplier(rawAmount, multiplier) {
    const raw = Math.max(0, Number(rawAmount) || 0);
    if (multiplier === 'resist') return Math.floor(raw / 2);
    if (multiplier === 'vuln') return raw * 2;
    if (multiplier === 'immune') return 0;
    return raw;
  }

  /**
   * Step 3: Roll split damage across all confirmed hits & crits
   */
  function rollSplitDamage(options) {
    const hits = Math.max(0, parseInt(options.hits, 10) || 0);
    const crits = Math.max(0, parseInt(options.crits, 10) || 0);
    const components = Array.isArray(options.components) ? options.components : [];
    const critRule = options.critRule || 'raw';
    const rng = options.rng || defaultRng;

    const byType = {};
    const typeOrder = [];

    components.forEach(function (comp) {
      const type = comp.type || 'Slashing';
      const formula = String(comp.formula || '').trim();
      if (!formula) return;

      if (!byType[type]) {
        byType[type] = {
          type: type,
          rawTotal: 0,
          multiplier: 'normal',
          breakdownLines: []
        };
        typeOrder.push(type);
      }

      for (let h = 1; h <= hits; h++) {
        const res = rollDamageComponent(formula, false, critRule, rng);
        byType[type].rawTotal += res.total;
        byType[type].breakdownLines.push('Hit #' + h + ' (' + formula + '): ' + res.breakdown);
      }

      for (let c = 1; c <= crits; c++) {
        const res = rollDamageComponent(formula, true, critRule, rng);
        byType[type].rawTotal += res.total;
        byType[type].breakdownLines.push('Crit #' + c + ' (' + formula + '): ' + res.breakdown);
      }
    });

    const rows = typeOrder.map(function (t) {
      const row = byType[t];
      return {
        type: row.type,
        rawTotal: row.rawTotal,
        multiplier: 'normal',
        effectiveTotal: row.rawTotal,
        breakdownLines: row.breakdownLines
      };
    });

    const grandTotal = rows.reduce(function (acc, r) {
      return acc + r.effectiveTotal;
    }, 0);

    return {
      hits: hits,
      crits: crits,
      critRule: critRule,
      rows: rows,
      grandTotal: grandTotal
    };
  }

  function recalculateSplitDamage(damageResult) {
    let grand = 0;
    damageResult.rows.forEach(function (row) {
      row.effectiveTotal = applyDamageMultiplier(row.rawTotal, row.multiplier);
      grand += row.effectiveTotal;
    });
    damageResult.grandTotal = grand;
    return damageResult;
  }

  function calcConcentrationDC(damage) {
    const dmg = Math.max(0, Number(damage) || 0);
    return Math.max(10, Math.floor(dmg / 2));
  }

  function abilityMod(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return 0;
    return Math.floor((n - 10) / 2);
  }

  const api = {
    parseFormula: parseFormula,
    rollFormula: rollFormula,
    rollBatchAttacks: rollBatchAttacks,
    rollDamageComponent: rollDamageComponent,
    rollSplitDamage: rollSplitDamage,
    applyDamageMultiplier: applyDamageMultiplier,
    recalculateSplitDamage: recalculateSplitDamage,
    calcConcentrationDC: calcConcentrationDC,
    abilityMod: abilityMod,
    formatSigned: formatSigned
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DMHub = root.DMHub || {};
    root.DMHub.DiceEngine = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
