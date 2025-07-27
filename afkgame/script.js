/*
 * Idle Adventure 2.0 – a more engaging idle game with combat, loot boxes and gear.
 * This script manages player state, combat with enemies, upgrades, loot boxes,
 * gear effects and persistent saving via localStorage. It also updates the
 * interface to display stats, enemy health, available upgrades and inventory.
 */

// Storage key for saving player data. Bump version if structure changes.
const SAVE_KEY = 'idleAdventureSave_v2';

// Default starting state when no save exists
const DEFAULT_STATE = {
  level: 1,
  xp: 0,
  xpNeeded: 100,
  coins: 0,
  attack: 1,
  xpMultiplier: 1,
  coinMultiplier: 1,
  critChance: 0.05, // 5% crit chance
  critDamage: 1.5,  // 150% damage on crit
  gear: [],
  upgrades: {},
  enemy: null
  ,playerName: ''
};

// Upgrade definitions. These can be purchased repeatedly. Costs scale per level.
const UPGRADE_DEFINITIONS = [
  {
    id: 'attack_up',
    name: 'Training',
    description: 'Increase attack by +1.',
    baseCost: 50,
    costMultiplier: 1.5,
    applyEffect: (state) => { state.attack += 1; }
  },
  {
    id: 'xp_mult',
    name: 'Wisdom',
    description: 'Increase XP gain by +10%.',
    baseCost: 100,
    costMultiplier: 1.6,
    applyEffect: (state) => { state.xpMultiplier += 0.10; }
  },
  {
    id: 'coin_mult',
    name: 'Prosperity',
    description: 'Increase coin gain by +10%.',
    baseCost: 100,
    costMultiplier: 1.6,
    applyEffect: (state) => { state.coinMultiplier += 0.10; }
  },
  {
    id: 'crit_chance',
    name: 'Precision',
    description: 'Increase crit chance by +1%.',
    baseCost: 150,
    costMultiplier: 2.0,
    applyEffect: (state) => { state.critChance += 0.01; }
  },
  {
    id: 'crit_damage',
    name: 'Brutality',
    description: 'Increase crit damage by +10%.',
    baseCost: 200,
    costMultiplier: 2.0,
    applyEffect: (state) => { state.critDamage += 0.10; }
  },
  {
    id: 'efficiency',
    name: 'Efficiency',
    description: 'Reduce XP required for next level by 5%.',
    baseCost: 250,
    costMultiplier: 2.2,
    applyEffect: (state) => { state.xpNeeded *= 0.95; }
  }
];

// Player state loaded from localStorage or defaults
let state;

// Sounds for game events
let levelUpSound;
let lootSound;
let upgradeSound;
let attackSound;
let critSound;
let enemyDeathSound;
let rareLootSound;

/**
 * Load player state from localStorage. Merge with defaults to ensure
 * missing properties get default values.
 */
function loadState() {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      state = Object.assign({}, DEFAULT_STATE, parsed);
      // Deep-merge nested objects/arrays
      state.gear = parsed.gear || [];
      state.upgrades = parsed.upgrades || {};
      state.enemy = parsed.enemy || null;
      state.playerName = parsed.playerName || '';
    } else {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  } catch (e) {
    console.warn('Failed to load state; using default.', e);
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

/** Save current state to localStorage */
function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state', e);
  }
}

/** Compute cost of a given upgrade based on current level */
function computeCost(def, level) {
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, level));
}

/** Spawn a new enemy with health and rewards scaled by player level */
function spawnEnemy() {
  const lvl = state.level;
  // HP increases exponentially for challenge
  const maxHp = Math.floor(50 * Math.pow(1.3, lvl - 1));
  const rewardXP = Math.floor(20 * Math.pow(1.15, lvl - 1));
  const rewardCoins = Math.floor(10 * Math.pow(1.15, lvl - 1));
  state.enemy = {
    level: lvl,
    maxHp,
    hp: maxHp,
    rewardXP,
    rewardCoins
  };
}

