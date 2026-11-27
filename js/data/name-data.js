/* ==========================================================================
   DM Hub — Offline Fantasy NPC & Multi-Establishment Name Generator Data
   ========================================================================== */

(function (DMHub) {
  'use strict';

  const NPC_POOLS = {
    Human: {
      first: ['Aldric', 'Brenna', 'Corwin', 'Daria', 'Edric', 'Freya', 'Garrick', 'Helena', 'Ivor', 'Jora', 'Kaelen', 'Liora', 'Maren', 'Nolan', 'Orla', 'Rowan', 'Soren', 'Talia', 'Vance', 'Wren'],
      last: ['Ashford', 'Blackwood', 'Crowley', 'Dunmore', 'Fairchild', 'Greymane', 'Hawthorne', 'Ironwood', 'Kestrel', 'Langley', 'Mercer', 'Northbrook', 'Oakhart', 'Redfern', 'Stonebridge', 'Thatcher', 'Vane', 'Whitmore']
    },
    Elf: {
      first: ['Aelar', 'Caelynn', 'Erevan', 'Faelar', 'Galinndan', 'Ielenia', 'Lia', 'Naivara', 'Paelias', 'Quarion', 'Sariel', 'Sylvar', 'Theren', 'Valanthe', 'Varis', 'Xanaphia'],
      last: ['Amastacia', 'Galanodel', 'Holimion', 'Ilphelkiir', 'Liadon', 'Meliamne', 'Moonwhisper', 'Nightbreeze', 'Siannodel', 'Starflower', 'Windrunner', 'Xiloscient']
    },
    Dwarf: {
      first: ['Adrik', 'Baern', 'Brynja', 'Dain', 'Eberk', 'Falkrunn', 'Gardain', 'Helja', 'Kildrak', 'Kathra', 'Orsik', 'Riswynn', 'Thorin', 'Torbera', 'Ulfgar', 'Vistra'],
      last: ['Balderk', 'Battlehammer', 'Brawnanvil', 'Dankil', 'Fireforge', 'Frostbeard', 'Gorunn', 'Ironfist', 'Loderr', 'Rumnaheim', 'Strakeln', 'Torunn', 'Ungart']
    },
    'Halfling / Gnome': {
      first: ['Alton', 'Bree', 'Cade', 'Callie', 'Eldon', 'Frug', 'Lavinia', 'Lyle', 'Milo', 'Nissa', 'Orla', 'Pippin', 'Rosie', 'Sindri', 'Tana', 'Zook'],
      last: ['Brushgather', 'Cobblepot', 'Goodbarrel', 'Greenbottle', 'High-Hill', 'Leagallow', 'Nackle', 'Ningel', 'Scheppen', 'Tealeaf', 'Thorngage', 'Tossscobble', 'Underbough']
    },
    'Tiefling / Exotic': {
      first: ['Akmenos', 'Bryseis', 'Damakos', 'Ekemon', 'Kallista', 'Lerissa', 'Mordai', 'Nemeia', 'Orianna', 'Pelaios', 'Rieta', 'Skamos', 'Therai', 'Valen', 'Zephyr'],
      last: ['Carrion', 'Creed', 'Despair', 'Duskborn', 'Emberfall', 'Hope', 'Ideals', 'Nowhere', 'Reverence', 'Sorrow', 'Temerity', 'Torment', 'Vesper']
    },
    'Orc / Rough': {
      first: ['Dench', 'Feng', 'Gell', 'Henk', 'Holg', 'Imsh', 'Keth', 'Krusk', 'Mhurren', 'Ront', 'Shautha', 'Sutha', 'Thokk', 'Vola', 'Yevelda'],
      last: ['Bloodtusk', 'Bonecrusher', 'Doomhammer', 'Grimjaw', 'Ironhide', 'Redaxe', 'Skullcleaver', 'Stonefist', 'Thunderbrow', 'Wolfscar']
    }
  };

  const NPC_TRAITS = [
    'Nervous apothecary with ink-stained fingers',
    'Retired guard who knows every rumor in town',
    'Overly cheerful merchant hiding a debt',
    'Soft-spoken scholar obsessed with local ruins',
    'Gruff blacksmith with a soft spot for strays',
    'Fast-talking courier always looking over their shoulder',
    'Weary innkeeper who never forgets a face',
    'Skeptical herbalist who speaks in riddles',
    'Boisterous sellsword nursing an old knee injury',
    'Suspicious dockworker with a heavy brass keyring',
    'Kind-hearted baker who secretly feeds street urchins',
    'Sharp-eyed jeweler who appraises everyone silently'
  ];

  const VENUES = {
    'Tavern / Inn': {
      adj: ['The Rusty', 'The Gilded', 'The Prancing', 'The Weary', 'The Copper', 'The Lantern', 'The Sunken', 'The Silver', 'The Broken', 'The Sleeping', 'The Crooked', 'The Crimson'],
      noun: ['Flagon', 'Griffin', 'Boar', 'Hearth', 'Stag', 'Tankard', 'Crow', 'Hound', 'Lantern', 'Barrel', 'Anchor', 'Wyvern'],
      vibe: [
        'Smells of pine smoke and roasted turnips; a lute plays softly in the corner.',
        'Crowded with caravan guards; chipped tables and surprisingly good spiced cider.',
        'Quiet and dimly lit; the barkeep polishes mugs while listening intently.',
        'Warm stone fireplace, creaking rafters, and a bounty board by the door.'
      ]
    },
    'Blacksmith / Armory': {
      adj: ['Iron', 'Ember', 'Hammer', 'Anvil', 'Steel', 'Cinder', 'Oakhaven', 'Hearthfire', 'Redstone', 'Blackiron'],
      noun: ['& Spark Forge', 'Armory', 'Smithy', 'Bladeworks', '& Tongs', 'Foundry', 'Ironworks', 'Shieldwright'],
      vibe: [
        'Rhythmic clanging rings out; racks of sturdy spears and horseshoes line the wall.',
        'Hot coal scent; an apprentice pumps bellows beside half-finished pauldrons.',
        'Scorched stone floor and a master smith who grades blades by their ring.'
      ]
    },
    'Apothecary / Magic Shop': {
      adj: ['The Starlight', 'The Obsidian', 'The Moonlit', 'The Curio', 'The Alchemist\'s', 'The Elder', 'The Emerald', 'The Whispering'],
      noun: ['Vial', 'Tome', 'Cauldron', 'Mortar & Pestle', 'Reliquary', 'Herbarium', 'Compass', 'Satchel'],
      vibe: [
        'Bundles of dried lavender hang from the ceiling; glass jars hum faintly.',
        'Shelves stuffed with wax-sealed scrolls, glowing moss, and dusty brass astrolabes.',
        'Smells of cloves and ozone; a brass bell chimes twice whenever someone enters.'
      ]
    },
    'General Goods / Market': {
      adj: ['Wayfarer\'s', 'Crossroads', 'Twin-Coin', 'Honest', 'Trailblazer\'s', 'Cobblestone', 'Lanternlight', 'Crown &'],
      noun: ['Outfitter', 'Provisions', 'Trading Post', 'Emporium', 'Supply Co.', 'Pack & Rope', 'Mercantile'],
      vibe: [
        'Stacked high with hempen rope, rations, oil flasks, and muddy canvas packs.',
        'A hand-painted sign promises "Fair Coin, No Cursed Goods."',
        'Bustling counter with chalkboards listing road tolls and caravan departures.'
      ]
    },
    'Temple / Shrine': {
      adj: ['Sanctuary of the', 'Chapel of', 'Shrine of the', 'Abbey of', 'Temple of the', 'Halls of'],
      noun: ['Silver Dawn', 'Merciful Flame', 'Silent Vigil', 'Verdant Bough', 'Weeping Bell', 'Eternal Lantern'],
      vibe: [
        'Cool stone flagstones, beeswax candles, and quiet hymns drifting from the nave.',
        'Sunbeams slice through stained glass onto an offering basin of rainwater.',
        'A weathered acolyte tends incense braziers and offers bandages to travelers.'
      ]
    },
    'Guildhall / Underworld Den': {
      adj: ['The Velvet', 'The Clockwork', 'The Blind', 'The Red-Key', 'The Shadowed', 'The Iron-Coin', 'The Midnight'],
      noun: ['Ledger', 'Parlor', 'Cellar', 'Exchange', 'Syndicate', 'Rookery', 'Vault'],
      vibe: [
        'Requires a knock code at a battered alley door; hushed deals happen behind curtains.',
        'Posted contracts pinned with daggers; mercenaries trade rumors over bitter tea.',
        'Heavy ledger books, locked strongboxes, and guards who never blink.'
      ]
    },
    'Noble Estate / Keep': {
      adj: ['Highcrest', 'Ravenshollow', 'Sunspire', 'Thornwall', 'Stormwatch', 'Alderbrook', 'Ashbourne'],
      noun: ['Manor', 'Keep', 'Citadel', 'Hall', 'Estate', 'Tower', 'Chateau'],
      vibe: [
        'Wrought-iron gates flanked by ivy-draped gargoyles and manicured hedges.',
        'Tapestries of forgotten battles line a echoing marble foyer.',
        'Banner flags snap in the wind above a stone bridge guarded by liveried halberdiers.'
      ]
    }
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateNpc(ancestry) {
    const keys = Object.keys(NPC_POOLS);
    const chosenAncestry = ancestry && NPC_POOLS[ancestry] ? ancestry : pick(keys);
    const pool = NPC_POOLS[chosenAncestry];
    return {
      name: pick(pool.first) + ' ' + pick(pool.last),
      ancestry: chosenAncestry,
      detail: chosenAncestry + ' — ' + pick(NPC_TRAITS)
    };
  }

  function generateVenue(category) {
    const keys = Object.keys(VENUES);
    const chosenCat = category && VENUES[category] ? category : pick(keys);
    const pool = VENUES[chosenCat];
    return {
      name: pick(pool.adj) + ' ' + pick(pool.noun),
      category: chosenCat,
      detail: chosenCat + ' — ' + pick(pool.vibe)
    };
  }

  DMHub.NameGen = {
    ANCESTRIES: ['Any'].concat(Object.keys(NPC_POOLS)),
    VENUE_TYPES: ['Any Establishment'].concat(Object.keys(VENUES)),
    generateNpc: generateNpc,
    generateVenue: generateVenue
  };
})(window.DMHub = window.DMHub || {});
