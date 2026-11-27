/* ==========================================================================
   DM Hub — D&D 5e SRD Reference Data, Conditions, Damage Types & Sample Pack
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const CONDITIONS = [
    {
      id: 'Blinded',
      rule: 'Auto-fails sight checks; attack rolls against the creature have Advantage, and its own attacks have Disadvantage.'
    },
    {
      id: 'Charmed',
      rule: 'Cannot attack or target the charmer with harmful abilities; the charmer has Advantage on social checks against it.'
    },
    {
      id: 'Deafened',
      rule: 'Cannot hear and automatically fails any ability check that requires hearing.'
    },
    {
      id: 'Frightened',
      rule: 'Has Disadvantage on ability checks and attack rolls while the source of fear is in line of sight, and cannot willingly move closer to it.'
    },
    {
      id: 'Grappled',
      rule: 'Speed becomes 0 and cannot benefit from speed bonuses; ends if the grappler is incapacitated or forced apart.'
    },
    {
      id: 'Incapacitated',
      rule: 'Cannot take actions or reactions.'
    },
    {
      id: 'Invisible',
      rule: 'Impossible to see without special senses; its attacks have Advantage and attacks against it have Disadvantage.'
    },
    {
      id: 'Paralyzed',
      rule: 'Incapacitated, cannot move or speak, auto-fails STR/DEX saves, attacks against it have Advantage, and hits within 5 ft are auto-Crits.'
    },
    {
      id: 'Petrified',
      rule: 'Turned to stone, incapacitated, unaware, resistant to all damage, immune to poison/disease, and auto-fails STR/DEX saves.'
    },
    {
      id: 'Poisoned',
      rule: 'Has Disadvantage on attack rolls and ability checks.'
    },
    {
      id: 'Prone',
      rule: 'Only option to move is crawling; its attacks have Disadvantage, melee attacks within 5 ft have Advantage, and ranged attacks have Disadvantage.'
    },
    {
      id: 'Restrained',
      rule: 'Speed becomes 0, DEX saves and its own attacks have Disadvantage, and attack rolls against it have Advantage.'
    },
    {
      id: 'Stunned',
      rule: 'Incapacitated, cannot move, speaks falteringly, auto-fails STR/DEX saves, and attack rolls against it have Advantage.'
    },
    {
      id: 'Unconscious',
      rule: 'Incapacitated, drops held items, falls Prone, auto-fails STR/DEX saves, attacks against it have Advantage, and hits within 5 ft are auto-Crits.'
    },
    {
      id: 'Exhaustion',
      rule: 'Cumulative penalty (1: Disadv checks, 2: half speed, 3: Disadv attacks/saves, 4: half max HP, 5: speed 0, 6: death).'
    },
    {
      id: 'Concentrating',
      rule: 'Maintaining a spell; taking damage requires a CON saving throw with DC = max(10, floor(damage / 2)) or the spell ends.'
    }
  ];

  const CONDITIONS_MAP = {};
  CONDITIONS.forEach(function (c) {
    CONDITIONS_MAP[c.id] = c.rule;
  });

  const DAMAGE_TYPES = [
    'Slashing',
    'Piercing',
    'Bludgeoning',
    'Poison',
    'Fire',
    'Cold',
    'Lightning',
    'Acid',
    'Necrotic',
    'Radiant',
    'Psychic',
    'Force',
    'Thunder'
  ];

  const CRIT_RULES = [
    {
      id: 'raw',
      name: 'Roll Double Dice (5e Standard RAW)',
      desc: 'Roll 2× damage dice, then add the flat modifier once (e.g., 1d8+3 becomes 2d8+3).'
    },
    {
      id: 'double-dice-value',
      name: 'Double Rolled Dice Value',
      desc: 'Roll normal damage dice, multiply the dice result by 2, then add the flat modifier once.'
    },
    {
      id: 'double-all',
      name: 'Double All Damage',
      desc: 'Roll normal damage dice + flat modifier, then multiply the entire total by 2.'
    },
    {
      id: 'crunchy',
      name: 'Crunchy Crits (Max + Roll)',
      desc: 'Maximum possible value of normal dice + one normal dice roll + flat modifier once (e.g., 8 + 1d8 + 3).'
    }
  ];

  const STARTER_BESTIARY = [
    {
      id: 'srd-goblin',
      name: 'Goblin',
      ac: 15,
      maxHp: 7,
      speed: '30 ft.',
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      saves: '',
      resistances: '',
      immunities: '',
      senses: 'Darkvision 60 ft., Passive Perception 9',
      notes: 'Nimble Escape: Can Disengage or Hide as a bonus action on each turn.',
      attacks: [
        {
          name: 'Scimitar',
          toHit: 4,
          components: [{ formula: '1d6+2', type: 'Slashing' }]
        },
        {
          name: 'Shortbow',
          toHit: 4,
          components: [{ formula: '1d6+2', type: 'Piercing' }]
        }
      ]
    },
    {
      id: 'srd-goblin-boss',
      name: 'Goblin Boss',
      ac: 17,
      maxHp: 21,
      speed: '30 ft.',
      abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 8, cha: 10 },
      saves: '',
      resistances: '',
      immunities: '',
      senses: 'Darkvision 60 ft., Passive Perception 9',
      notes: 'Multiattack: 2 scimitar attacks (2nd at Disadvantage). Redirect Attack reaction swaps with adjacent goblin.',
      attacks: [
        {
          name: 'Venom-Tipped Scimitar',
          toHit: 4,
          components: [
            { formula: '1d6+2', type: 'Slashing' },
            { formula: '1d6', type: 'Poison' }
          ]
        },
        {
          name: 'Javelin',
          toHit: 2,
          components: [{ formula: '1d6', type: 'Piercing' }]
        }
      ]
    },
    {
      id: 'srd-wolf',
      name: 'Wolf',
      ac: 13,
      maxHp: 11,
      speed: '40 ft.',
      abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
      saves: '',
      resistances: '',
      immunities: '',
      senses: 'Passive Perception 13 (Adv. on hearing/smell)',
      notes: 'Pack Tactics: Advantage on attacks if an ally is within 5 ft. of target. Bite forces DC 11 STR save or knocked Prone.',
      attacks: [
        {
          name: 'Bite',
          toHit: 4,
          components: [{ formula: '2d4+2', type: 'Piercing' }]
        }
      ]
    },
    {
      id: 'srd-giant-spider',
      name: 'Giant Spider',
      ac: 14,
      maxHp: 26,
      speed: '30 ft., climb 30 ft.',
      abilities: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
      saves: '',
      resistances: '',
      immunities: '',
      senses: 'Blindsight 10 ft., Darkvision 60 ft., Passive Perception 10',
      notes: 'Spider Climb & Web Sense. Target makes DC 11 CON save for half poison damage.',
      attacks: [
        {
          name: 'Venomous Bite',
          toHit: 5,
          components: [
            { formula: '1d8+3', type: 'Piercing' },
            { formula: '2d8', type: 'Poison' }
          ]
        }
      ]
    },
    {
      id: 'srd-skeleton',
      name: 'Skeleton',
      ac: 13,
      maxHp: 13,
      speed: '30 ft.',
      abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
      saves: '',
      resistances: 'Vulnerable: Bludgeoning',
      immunities: 'Poison; Exhaustion, Poisoned',
      senses: 'Darkvision 60 ft., Passive Perception 9',
      notes: 'Vulnerable to Bludgeoning damage.',
      attacks: [
        {
          name: 'Shortsword',
          toHit: 4,
          components: [{ formula: '1d6+2', type: 'Piercing' }]
        },
        {
          name: 'Shortbow',
          toHit: 4,
          components: [{ formula: '1d6+2', type: 'Piercing' }]
        }
      ]
    },
    {
      id: 'srd-bandit',
      name: 'Bandit',
      ac: 12,
      maxHp: 11,
      speed: '30 ft.',
      abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
      saves: '',
      resistances: '',
      immunities: '',
      senses: 'Passive Perception 10',
      notes: 'Typical highway brigand.',
      attacks: [
        {
          name: 'Scimitar',
          toHit: 3,
          components: [{ formula: '1d6+1', type: 'Slashing' }]
        },
        {
          name: 'Light Crossbow',
          toHit: 3,
          components: [{ formula: '1d8+1', type: 'Piercing' }]
        }
      ]
    }
  ];

  const SAMPLE_PARTY = [
    {
      id: 'pc-bram',
      name: 'Bram Ironfoot',
      ac: 17,
      maxHp: 28,
      passivePerception: 12,
      initMod: 1,
      notes: 'Dwarf Fighter — Chain mail + shield. Resistant to Poison.'
    },
    {
      id: 'pc-lyra',
      name: 'Lyra Swiftwind',
      ac: 15,
      maxHp: 21,
      passivePerception: 15,
      initMod: 3,
      notes: 'Elf Rogue — High perception, Uncanny Dodge at lvl 5.'
    },
    {
      id: 'pc-seraphina',
      name: 'Seraphina Dawn',
      ac: 16,
      maxHp: 24,
      passivePerception: 14,
      initMod: 0,
      notes: 'Human Cleric — Often concentrating on Bless or Spirit Guardians.'
    }
  ];

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function createCombatantFromTemplate(tpl, overrides) {
    const base = deepClone(tpl);
    return Object.assign(
      {
        id: 'cmb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        isPc: false,
        name: base.name || 'Monster',
        ac: Number(base.ac) || 12,
        maxHp: Number(base.maxHp) || 10,
        hp: Number(base.maxHp) || 10,
        tempHp: 0,
        initiative: 10,
        speed: base.speed || '30 ft.',
        abilities: base.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        saves: base.saves || '',
        resistances: base.resistances || '',
        immunities: base.immunities || '',
        senses: base.senses || '',
        notes: base.notes || '',
        attacks: Array.isArray(base.attacks) ? base.attacks : [],
        conditions: [],
        soloInitiative: Boolean(base.soloInitiative),
        expanded: false
      },
      overrides || {}
    );
  }

  function createCombatantFromPc(pc, overrides) {
    const dexScore = 10 + (Number(pc.initMod) || 0) * 2;
    return Object.assign(
      {
        id: 'cmb-pc-' + pc.id,
        pcId: pc.id,
        isPc: true,
        name: pc.name,
        ac: Number(pc.ac) || 10,
        maxHp: Number(pc.maxHp) || 20,
        hp: Number(pc.maxHp) || 20,
        tempHp: 0,
        initiative: 12 + (Number(pc.initMod) || 0),
        speed: '30 ft.',
        abilities: { str: 10, dex: dexScore, con: 10, int: 10, wis: 10, cha: 10 },
        saves: '',
        resistances: '',
        immunities: '',
        senses: 'Passive Perception ' + (pc.passivePerception || 10),
        notes: pc.notes || '',
        attacks: [],
        conditions: [],
        soloInitiative: false,
        expanded: false
      },
      overrides || {}
    );
  }

  function buildSampleData() {
    const bestiary = deepClone(STARTER_BESTIARY);
    const party = deepClone(SAMPLE_PARTY);
    const goblin = bestiary[0];
    const boss = bestiary[1];
    const wolf = bestiary[2];
    const spider = bestiary[3];

    const combatants = [
      createCombatantFromPc(party[1], { initiative: 17 }),
      createCombatantFromTemplate(boss, {
        id: 'sample-boss',
        name: 'Goblin Boss',
        initiative: 15,
        soloInitiative: true
      }),
      createCombatantFromPc(party[0], { initiative: 14 }),
      createCombatantFromTemplate(goblin, {
        id: 'sample-goblin-1',
        name: 'Goblin 1',
        initiative: 12
      }),
      createCombatantFromTemplate(goblin, {
        id: 'sample-goblin-2',
        name: 'Goblin 2',
        initiative: 11
      }),
      createCombatantFromPc(party[2], {
        initiative: 10,
        conditions: ['Concentrating']
      }),
      createCombatantFromTemplate(wolf, {
        id: 'sample-wolf',
        name: 'Wolf',
        initiative: 8
      })
    ];

    const preparedEncounters = [
      {
        id: 'prep-spider-cave',
        name: 'Webbed Cavern Ambush',
        notes: '2 Giant Spiders drop from the ceiling (15 ft. up) while a Wolf guards the cave mouth.',
        enemies: [
          createCombatantFromTemplate(spider, { name: 'Giant Spider 1', initiative: 14 }),
          createCombatantFromTemplate(spider, { name: 'Giant Spider 2', initiative: 12 }),
          createCombatantFromTemplate(wolf, { name: 'Cave Wolf', initiative: 10 })
        ]
      }
    ];

    return {
      party: party,
      bestiary: bestiary,
      encounterTitle: 'Roadside Goblin Ambush',
      combatants: combatants,
      preparedEncounters: preparedEncounters
    };
  }

  DMHub.SRD = {
    CONDITIONS: CONDITIONS,
    CONDITIONS_MAP: CONDITIONS_MAP,
    DAMAGE_TYPES: DAMAGE_TYPES,
    CRIT_RULES: CRIT_RULES,
    STARTER_BESTIARY: STARTER_BESTIARY,
    SAMPLE_PARTY: SAMPLE_PARTY,
    createCombatantFromTemplate: createCombatantFromTemplate,
    createCombatantFromPc: createCombatantFromPc,
    buildSampleData: buildSampleData
  };
})(window.DMHub = window.DMHub || {});