/** Generate a random gear item scaled by player level. Loot becomes more powerful as
 * level increases. Multiple categories of items exist and each has dynamic
 * effects that scale with level. */
function generateLoot() {
  const lvl = state.level;
  // Each entry contains a name and a function to compute its effects based on level
  const lootTable = [
    {
      name: 'Rusty Dagger',
      getEffects: (lvl) => ({
        attackBonus: Math.max(1, Math.floor(lvl / 8)),
        xpMultiplier: 0,
        coinMultiplier: 0,
        critChance: 0.003 * lvl,
        critDamage: 0
      })
    },
    {
      name: 'Bronze Sword',
      getEffects: (lvl) => ({
        attackBonus: Math.max(1, Math.floor(lvl / 6)),
        xpMultiplier: 0,
        coinMultiplier: 0,
        critChance: 0,
        critDamage: 0
      })
    },
    {
      name: 'Silver Sword',
      getEffects: (lvl) => ({
        attackBonus: Math.max(2, Math.floor(lvl / 4)),
        xpMultiplier: 0,
        coinMultiplier: 0,
        critChance: 0,
        critDamage: 0.05 * lvl
      })
    },
    {
      name: 'Golden Sword',
      getEffects: (lvl) => ({
        attackBonus: Math.max(3, Math.floor(lvl / 3)),
        xpMultiplier: 0,
        coinMultiplier: 0,
        critChance: 0.005 * lvl,
        critDamage: 0.07 * lvl
      })
    },
    {
      name: 'XP Idol',
      getEffects: (lvl) => ({
        attackBonus: 0,
        xpMultiplier: 0.02 + lvl * 0.006,
        coinMultiplier: 0,
        critChance: 0,
        critDamage: 0
      })
    },
    {
      name: 'Coin Idol',
      getEffects: (lvl) => ({
        attackBonus: 0,
        xpMultiplier: 0,
        coinMultiplier: 0.02 + lvl * 0.006,
        critChance: 0,
        critDamage: 0
      })
    },
    {
      name: 'Lucky Coin',
      getEffects: (lvl) => ({
        attackBonus: 0,
        xpMultiplier: 0,
        coinMultiplier: 0.015 + lvl * 0.005,
        critChance: 0.004 * lvl,
        critDamage: 0
      })
    },
    {
      name: "Scholar's Tome",
      getEffects: (lvl) => ({
        attackBonus: Math.floor(lvl / 10),
        xpMultiplier: 0.03 + lvl * 0.008,
        coinMultiplier: 0,
        critChance: 0,
        critDamage: 0
      })
    },
    {
      name: 'Dexterity Gloves',
      getEffects: (lvl) => ({
        attackBonus: 0,
        xpMultiplier: 0,
        coinMultiplier: 0,
        critChance: 0.01 + lvl * 0.003,
        critDamage: 0
      })
    },
    {
      name: 'Berserker Charm',
      getEffects: (lvl) => ({
        attackBonus: 0,
        xpMultiplier: 0,
        coinMultiplier: 0,
        critChance: 0,
        critDamage: 0.1 + lvl * 0.02
      })
    },
    {
      name: 'Mystic Crystal',
      getEffects: (lvl) => ({
        attackBonus: Math.floor(lvl / 12),
        xpMultiplier: 0.015 + lvl * 0.005,
        coinMultiplier: 0.015 + lvl * 0.005,
        critChance: 0,
        critDamage: 0
      })
    },
    {
      name: "Assassin's Cloak",
      getEffects: (lvl) => ({
        attackBonus: Math.floor(lvl / 8),
        xpMultiplier: 0,
        coinMultiplier: 0,
        critChance: 0.008 * lvl,
        critDamage: 0.15 * lvl
      })
    }
  ];
  // Randomly select an item type and compute its effects based on level
  const chosen = lootTable[Math.floor(Math.random() * lootTable.length)];
  const effects = chosen.getEffects(lvl);
  const item = {
    name: chosen.name,
    attackBonus: effects.attackBonus || 0,
    xpMultiplier: effects.xpMultiplier || 0,
    coinMultiplier: effects.coinMultiplier || 0,
    critChance: effects.critChance || 0,
    critDamage: effects.critDamage || 0
  };
  // Assign unique id for inventory
  item.id = `${item.name.replace(/\s+/g, '-')}-${Date.now()}`;
  return item;
}

/** Purchase a loot box: subtract coins and grant random gear */
function buyLootBox() {
  const cost = lootBoxCost();
  if (state.coins < cost) {
    displayLootMessage('Not enough coins to buy a loot box.');
    return;
  }
  state.coins -= cost;
  const loot = generateLoot();
  state.gear.push(loot);
  // Apply gear effects to player stats
  applyGearEffect(loot);
  // Display message about loot
  displayLootMessage(`You obtained: ${loot.name}!`);
  // Play sound: use rare sound if loot is particularly powerful
  if (rareLootSound || lootSound) {
    // Compute a rough score to decide if item is rare
    const score = (loot.attackBonus || 0) + (loot.xpMultiplier || 0) * 100 + (loot.coinMultiplier || 0) * 100 + (loot.critChance || 0) * 100 + (loot.critDamage || 0) * 100;
    if (score >= 20 && rareLootSound) {
      rareLootSound.play();
    } else if (lootSound) {
      lootSound.play();
    }
  }
  updateUI();
  saveState();
}

/** Apply a single gear's bonuses to the player's state */
function applyGearEffect(item) {
  if (item.attackBonus) state.attack += item.attackBonus;
  if (item.xpMultiplier) state.xpMultiplier += item.xpMultiplier;
  if (item.coinMultiplier) state.coinMultiplier += item.coinMultiplier;
  if (item.critChance) state.critChance += item.critChance;
  if (item.critDamage) state.critDamage += item.critDamage;
}

/** Compute the current cost of a loot box based on player level */
function lootBoxCost() {
  return 100 * state.level;
}

/** Display a temporary message in the loot section */
function displayLootMessage(msg) {
  const el = document.getElementById('loot-message');
  el.textContent = msg;
  // Clear after 4 seconds
  setTimeout(() => {
    el.textContent = '';
  }, 4000);
}

/** Render the upgrade list and attach purchase handlers */
function renderUpgrades() {
  const container = document.getElementById('upgrade-list');
  container.innerHTML = '';
  UPGRADE_DEFINITIONS.forEach(def => {
    const currentLevel = state.upgrades[def.id] || 0;
    const cost = computeCost(def, currentLevel);
    const item = document.createElement('div');
    item.className = 'upgrade-item';
    const info = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = `${def.name} (Lv ${currentLevel})`;
    const desc = document.createElement('p');
    desc.textContent = def.description;
    info.appendChild(title);
    info.appendChild(desc);
    const btn = document.createElement('button');
    btn.textContent = `Buy (${cost} coins)`;
    btn.disabled = state.coins < cost;
    btn.addEventListener('click', () => {
      purchaseUpgrade(def);
    });
    item.appendChild(info);
    item.appendChild(btn);
    container.appendChild(item);
  });
}

/** Purchase an upgrade if affordable */
function purchaseUpgrade(def) {
  const currentLevel = state.upgrades[def.id] || 0;
  const cost = computeCost(def, currentLevel);
  if (state.coins >= cost) {
    state.coins -= cost;
    state.upgrades[def.id] = currentLevel + 1;
    // Apply upgrade effect
    def.applyEffect(state);
    updateUI();
    saveState();
    // Play upgrade sound if loaded
    if (upgradeSound) upgradeSound.play();
  }
}

/** Render the gear list in the inventory */
function renderGear() {
  const list = document.getElementById('gear-list');
  list.innerHTML = '';
  // Group items by name and count duplicates
  const grouped = {};
  state.gear.forEach(item => {
    if (!grouped[item.name]) {
      grouped[item.name] = { count: 0, totalAttack: 0, totalXpMult: 0, totalCoinMult: 0, totalCritChance: 0, totalCritDamage: 0 };
    }
    grouped[item.name].count += 1;
    grouped[item.name].totalAttack += item.attackBonus || 0;
    grouped[item.name].totalXpMult += item.xpMultiplier || 0;
    grouped[item.name].totalCoinMult += item.coinMultiplier || 0;
    grouped[item.name].totalCritChance += item.critChance || 0;
    grouped[item.name].totalCritDamage += item.critDamage || 0;
  });
  Object.keys(grouped).forEach(name => {
    const data = grouped[name];
    const li = document.createElement('li');
    const attrs = [];
    if (data.totalAttack) attrs.push(`+${data.totalAttack} ATK`);
    if (data.totalXpMult) attrs.push(`+${(data.totalXpMult * 100).toFixed(1)}% XP`);
    if (data.totalCoinMult) attrs.push(`+${(data.totalCoinMult * 100).toFixed(1)}% coins`);
    if (data.totalCritChance) attrs.push(`+${(data.totalCritChance * 100).toFixed(1)}% crit chance`);
    if (data.totalCritDamage) attrs.push(`+${(data.totalCritDamage * 100).toFixed(1)}% crit damage`);
    const countText = data.count > 1 ? ` x${data.count}` : '';
    li.textContent = `${name}${countText} (${attrs.join(', ')})`;
    list.appendChild(li);
  });
}

/** Update all UI elements with current state */
function updateUI() {
  // Basic stats
  document.getElementById('level').textContent = state.level;
  document.getElementById('xp').textContent = Math.floor(state.xp);
  document.getElementById('xp-max').textContent = Math.floor(state.xpNeeded);
  document.getElementById('coins').textContent = Math.floor(state.coins);
  document.getElementById('attack').textContent = state.attack;
  document.getElementById('xp-multiplier').textContent = state.xpMultiplier.toFixed(2);
  document.getElementById('coin-multiplier').textContent = state.coinMultiplier.toFixed(2);
  document.getElementById('crit-chance').textContent = (state.critChance * 100).toFixed(1);
  document.getElementById('crit-damage').textContent = (state.critDamage * 100).toFixed(0);
  // XP progress bar
  const xpPercent = Math.min(100, (state.xp / state.xpNeeded) * 100);
  document.getElementById('xp-progress').style.width = `${xpPercent}%`;
  // Enemy
  if (!state.enemy) spawnEnemy();
  const enemy = state.enemy;
  document.getElementById('enemy-name').textContent = `Enemy Lv ${enemy.level}`;
  document.getElementById('enemy-hp').textContent = Math.max(0, Math.floor(enemy.hp));
  document.getElementById('enemy-max-hp').textContent = enemy.maxHp;
  const enemyPercent = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
  document.getElementById('enemy-progress').style.width = `${enemyPercent}%`;
  // Upgrades and gear
  renderUpgrades();
  renderGear();
  // Loot box cost
  document.getElementById('loot-price').textContent = lootBoxCost();
  // Enable/disable loot button
  const lootBtn = document.getElementById('buy-loot');
  lootBtn.disabled = state.coins < lootBoxCost();
}

/** Handle leveling up the player */
function handleLevelUp() {
  while (state.xp >= state.xpNeeded) {
    state.xp -= state.xpNeeded;
    state.level += 1;
    // Increase xpNeeded by factor
    state.xpNeeded = Math.floor(state.xpNeeded * 1.5);
    // Reward player with coins on level up
    state.coins += 20 * state.level;
    // Play level up sound
    if (levelUpSound) levelUpSound.play();
    // Spawn a tougher enemy
    spawnEnemy();
  }
}

/** Combat loop executed regularly to damage the enemy and award rewards */
function combatLoop() {
  // Deal damage based on attack and crit
  let dmg = state.attack;
  const isCrit = Math.random() < state.critChance;
  if (isCrit) {
    dmg *= state.critDamage;
  }
  // Play attack sound
  if (attackSound) attackSound.play();
  // Play crit sound if critical
  if (isCrit && critSound) critSound.play();
  // Trigger damage animation on enemy health bar
  const enemyBar = document.getElementById('enemy-progress');
  if (enemyBar) {
    enemyBar.classList.add('damage');
    setTimeout(() => enemyBar.classList.remove('damage'), 300);
  }
  state.enemy.hp -= dmg;
  // When enemy dies, award rewards and spawn a new one
  if (state.enemy.hp <= 0) {
    const bonusXp = state.enemy.rewardXP * state.xpMultiplier;
    const bonusCoins = state.enemy.rewardCoins * state.coinMultiplier;
    state.xp += bonusXp;
    state.coins += bonusCoins;
    // Play enemy death sound
    if (enemyDeathSound) enemyDeathSound.play();
    spawnEnemy();
  }
  handleLevelUp();
  updateUI();
  saveState();
}

/** Reset the player's progress completely */
function resetGame() {
  // Remove save from storage
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {}
  // Reset state to defaults
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  // Clear player name input
  const nameInput = document.getElementById('player-name');
  if (nameInput) nameInput.value = '';
  // Spawn new enemy and update
  spawnEnemy();
  updateUI();
  saveState();
}

/** Initialize the game. Loads state, loads sounds, and starts the loops. */
function init() {
  loadState();
  // Set footer year
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  // Bind loot button
  document.getElementById('buy-loot').addEventListener('click', buyLootBox);
  // Bind player name input
  const nameInput = document.getElementById('player-name');
  if (nameInput) {
    nameInput.value = state.playerName || '';
    nameInput.addEventListener('input', () => {
      state.playerName = nameInput.value;
      saveState();
    });
  }
  // Bind reset button
  const resetBtn = document.getElementById('reset-game');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetGame);
  }
  // Load sounds
  try {
    levelUpSound = new Howl({
      src: ['https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg'],
      volume: 0.3
    });
    lootSound = new Howl({
      src: ['https://actions.google.com/sounds/v1/cartoon/woodpecker_pecking.ogg'],
      volume: 0.2
    });
    // Additional sounds for richer feedback
    attackSound = new Howl({
      src: ['https://actions.google.com/sounds/v1/impacts/wood_hit_and_skid.ogg'],
      volume: 0.2
    });
    critSound = new Howl({
      src: ['https://actions.google.com/sounds/v1/cartoon/boing.ogg'],
      volume: 0.3
    });
    enemyDeathSound = new Howl({
      src: ['https://actions.google.com/sounds/v1/impacts/crash_into_wall.ogg'],
      volume: 0.25
    });
    upgradeSound = new Howl({
      src: ['https://actions.google.com/sounds/v1/cartoon/bubble_pop.ogg'],
      volume: 0.25
    });
    rareLootSound = new Howl({
      src: ['https://actions.google.com/sounds/v1/cartoon/slide_whistle_to.ogg'],
      volume: 0.25
    });
  } catch (e) {
    console.warn('Failed to load sounds', e);
    levelUpSound = lootSound = attackSound = critSound = enemyDeathSound = upgradeSound = rareLootSound = null;
  }
  // Spawn an enemy if none present
  if (!state.enemy) spawnEnemy();
  // Apply gear effects (in case items were already in inventory but not applied)
  state.gear.forEach(item => applyGearEffect(item));
  // Initial UI update
  updateUI();
  // Start combat loop every second
  setInterval(combatLoop, 1000);

  // Cheat: press 'l' and 'm' simultaneously to add 100 × level coins
  let keyLDown = false;
  let keyMDown = false;
  let cheatTriggered = false;
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'l') keyLDown = true;
    if (e.key.toLowerCase() === 'm') keyMDown = true;
    if (keyLDown && keyMDown && !cheatTriggered) {
      // Add 100 * level coins
      state.coins += 100 * state.level;
      updateUI();
      saveState();
      cheatTriggered = true;
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'l') keyLDown = false;
    if (e.key.toLowerCase() === 'm') keyMDown = false;
    // Reset cheat trigger when either key released
    if (!keyLDown || !keyMDown) cheatTriggered = false;
  });
}

document.addEventListener('DOMContentLoaded', init);