const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ROOM_SIZE_BASE = 10;
let roomWidth = 10;
let roomHeight = 10;
const HOLE_SIZE_PERCENT = 0.2;
const SHOOT_COOLDOWN = 350;

const WEAPONS = {
    pistol: {
        name: 'Standard Pistol',
        baseDamage: 1, damage: 1,
        baseCooldown: 350, cooldown: 350,
        baseAmmo: 12, ammo: 12,
        reloadTime: 65,
        auto: false,
        gunColor: '#777',
        width: 0.12,
        length: 0.5,
        price: 0,
        owned: true,
        damageLevel: 0, firerateLevel: 0, magLevel: 0
    },
    ak47: {
        name: 'AK-47',
        baseDamage: 0.5, damage: 0.5,
        baseCooldown: 110, cooldown: 110,
        baseAmmo: 30, ammo: 30,
        reloadTime: 110,
        auto: true,
        gunColor: '#444',
        width: 0.1,
        length: 0.7,
        price: 500,
        owned: false,
        damageLevel: 0, firerateLevel: 0, magLevel: 0
    },
    shotgun: {
        name: 'Shotgun',
        baseDamage: 1.2, damage: 1.2,
        baseCooldown: 900, cooldown: 900,
        baseAmmo: 6, ammo: 6,
        reloadTime: 160,
        auto: false,
        gunColor: '#555',
        width: 0.22,
        length: 0.65,
        price: 1200,
        owned: false,
        spread: 4, // fewer pellets
        pierce: 1,
        damageLevel: 0, firerateLevel: 0, magLevel: 0
    },
    sniper: {
        name: 'Void Sniper',
        baseDamage: 4, damage: 4,
        baseCooldown: 1400, cooldown: 1400,
        baseAmmo: 8, ammo: 8,
        reloadTime: 140,
        auto: false,
        gunColor: '#1a1a2e',
        width: 0.09,
        length: 0.85,
        price: 2500,
        owned: false,
        pierce: 3,
        bulletSpeed: 0.45,
        damageLevel: 0, firerateLevel: 0, magLevel: 0
    },
    rpg: {
        name: 'RPG-7',
        baseDamage: 5, damage: 5,
        baseCooldown: 1800, cooldown: 1800,
        baseAmmo: 3, ammo: 3,
        reloadTime: 230,
        auto: false,
        gunColor: '#4a5d23',
        width: 0.22,
        length: 1.0,
        price: 10000,
        owned: false,
        isRocket: true,
        baseRadius: 0.73,
        explosionRadius: 0.73,
        bulletSpeed: 0.15,
        damageLevel: 0, firerateLevel: 0, magLevel: 0, radiusLevel: 0
    }
};

const SKINS = {
    default: { name: 'Survivor White', type: 'color', value: '#e0e0e0', price: 0, owned: true },
    crimson: { name: 'Crimson Fury', type: 'color', value: '#ff3333', price: 100, owned: false },
    void: { name: 'Void Stalker', type: 'color', value: '#222222', price: 200, owned: false },
    gold: { name: 'Gold Bar', type: 'gradient', value: ['#ffd700', '#b8860b'], price: 500, owned: false },
    plasma: { name: 'Plasma Flow', type: 'gradient', value: ['#ff00ff', '#0000ff'], price: 750, owned: false },
    stealth: { name: 'Stealth Camo', type: 'texture', value: 'camo', price: 1000, owned: false },
    horror: { name: 'Bloodstained', type: 'texture', value: 'blood', price: 1500, owned: false },
    rainbow: { name: 'RGB God', type: 'rainbow', price: 10000, owned: false }
};

let equippedSkin = 'default';

let scale = 0;
let offset = { x: 0, y: 0 };
let mouseX = 0;
let mouseY = 0;
let isMouseDown = false;
let lastShootTime = 0;

const keys = {};
const PLAYER_SPEED = 0.055;

// --- Settings ---
let settings = {
    musicVolume: 80,
    sfxVolume: 80,
    music: false,
    sfx: true
};

const POWERS = {
    explosion: {
        id: 'explosion',
        name: 'Void Explosion',
        desc: 'Release a devastating burst of void energy. Deals 250% of your current weapon\'s damage to all nearby enemies.',
        price: 1500,
        reqLevel: 3,
        cooldown: 45000,
        owned: false,
        lastUsed: 0,
        color: '#ff6600',
        icon: '💥',
        baseDamageMult: 2.5,
        damageLevel: 0,
        baseRadius: 3.5,
        radiusLevel: 0
    }
};

let selectedPowerId = null; // tracking for details panel
let equippedPowers = [null, null, null]; // IDs of powers in slots
let selectedSlotIndex = 0; // for assignment in menu

let activePower = null; // Removed in favor of equippedPowers

// --- Game Logic State ---
let enemiesRemainingToSpawn = 0;
let nextSpawnTimer = 0;

// --- Game State ---
let gameState = 'menu'; // 'menu', 'playing', 'dead', 'roomClear', 'paused'
let currentRoom = 1;
let killCount = 0;
let coins = 0;
let roomClearTimer = 0;
const ROOM_CLEAR_DELAY = 120; // frames before next room (used as fallback)
// Grace period tiers (at 60fps): coins → seconds
// 1-10 coins: 5s, 11-19: interpolated, 20-30: 15s, 30+: 25s
let gracePeriodActive = false;
let gracePeriodTimer = 0;
let gracePeriodMaxTimer = 0; // initial timer value for progress bar
let currentMapIdx = 0;
const MAPS = [
    { name: 'Meadow', type: 'image', src: 'Maps/map_grass.png' },
    { name: 'Dungeon', type: 'dungeon' },
    { name: 'Bunker', type: 'bunker' },
    { name: 'Desert', type: 'desert' },
    { name: 'Sewers', type: 'sewer' },
    { name: 'Office', type: 'office' }
];

const BUNKER_TILES = {
    FLOOR: 0, DARK: 1, GRATE: 2, STAIN: 3, CRATE: 4, VENT: 5, WIRE: 6, PANEL: 7
};

const BUNKER_MAP_DATA = [
    [0, 0, 0, 1, 0, 0, 7, 0, 0, 0, 1, 0, 5, 0, 0, 0, 0, 1, 0, 0, 7, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 7, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 6, 0, 0, 0, 1, 0, 0, 0, 7, 0, 0],
    [0, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 0, 7, 0, 0, 2, 2, 0, 6, 0, 0, 1, 0, 0, 0, 0, 0, 3, 0],
    [1, 0, 0, 0, 0, 0, 4, 0, 0, 0, 7, 0, 0, 0, 0, 0, 2, 2, 0, 6, 0, 0, 0, 0, 7, 0, 0, 0, 0, 1],
    [0, 0, 5, 0, 0, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 4, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 7, 0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 7, 0],
    [7, 0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 1, 0, 0, 4, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 4, 0, 0, 0, 0, 0, 7, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 1, 0, 0, 3],
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 3, 0, 0, 5, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0],
    [1, 0, 3, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 7, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 7, 0, 1, 0, 0, 0, 0, 0, 7, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 7, 0, 0, 1, 0],
    [0, 4, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 7, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0],
    [0, 0, 0, 1, 0, 0, 7, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 7, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [7, 0, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 7, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 7, 0, 0, 0, 0, 1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 1, 0],
];

function drawBunkerTile(type, x, y, ts) {
    const s = ts / 16;
    switch (type) {
        case BUNKER_TILES.FLOOR:
            ctx.fillStyle = '#3a3d2e'; ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#2e3024'; ctx.fillRect(x, y + 7 * s, ts, 1 * s); ctx.fillRect(x + 7 * s, y, 1 * s, ts);
            ctx.fillStyle = '#4a4e3a'; ctx.fillRect(x + 2 * s, y + 2 * s, 2 * s, 2 * s); ctx.fillRect(x + 12 * s, y + 2 * s, 2 * s, 2 * s); ctx.fillRect(x + 2 * s, y + 12 * s, 2 * s, 2 * s); ctx.fillRect(x + 12 * s, y + 12 * s, 2 * s, 2 * s);
            ctx.fillStyle = '#5a5e48'; ctx.fillRect(x + 2 * s, y + 2 * s, 1 * s, 1 * s); ctx.fillRect(x + 12 * s, y + 2 * s, 1 * s, 1 * s);
            break;
        case BUNKER_TILES.DARK:
            ctx.fillStyle = '#252720'; ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#1e2019'; ctx.fillRect(x, y + 7 * s, ts, 1 * s); ctx.fillRect(x + 7 * s, y, 1 * s, ts);
            ctx.fillStyle = '#2e3028'; ctx.fillRect(x + 2 * s, y + 2 * s, 2 * s, 2 * s); ctx.fillRect(x + 12 * s, y + 12 * s, 2 * s, 2 * s);
            break;
        case BUNKER_TILES.GRATE:
            ctx.fillStyle = '#2a2c22'; ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#3e4132'; for (let i = 0; i < 4; i++) ctx.fillRect(x, y + (2 + i * 4) * s, ts, 2 * s);
            ctx.fillStyle = '#363828'; for (let i = 0; i < 4; i++) ctx.fillRect(x + (2 + i * 4) * s, y, 2 * s, ts);
            ctx.fillStyle = '#151612'; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.fillRect(x + (4 + c * 4) * s, y + (4 + r * 4) * s, 2 * s, 2 * s);
            break;
        case BUNKER_TILES.STAIN:
            drawBunkerTile(BUNKER_TILES.FLOOR, x, y, ts);
            ctx.fillStyle = 'rgba(80,40,20,0.7)'; ctx.fillRect(x + 3 * s, y + 5 * s, 7 * s, 5 * s); ctx.fillRect(x + 5 * s, y + 4 * s, 4 * s, 7 * s);
            ctx.fillStyle = 'rgba(60,25,10,0.5)'; ctx.fillRect(x + 4 * s, y + 6 * s, 5 * s, 3 * s);
            ctx.fillStyle = 'rgba(100,55,20,0.4)'; ctx.fillRect(x + 3 * s, y + 5 * s, 2 * s, 1 * s); ctx.fillRect(x + 9 * s, y + 8 * s, 1 * s, 2 * s);
            break;
        case BUNKER_TILES.CRATE:
            drawBunkerTile(BUNKER_TILES.DARK, x, y, ts);
            ctx.fillStyle = '#5a4e2a'; ctx.fillRect(x + 2 * s, y + 3 * s, 12 * s, 10 * s);
            ctx.fillStyle = '#6a5e38'; ctx.fillRect(x + 2 * s, y + 3 * s, 12 * s, 3 * s); ctx.fillRect(x + 2 * s, y + 3 * s, 3 * s, 10 * s);
            ctx.fillStyle = '#4a3e20'; ctx.fillRect(x + 2 * s, y + 7 * s, 12 * s, 1 * s); ctx.fillRect(x + 7 * s, y + 3 * s, 1 * s, 10 * s);
            ctx.fillStyle = '#3a2e18'; ctx.fillRect(x + 13 * s, y + 4 * s, 1 * s, 9 * s); ctx.fillRect(x + 3 * s, y + 12 * s, 11 * s, 1 * s);
            break;
        case BUNKER_TILES.VENT:
            drawBunkerTile(BUNKER_TILES.FLOOR, x, y, ts);
            ctx.fillStyle = '#4e5240'; ctx.fillRect(x + 1 * s, y + 4 * s, 14 * s, 8 * s);
            ctx.fillStyle = '#3a3e2e'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 1 * s, y + (5 + i * 2) * s, 14 * s, 1 * s);
            ctx.fillStyle = '#5e6250'; ctx.fillRect(x + 1 * s, y + 4 * s, 14 * s, 1 * s); ctx.fillRect(x + 1 * s, y + 4 * s, 1 * s, 8 * s);
            ctx.fillStyle = '#2a2e20'; ctx.fillRect(x + 14 * s, y + 5 * s, 1 * s, 7 * s); ctx.fillRect(x + 2 * s, y + 11 * s, 13 * s, 1 * s);
            break;
        case BUNKER_TILES.WIRE:
            drawBunkerTile(BUNKER_TILES.DARK, x, y, ts);
            ctx.fillStyle = '#8a3a2a'; ctx.fillRect(x, y + 6 * s, ts, 2 * s);
            ctx.fillStyle = '#6a2a1a'; ctx.fillRect(x, y + 7 * s, ts, 1 * s);
            ctx.fillStyle = '#2a4a8a'; ctx.fillRect(x, y + 10 * s, ts, 1 * s);
            ctx.fillStyle = '#aaa'; ctx.fillRect(x + 6 * s, y + 5 * s, 3 * s, 4 * s);
            ctx.fillStyle = '#888'; ctx.fillRect(x + 7 * s, y + 6 * s, 1 * s, 2 * s);
            break;
        case BUNKER_TILES.PANEL:
            drawBunkerTile(BUNKER_TILES.FLOOR, x, y, ts);
            ctx.fillStyle = '#4a4e3e'; ctx.fillRect(x + 1 * s, y + 1 * s, 14 * s, 14 * s);
            ctx.fillStyle = '#5a5e4e'; ctx.fillRect(x + 1 * s, y + 1 * s, 14 * s, 2 * s); ctx.fillRect(x + 1 * s, y + 1 * s, 2 * s, 14 * s);
            ctx.fillStyle = '#3a3e2e'; ctx.fillRect(x + 14 * s, y + 2 * s, 1 * s, 13 * s); ctx.fillRect(x + 2 * s, y + 14 * s, 13 * s, 1 * s);
            ctx.fillStyle = '#2e3224'; ctx.fillRect(x + 3 * s, y + 7 * s, 10 * s, 1 * s);
            ctx.fillStyle = '#6a6e5e'; ctx.fillRect(x + 3 * s, y + 3 * s, 2 * s, 2 * s); ctx.fillRect(x + 11 * s, y + 3 * s, 2 * s, 2 * s); ctx.fillRect(x + 3 * s, y + 11 * s, 2 * s, 2 * s); ctx.fillRect(x + 11 * s, y + 11 * s, 2 * s, 2 * s);
            break;
    }
}

const DUNGEON_TILES = {
    FLOOR: 0, DARK: 1, CRACK: 2, STONE: 3, MOSS: 4, WATER: 5, BONE: 6, GRAVEL: 7
};

const DUNGEON_MAP_DATA = [
    [0, 0, 1, 0, 0, 7, 0, 0, 1, 0, 0, 0, 7, 0, 0, 0, 1, 0, 0, 7, 0, 0, 0, 1, 0, 0, 7, 0, 0, 0],
    [0, 3, 0, 0, 0, 0, 0, 1, 0, 0, 4, 0, 0, 0, 7, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 1, 0, 0, 0, 7],
    [1, 0, 0, 2, 0, 0, 4, 0, 0, 0, 0, 0, 0, 3, 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 3, 0],
    [0, 0, 4, 0, 0, 1, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 5, 5, 0, 0, 4, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 3, 0, 0, 0, 1, 0, 2, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 4, 0],
    [7, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 2, 0, 1],
    [0, 4, 0, 0, 7, 0, 0, 0, 2, 0, 0, 4, 0, 0, 0, 0, 6, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 7, 0],
    [1, 0, 0, 0, 0, 0, 0, 4, 0, 0, 7, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [0, 0, 4, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 0, 1, 0, 0, 0],
    [0, 7, 0, 0, 0, 0, 2, 0, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 0, 4, 0, 0, 0, 7, 0, 0, 0, 3, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 7, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 4],
    [3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 7, 0, 0, 0, 0, 2, 0, 0, 0],
    [0, 0, 7, 0, 0, 0, 0, 3, 0, 0, 0, 0, 7, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3, 0, 0, 4, 0],
];

function drawDungeonTile(type, x, y, ts) {
    const s = ts / 16;
    switch (type) {
        case DUNGEON_TILES.FLOOR:
            ctx.fillStyle = '#3a3345'; ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#312d3f'; ctx.fillRect(x, y + 7 * s, ts, 1 * s); ctx.fillRect(x + 7 * s, y, 1 * s, 7 * s);
            ctx.fillStyle = '#4a4558'; ctx.fillRect(x + 1 * s, y + 1 * s, 1 * s, 1 * s); ctx.fillRect(x + 14 * s, y + 14 * s, 1 * s, 1 * s);
            break;
        case DUNGEON_TILES.DARK:
            ctx.fillStyle = '#2a2535'; ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#221f2e'; ctx.fillRect(x, y + 7 * s, ts, 1 * s); ctx.fillRect(x + 7 * s, y, 1 * s, 7 * s);
            ctx.fillStyle = '#332f42'; ctx.fillRect(x + 1 * s, y + 1 * s, 1 * s, 1 * s);
            break;
        case DUNGEON_TILES.CRACK:
            drawDungeonTile(DUNGEON_TILES.FLOOR, x, y, ts);
            ctx.fillStyle = '#1e1a28'; ctx.fillRect(x + 4 * s, y + 3 * s, 1 * s, 1 * s); ctx.fillRect(x + 5 * s, y + 4 * s, 1 * s, 2 * s); ctx.fillRect(x + 6 * s, y + 6 * s, 1 * s, 1 * s); ctx.fillRect(x + 7 * s, y + 7 * s, 1 * s, 2 * s); ctx.fillRect(x + 8 * s, y + 9 * s, 1 * s, 1 * s);
            ctx.fillStyle = '#28243a'; ctx.fillRect(x + 3 * s, y + 4 * s, 1 * s, 1 * s); ctx.fillRect(x + 9 * s, y + 10 * s, 1 * s, 1 * s);
            break;
        case DUNGEON_TILES.STONE:
            drawDungeonTile(DUNGEON_TILES.FLOOR, x, y, ts);
            ctx.fillStyle = '#4a4460'; ctx.fillRect(x + 5 * s, y + 5 * s, 6 * s, 5 * s);
            ctx.fillStyle = '#5a5472'; ctx.fillRect(x + 5 * s, y + 5 * s, 6 * s, 2 * s); ctx.fillRect(x + 5 * s, y + 5 * s, 2 * s, 5 * s);
            ctx.fillStyle = '#332e45'; ctx.fillRect(x + 10 * s, y + 7 * s, 1 * s, 3 * s); ctx.fillRect(x + 7 * s, y + 9 * s, 4 * s, 1 * s);
            break;
        case DUNGEON_TILES.MOSS:
            drawDungeonTile(DUNGEON_TILES.FLOOR, x, y, ts);
            ctx.fillStyle = '#2d5a27'; ctx.fillRect(x + 2 * s, y + 10 * s, 3 * s, 3 * s);
            ctx.fillStyle = '#3a6e32'; ctx.fillRect(x + 6 * s, y + 9 * s, 3 * s, 4 * s);
            ctx.fillStyle = '#245222'; ctx.fillRect(x + 10 * s, y + 11 * s, 3 * s, 2 * s);
            ctx.fillStyle = '#4a8a42'; ctx.fillRect(x + 3 * s, y + 11 * s, 1 * s, 1 * s); ctx.fillRect(x + 7 * s, y + 9 * s, 1 * s, 1 * s);
            break;
        case DUNGEON_TILES.WATER:
            ctx.fillStyle = '#1e3248'; ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#2a4a62'; ctx.fillRect(x + 2 * s, y + 3 * s, 4 * s, 1 * s); ctx.fillRect(x + 9 * s, y + 7 * s, 4 * s, 1 * s); ctx.fillRect(x + 4 * s, y + 11 * s, 3 * s, 1 * s);
            ctx.fillStyle = '#3a5a78'; ctx.fillRect(x + 3 * s, y + 3 * s, 1 * s, 1 * s); ctx.fillRect(x + 10 * s, y + 7 * s, 1 * s, 1 * s);
            ctx.fillStyle = '#141e2a'; ctx.fillRect(x, y, ts, 1 * s); ctx.fillRect(x, y, 1 * s, ts);
            break;
        case DUNGEON_TILES.BONE:
            drawDungeonTile(DUNGEON_TILES.DARK, x, y, ts);
            ctx.fillStyle = '#c8b89a'; ctx.fillRect(x + 4 * s, y + 7 * s, 8 * s, 2 * s); ctx.fillRect(x + 4 * s, y + 6 * s, 2 * s, 4 * s); ctx.fillRect(x + 10 * s, y + 6 * s, 2 * s, 4 * s);
            ctx.fillStyle = '#a89880'; ctx.fillRect(x + 5 * s, y + 8 * s, 6 * s, 1 * s); ctx.fillRect(x + 5 * s, y + 9 * s, 1 * s, 1 * s); ctx.fillRect(x + 10 * s, y + 9 * s, 1 * s, 1 * s);
            break;
        case DUNGEON_TILES.GRAVEL:
            drawDungeonTile(DUNGEON_TILES.FLOOR, x, y, ts);
            const dots = [[2, 4], [5, 2], [9, 5], [13, 3], [3, 11], [7, 8], [11, 12], [14, 7], [6, 13], [10, 9]];
            dots.forEach(([dx, dy], i) => {
                ctx.fillStyle = i % 2 === 0 ? '#28243a' : '#4e4a62';
                ctx.fillRect(x + dx * s, y + dy * s, 1 * s, 1 * s);
            });
            break;
    }
}

const DESERT_TILES = { SAND: 0, DARK: 1, CRACK: 2, RUBBLE: 3, PILLAR: 4, FOSSIL: 5, DUNE: 6, TILE: 7 };
const DESERT_MAP_DATA = [
    [0, 0, 6, 0, 0, 7, 7, 0, 0, 1, 0, 0, 0, 6, 0, 0, 7, 7, 0, 0, 0, 1, 0, 0, 6, 0, 0, 0, 7, 0],
    [0, 3, 0, 0, 7, 7, 0, 0, 1, 0, 0, 4, 0, 0, 0, 7, 7, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 0, 6],
    [6, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 3, 0, 0],
    [0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 6, 0, 0, 0, 0, 1, 0, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 4, 0, 0, 0, 6, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 2, 0, 0, 3],
    [6, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 6, 0],
    [0, 0, 1, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 2, 0, 0],
    [0, 3, 0, 0, 6, 0, 0, 0, 2, 0, 0, 3, 0, 0, 0, 0, 5, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0, 4],
    [0, 0, 0, 4, 0, 0, 1, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 6, 0],
    [1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 6, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 3],
    [0, 0, 3, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 6, 0, 0, 0, 0, 5, 0, 0, 6, 0, 0, 1, 0],
    [0, 6, 0, 0, 0, 0, 2, 0, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0, 3, 0, 0, 0, 6, 0, 0, 0, 3, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 6, 0, 0, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2],
    [3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 6, 0, 0, 0, 0, 2, 0, 0, 0],
    [0, 0, 6, 0, 0, 0, 0, 3, 0, 0, 0, 0, 6, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3, 0, 0, 4, 0],
];

function drawDesertTile(type, x, y, ts) {
    const s = ts / 16;
    const { SAND, DARK, CRACK, RUBBLE, PILLAR, FOSSIL, DUNE, TILE } = DESERT_TILES;
    const fill = (fx, fy, fw, fh, color) => { ctx.fillStyle = color; ctx.fillRect(x + fx * s, y + fy * s, (fw || 1) * s, (fh || 1) * s); };
    switch (type) {
        case SAND:
            ctx.fillStyle = '#c8a85a'; ctx.fillRect(x, y, ts, ts);
            fill(3, 5, 2, 1, '#b89848'); fill(9, 2, 1, 1, '#b89848'); fill(13, 9, 2, 1, '#b89848'); fill(1, 12, 1, 1, '#b89848'); fill(7, 13, 2, 1, '#b89848');
            fill(5, 3, 1, 1, '#d8b86a'); fill(11, 7, 1, 1, '#d8b86a'); fill(2, 10, 1, 1, '#d8b86a');
            break;
        case DARK:
            ctx.fillStyle = '#a88840'; ctx.fillRect(x, y, ts, ts);
            fill(4, 6, 2, 1, '#987830'); fill(10, 3, 1, 1, '#987830'); fill(2, 11, 2, 1, '#987830');
            break;
        case CRACK:
            drawDesertTile(SAND, x, y, ts);
            ctx.fillStyle = '#7a5a20'; fill(4, 3, 1, 1, '#7a5a20'); fill(5, 4, 1, 2, '#7a5a20'); fill(6, 6, 1, 1, '#7a5a20'); fill(7, 7, 1, 2, '#7a5a20'); fill(8, 9, 1, 1, '#7a5a20');
            fill(3, 4, 1, 1, '#9a7a38'); fill(9, 10, 1, 1, '#9a7a38');
            break;
        case RUBBLE:
            drawDesertTile(DARK, x, y, ts);
            ctx.fillStyle = '#8a7a5a'; fill(2, 8, 5, 4, '#8a7a5a'); fill(8, 5, 6, 3, '#8a7a5a');
            fill(2, 8, 5, 1, '#a8987a'); fill(2, 8, 1, 4, '#a8987a'); fill(8, 5, 6, 1, '#a8987a'); fill(8, 5, 1, 3, '#a8987a');
            fill(6, 11, 1, 1, '#6a5a3a'); fill(13, 7, 1, 1, '#6a5a3a');
            break;
        case PILLAR:
            drawDesertTile(DARK, x, y, ts);
            fill(4, 2, 8, 12, '#b0a070'); fill(4, 2, 8, 2, '#c0b080'); fill(4, 2, 2, 12, '#c0b080');
            fill(11, 4, 1, 10, '#807050'); fill(5, 13, 7, 1, '#807050');
            fill(6, 6, 4, 1, '#908060'); fill(6, 9, 4, 1, '#908060');
            break;
        case FOSSIL:
            drawDesertTile(SAND, x, y, ts);
            fill(4, 6, 8, 1, '#e8d8a0'); fill(5, 5, 6, 1, '#e8d8a0'); fill(6, 4, 4, 1, '#e8d8a0'); fill(4, 7, 2, 2, '#e8d8a0'); fill(10, 7, 2, 2, '#e8d8a0');
            fill(5, 6, 6, 1, '#c8b878'); fill(5, 7, 1, 1, '#c8b878'); fill(10, 7, 1, 1, '#c8b878');
            break;
        case DUNE:
            ctx.fillStyle = '#d8b860'; ctx.fillRect(x, y, ts, ts); ctx.fillStyle = '#c8a850'; ctx.fillRect(x, y + 8 * s, ts, ts - 8 * s);
            fill(0, 7, 16, 2, '#e8c870'); fill(2, 10, 2, 1, '#b89840'); fill(8, 12, 3, 1, '#b89840');
            break;
        case TILE:
            ctx.fillStyle = '#b89858'; ctx.fillRect(x, y, ts, ts); ctx.fillStyle = '#a88848'; fill(0, 7, 16, 1, '#a88848'); fill(7, 0, 1, 16, '#a88848');
            fill(1, 1, 6, 6, '#c8a868'); fill(9, 9, 6, 6, '#c8a868');
            fill(6, 1, 1, 6, '#987838'); fill(1, 6, 6, 1, '#987838'); fill(14, 9, 1, 6, '#987838'); fill(9, 14, 6, 1, '#987838');
            break;
    }
}

const SEWER_TILES = { FLOOR: 0, DARK: 1, WATER: 2, GRATE: 3, SLIME: 4, PIPE: 5, CRACK: 6, ALGAE: 7 };
const SEWER_MAP_DATA = [
    [0, 0, 1, 0, 0, 3, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 1, 0, 0, 3, 0, 0, 0],
    [0, 4, 0, 0, 0, 0, 0, 1, 0, 0, 7, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 1, 0, 0, 0, 4],
    [1, 0, 0, 6, 0, 0, 7, 0, 0, 0, 0, 0, 0, 4, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 4, 0],
    [0, 0, 4, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 7, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 5, 0, 0, 0, 1, 0, 6, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 7, 0],
    [3, 0, 0, 0, 5, 0, 4, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 7, 0, 0, 0, 0],
    [0, 0, 1, 0, 5, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 6, 0, 1],
    [0, 7, 0, 0, 0, 0, 0, 0, 6, 0, 0, 4, 0, 0, 0, 0, 3, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 4, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 7, 0, 0, 3, 0],
    [1, 0, 0, 0, 0, 0, 0, 7, 0, 0, 3, 0, 0, 0, 0, 6, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [0, 0, 4, 0, 5, 0, 1, 0, 0, 0, 0, 0, 3, 4, 0, 0, 0, 3, 0, 0, 0, 0, 7, 0, 0, 3, 0, 0, 1, 0],
    [0, 3, 0, 0, 5, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0],
    [0, 0, 0, 1, 5, 0, 0, 0, 4, 0, 0, 0, 0, 0, 3, 0, 0, 0, 4, 0, 7, 0, 0, 1, 0, 0, 0, 0, 0, 6],
    [4, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 3, 0, 0, 0, 0, 6, 0, 0, 0],
    [0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 3, 0, 0, 7, 0, 0, 0, 1, 0, 0, 0, 0, 0, 4, 0, 0, 1, 0],
];

function drawSewerTile(type, x, y, ts) {
    const s = ts / 16;
    const { FLOOR, DARK, WATER, GRATE, SLIME, PIPE, CRACK, ALGAE } = SEWER_TILES;
    const fill = (fx, fy, fw, fh, color) => { ctx.fillStyle = color; ctx.fillRect(x + fx * s, y + fy * s, (fw || 1) * s, (fh || 1) * s); };
    switch (type) {
        case FLOOR:
            ctx.fillStyle = '#2a3028'; ctx.fillRect(x, y, ts, ts); fill(0, 7, 16, 1, '#222820'); fill(7, 0, 1, 16, '#222820');
            fill(1, 1, 2, 2, '#343830'); fill(13, 13, 2, 2, '#343830'); fill(1, 14, 2, 1, '#1e241c'); fill(13, 1, 2, 1, '#1e241c');
            break;
        case DARK:
            ctx.fillStyle = '#1a1e18'; ctx.fillRect(x, y, ts, ts); fill(0, 7, 16, 1, '#141810'); fill(7, 0, 1, 16, '#141810');
            fill(2, 2, 1, 1, '#202418'); fill(13, 13, 1, 1, '#202418');
            break;
        case WATER:
            ctx.fillStyle = '#1a3030'; ctx.fillRect(x, y, ts, ts); fill(1, 1, 14, 14, '#204040');
            fill(2, 4, 5, 1, '#2a5050'); fill(9, 8, 4, 1, '#2a5050'); fill(3, 12, 4, 1, '#2a5050');
            fill(3, 4, 1, 1, '#3a6060'); fill(10, 8, 1, 1, '#3a6060'); fill(0, 0, 16, 1, '#182828'); fill(0, 0, 1, 16, '#182828');
            break;
        case GRATE:
            ctx.fillStyle = '#1e2218'; ctx.fillRect(x, y, ts, ts);
            for (let i = 0; i < 4; i++) fill(0, 2 + i * 4, 16, 2, '#2e3428');
            for (let i = 0; i < 4; i++) fill(2 + i * 4, 0, 2, 16, '#262c20');
            for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) fill(4 + c * 4, 4 + r * 4, 2, 2, '#10140e');
            break;
        case SLIME:
            drawSewerTile(DARK, x, y, ts); ctx.fillStyle = 'rgba(40,90,30,0.85)'; fill(3, 4, 8, 7, 'rgba(40,90,30,0.85)'); fill(5, 3, 5, 9, 'rgba(40,90,30,0.85)');
            fill(4, 5, 6, 5, 'rgba(60,130,40,0.6)'); fill(5, 6, 4, 3, 'rgba(80,160,50,0.4)'); fill(6, 7, 2, 1, 'rgba(100,200,60,0.3)');
            break;
        case PIPE:
            drawSewerTile(FLOOR, x, y, ts); fill(1, 5, 14, 6, '#5a5040'); fill(1, 5, 14, 2, '#6a6050'); fill(1, 5, 2, 6, '#6a6050');
            fill(13, 7, 2, 4, '#4a4030'); fill(3, 10, 12, 1, '#4a4030'); fill(6, 5, 1, 1, '#7a6a58'); fill(10, 5, 1, 1, '#7a6a58');
            fill(3, 9, 4, 2, 'rgba(40,90,30,0.5)');
            break;
        case CRACK:
            drawSewerTile(FLOOR, x, y, ts); fill(5, 3, 1, 1, '#0e120c'); fill(6, 4, 1, 2, '#0e120c'); fill(7, 6, 1, 2, '#0e120c'); fill(8, 8, 1, 1, '#0e120c'); fill(9, 9, 1, 2, '#0e120c');
            fill(4, 4, 1, 1, '#1a201a'); fill(10, 10, 1, 1, '#1a201a');
            break;
        case ALGAE:
            drawSewerTile(DARK, x, y, ts); fill(2, 9, 4, 4, '#1e4a18'); fill(7, 8, 3, 5, '#1e4a18'); fill(11, 10, 3, 3, '#1e4a18');
            fill(3, 9, 2, 3, '#2a6022'); fill(8, 8, 1, 4, '#2a6022'); fill(3, 9, 1, 1, '#386830'); fill(8, 8, 1, 1, '#386830'); fill(1, 7, 14, 2, 'rgba(30,80,20,0.4)');
            break;
    }
}

const OFFICE_TILES = { FLOOR: 0, DARK: 1, CARPET: 2, TILE: 3, PAPER: 4, DESK: 5, STAIN: 6, CRACK: 7 };
const OFFICE_MAP_DATA = [
    [2, 2, 1, 2, 2, 3, 3, 2, 2, 1, 2, 2, 2, 3, 2, 2, 3, 3, 2, 2, 2, 1, 2, 2, 3, 2, 2, 2, 3, 2],
    [2, 4, 2, 2, 2, 3, 2, 2, 1, 2, 2, 5, 2, 2, 2, 3, 3, 2, 2, 2, 4, 2, 2, 1, 2, 2, 2, 2, 2, 3],
    [1, 2, 2, 7, 2, 2, 2, 1, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 1, 2, 2, 2, 3, 2, 2, 2, 2, 4, 2, 2],
    [2, 2, 6, 2, 2, 1, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 2, 2, 2, 1, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 5, 2, 2, 2, 1, 2, 7, 2, 2, 2, 6, 2, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 4, 2],
    [3, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 4, 2, 2, 2, 1, 2, 2, 2, 4, 2, 2, 2, 2],
    [2, 2, 1, 2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 7, 2, 1],
    [2, 4, 2, 2, 3, 2, 2, 2, 7, 2, 2, 4, 2, 2, 2, 2, 4, 2, 2, 4, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2],
    [2, 2, 2, 6, 2, 2, 1, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 4, 2, 2, 3, 2],
    [1, 2, 2, 2, 2, 2, 2, 5, 2, 2, 3, 2, 2, 2, 2, 7, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 6],
    [2, 2, 4, 2, 3, 2, 1, 2, 2, 2, 2, 2, 3, 4, 2, 2, 2, 3, 2, 2, 2, 2, 4, 2, 2, 3, 2, 2, 1, 2],
    [2, 3, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 3, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 5, 2, 2],
    [2, 2, 2, 1, 2, 2, 2, 2, 6, 2, 2, 2, 2, 2, 3, 2, 2, 2, 4, 2, 7, 2, 2, 1, 2, 2, 2, 2, 2, 4],
    [4, 2, 2, 2, 2, 4, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 3, 2, 2, 2, 2, 7, 2, 2, 2],
    [2, 2, 3, 2, 2, 2, 2, 4, 2, 2, 2, 2, 3, 2, 2, 4, 2, 2, 2, 1, 2, 2, 2, 2, 2, 4, 2, 2, 1, 2],
];

function drawOfficeTile(type, x, y, ts) {
    const s = ts / 16;
    const { FLOOR, DARK, CARPET, TILE, PAPER, DESK, STAIN, CRACK } = OFFICE_TILES;
    const fill = (fx, fy, fw, fh, color) => { ctx.fillStyle = color; ctx.fillRect(x + fx * s, y + fy * s, (fw || 1) * s, (fh || 1) * s); };
    switch (type) {
        case FLOOR:
            ctx.fillStyle = '#4a4438'; ctx.fillRect(x, y, ts, ts); fill(0, 7, 16, 1, '#3e3830'); fill(7, 0, 1, 16, '#3e3830');
            fill(1, 1, 2, 2, '#565048'); fill(13, 13, 2, 2, '#565048'); fill(13, 1, 2, 1, '#302c24'); fill(1, 13, 1, 2, '#302c24');
            break;
        case DARK:
            ctx.fillStyle = '#2e2a22'; ctx.fillRect(x, y, ts, ts); fill(0, 7, 16, 1, '#252018'); fill(7, 0, 1, 16, '#252018');
            fill(2, 2, 1, 1, '#383228'); fill(13, 13, 1, 1, '#383228');
            break;
        case CARPET:
            ctx.fillStyle = '#5a3a3a'; ctx.fillRect(x, y, ts, ts); fill(0, 3, 16, 1, '#4a2e2e'); fill(0, 7, 16, 1, '#4a2e2e'); fill(0, 11, 16, 1, '#4a2e2e');
            fill(3, 0, 1, 16, '#4a2e2e'); fill(7, 0, 1, 16, '#4a2e2e'); fill(11, 0, 1, 16, '#4a2e2e');
            fill(1, 1, 1, 1, '#6a4848'); fill(5, 5, 1, 1, '#6a4848'); fill(9, 9, 1, 1, '#6a4848'); fill(13, 13, 1, 1, '#6a4848');
            break;
        case TILE:
            ctx.fillStyle = '#c0b8a0'; ctx.fillRect(x, y, ts, ts); fill(0, 7, 16, 1, '#a8a088'); fill(7, 0, 1, 16, '#a8a088');
            fill(1, 1, 6, 6, '#d0c8b0'); fill(9, 9, 6, 6, '#d0c8b0'); fill(6, 1, 1, 6, '#908878'); fill(1, 6, 6, 1, '#908878');
            break;
        case PAPER:
            drawOfficeTile(CARPET, x, y, ts); fill(2, 3, 8, 6, '#e8e0d0'); fill(3, 5, 6, 1, '#d8d0c0'); fill(3, 7, 4, 1, '#d8d0c0');
            fill(9, 4, 1, 5, '#c0b8a8'); fill(3, 8, 7, 1, '#c0b8a8');
            break;
        case DESK:
            drawOfficeTile(DARK, x, y, ts); fill(1, 2, 14, 10, '#6a4e2a'); fill(1, 2, 14, 2, '#7a5e38'); fill(1, 2, 2, 10, '#7a5e38');
            fill(14, 4, 1, 8, '#5a3e1a'); fill(2, 11, 13, 1, '#5a3e1a'); fill(4, 3, 7, 5, '#1a1a1a'); fill(5, 4, 5, 3, '#222'); fill(5, 4, 5, 3, '#2a3a2a');
            break;
        case STAIN:
            drawOfficeTile(CARPET, x, y, ts); fill(3, 4, 8, 6, 'rgba(20,15,10,0.75)'); fill(5, 3, 5, 8, 'rgba(20,15,10,0.75)');
            fill(4, 5, 6, 4, 'rgba(40,25,15,0.5)'); fill(5, 6, 4, 2, 'rgba(60,35,20,0.3)');
            break;
        case CRACK:
            drawOfficeTile(TILE, x, y, ts); fill(4, 3, 1, 1, '#605850'); fill(5, 4, 1, 2, '#605850'); fill(6, 6, 1, 1, '#605850'); fill(7, 7, 1, 2, '#605850'); fill(8, 9, 1, 1, '#605850');
            fill(3, 4, 1, 1, '#807870'); fill(9, 10, 1, 1, '#807870');
            break;
    }
}
const mapImages = {};

function loadMaps() {
    MAPS.forEach((m, i) => {
        if (m.type === 'image') {
            const img = new Image();
            img.src = m.src;
            mapImages[i] = img;
        }
    });
}

function selectRandomMap() {
    currentMapIdx = Math.floor(Math.random() * MAPS.length);
}

let allEnemiesDefeated = false; // tracks if all enemies in wave are dead

// --- Player Leveling ---
let playerLevel = 1;
let playerXP = 0;
const getXPRequired = (lvl) => Math.floor(100 * Math.pow(1.5, lvl - 1));

let playerUpgrades = {
    healthLevel: 0,
    speedLevel: 0
};

// --- Lifetime Stats ---
let stats = {
    totalKills: 0,
    maxRoom: 1,
    totalCoins: 0,
    totalShots: 0
};

// --- Audio System ---
const audioSystem = {
    musicNode: null,
    musicType: null, // "menu", "playing", "dead"

    musicTracks: {
        "menu": new Audio("Sounds/Music/MainMenu.mp3"),
        "playing": new Audio("Sounds/Music/Background music.mp3"),
        "dead": new Audio("Sounds/Music/Lose.mp3")
    },

    sfx: {
        "pistol_shoot": "Sounds/Sound effects/Gunshots/Pistol sound.MP3",
        "ak47_shoot": "Sounds/Sound effects/Gunshots/ak-47 shot.MP3",
        "shotgun_shoot": "Sounds/Sound effects/Gunshots/Shotgun shot sound.MP3",
        "sniper_shoot": "Sounds/Sound effects/Gunshots/Void sniper gunshot.MP3",

        "pistol_reload": "Sounds/Sound effects/Reloading/Pistol reload.MP3",
        "ak47_reload": "Sounds/Sound effects/Reloading/ak-47 reload.MP3",
        "shotgun_reload": "Sounds/Sound effects/Reloading/Shotgun reload.MP3",
        "sniper_reload": "Sounds/Sound effects/Reloading/Void sniper reload.MP3",
        "rpg_shoot": "Sounds/Sound effects/Gunshots/RPG-7 shot.wav",
        "rpg_reload": "Sounds/Sound effects/Reloading/RPG-7 Reload.wav",
        "rpg_explosion": "Sounds/Sound effects/Explosions/RPG-7 Explosion.mp3",
        "power_nova": "Sounds/Sound effects/Explosions/RPG-7 Explosion.mp3", // Reuse for now
        "power_dash": "Sounds/Sound effects/Gunshots/Void sniper gunshot.MP3",
        "power_inferno": "Sounds/Sound effects/Explosions/RPG-7 Explosion.mp3"
    },

    init() {
        this.musicTracks["menu"].loop = true;
        this.musicTracks["playing"].loop = true;
        this.musicTracks["dead"].loop = false;
    },

    updateVolume() {
        const musicVol = settings.music ? ((settings.musicVolume / 100) * 0.5) : 0;
        Object.values(this.musicTracks).forEach(a => a.volume = musicVol);
    },

    playMusic(type) {
        this.updateVolume();
        if (this.musicNode && this.musicType && this.musicType !== type) {
            this.musicNode.pause();
            this.musicNode.currentTime = 0;
        }
        if (this.musicType !== type) {
            this.musicType = type;
            this.musicNode = this.musicTracks[type];
            this.musicNode.currentTime = 0;
            this.musicNode.play().catch(e => console.log('Audio autoplay blocked: ', e));
        } else if (this.musicNode && this.musicNode.paused) {
            this.musicNode.play().catch(e => console.log('Audio autoplay blocked: ', e));
        }
    },

    stopMusic() {
        if (this.musicNode) {
            this.musicNode.pause();
            this.musicNode.currentTime = 0;
            this.musicType = null;
        }
    },

    playSound(weaponId, action) {
        if (!settings.sfx) return;
        const path = this.sfx[`${weaponId}_${action}`];
        if (path) {
            const snd = new Audio(path);
            snd.volume = Math.min(1, (settings.sfxVolume / 100) * 0.8);
            snd.play().catch(e => console.log('Audio blocked', e));
        }
    }
};

audioSystem.init();

// UI Elements
const menuOverlay = document.getElementById('menu-overlay');
const mainMenu = document.getElementById('main-menu');
const shopMenu = document.getElementById('shop-menu');
const settingsMenu = document.getElementById('settings-menu');
const statsMenu = document.getElementById('stats-menu');
const upgradesMenu = document.getElementById('upgrades-menu');
const pauseMenu = document.getElementById('pause-menu');
const deathMenu = document.getElementById('death-menu');
const deathStats = document.getElementById('death-stats');

const btnPlay = document.getElementById('btn-play');
const btnShop = document.getElementById('btn-shop');
const btnStats = document.getElementById('btn-stats');
const btnSettings = document.getElementById('btn-settings');
const btnUpgrades = document.getElementById('btn-upgrades');
const btnSkins = document.getElementById('btn-skins');
const btnSkinsBack = document.getElementById('btn-skins-back');
const skinsMenu = document.getElementById('skins-menu');
const skinsGrid = document.getElementById('skins-grid');
const btnShopBack = document.getElementById('btn-shop-back');
const btnStatsBack = document.getElementById('btn-stats-back');
const btnSettingsBack = document.getElementById('btn-settings-back');
const btnUpgradesBack = document.getElementById('btn-upgrades-back');
const btnPowersBack = document.getElementById('btn-powers-back');
const btnContinue = document.getElementById('btn-continue');
const btnExit = document.getElementById('btn-exit');
const btnDeathRestart = document.getElementById('btn-death-restart');
const btnDeathExit = document.getElementById('btn-death-exit');

const player = {
    x: 5,
    y: 5,
    radius: 0.3,
    color: '#e0e0e0',
    gunLength: 0.5,
    angle: 0,
    hp: 100,
    maxHp: 100,
    baseSpeed: 0.055,
    equippedWeapon: 'pistol',
    skin: 'default',
    ammo: 12,
    maxAmmo: 12,
    reloading: false,
    reloadTimer: 0,
    reloadTime: 90, // frames
    damageFlash: 0,
    invincibleTimer: 0,
    dashActive: 0
};

const bullets = [];
const enemies = [];
const particles = [];
const explosionSmoke = []; //Lingering smoke effects
const bloodSplats = []; // Persistent blood on floor
const coinPickups = []; // Dropped coin objects on the ground
const COIN_PICKUP_RADIUS = 0.6; // Auto-pickup radius in world units
let screenShake = 0;
let muzzleFlash = 0;

// --- Enemy System ---
const ENEMY_TYPES = {
    stalker: {
        hpMult: 1,
        speedMult: 2,
        radius: 0.28,
        color: '340', // HSL hue
        damageMult: 1.4,
        weight: 70,
        minRoom: 0
    },
    wraith: {
        hpMult: 0.5,
        speedMult: 4,
        radius: 0.18,
        color: '200',
        damageMult: 1.0,
        weight: 40,
        minRoom: 3
    },
    hulk: {
        hpMult: 3,
        speedMult: 1,
        radius: 0.45,
        color: '0',
        damageMult: 2.5,
        weight: 25,
        minRoom: 5
    },
    phantom: {
        hpMult: 1,
        speedMult: 4,
        radius: 0.22,
        color: '280',
        damageMult: 1.5,
        weight: 20,
        minRoom: 7
    },
    nightmare: {
        hpMult: 3.5,
        speedMult: 3,
        radius: 0.42,
        color: '0',
        damageMult: 3.0,
        weight: 15,
        minRoom: 8
    },
    colossus: {
        hpMult: 12.0,
        speedMult: 1,
        radius: 0.7,
        color: '140',
        damageMult: 6.0,
        weight: 10,
        minRoom: 10
    }
};

const getXPForType = (type) => {
    const rewards = {
        stalker: 20,
        wraith: 15,
        hulk: 50,
        phantom: 45,
        nightmare: 125,
        colossus: 450
    };
    return rewards[type] || 20;
};

function spawnEnemy() {
    // Spawn from any edge
    let x, y, side;
    const edge = Math.floor(Math.random() * 4);
    const margin = 0.5;

    if (edge === 0) { // North
        x = Math.random() * roomWidth;
        y = -margin;
        side = 'north';
    } else if (edge === 1) { // South
        x = Math.random() * roomWidth;
        y = roomHeight + margin;
        side = 'south';
    } else if (edge === 2) { // West
        x = -margin;
        y = Math.random() * roomHeight;
        side = 'west';
    } else { // East
        x = roomWidth + margin;
        y = Math.random() * roomHeight;
        side = 'east';
    }

    // Pick type based on weights and current room
    let totalWeight = 0;
    const availableTypes = [];
    for (const k in ENEMY_TYPES) {
        if (currentRoom >= (ENEMY_TYPES[k].minRoom || 0)) {
            totalWeight += ENEMY_TYPES[k].weight;
            availableTypes.push(k);
        }
    }

    let r = Math.random() * totalWeight;
    let typeKey = availableTypes[0] || 'stalker';
    for (const k of availableTypes) {
        r -= ENEMY_TYPES[k].weight;
        if (r <= 0) {
            typeKey = k;
            break;
        }
    }

    const type = ENEMY_TYPES[typeKey];
    // Increase speed every 5 rooms, capped at +0.025 improvement
    const roomBonus = Math.min(Math.floor(currentRoom / 5) * 0.004, 0.025);
    const speedBase = (0.014 + roomBonus) * type.speedMult;
    const speed = speedBase + Math.random() * 0.005;

    enemies.push({
        type: typeKey,
        x: x,
        y: y,
        radius: type.radius * (0.9 + Math.random() * 0.2),
        speed: speed,
        hp: Math.max(1, Math.floor((1 + currentRoom / 3) * type.hpMult)),
        maxHp: Math.max(1, Math.floor((1 + currentRoom / 3) * type.hpMult)),
        color: `hsl(${type.color}, 60%, ${20 + Math.random() * 15}%)`,
        eyeOffset: Math.random() * 0.1,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.05 + Math.random() * 0.05,
        damage: (10 + currentRoom * 2) * type.damageMult,
        fromSide: side
    });
}

function spawnWave() {
    enemiesRemainingToSpawn = 3 + currentRoom * 2;
    nextSpawnTimer = 0;
}

// --- Particles ---
function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = (Math.random() * 0.5 + 0.5) * speed;
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 30 + Math.random() * 20,
            maxLife: 30 + Math.random() * 20,
            radius: 0.03 + Math.random() * 0.04,
            color
        });
    }
}

// --- Coin Pickup System ---
function spawnCoinPickups(x, y, totalAmount) {
    // Break total coins into individual pickup objects
    // Each pickup is worth 1-3 coins, scattered around death position

    // --- Wall-aware directional bias ---
    // Measure distance to each edge
    const distLeft = x;
    const distRight = roomWidth - x;
    const distTop = y;
    const distBottom = roomHeight - y;

    // Build a bias vector pointing AWAY from the nearest wall(s)
    let biasX = 0;
    let biasY = 0;

    // Horizontal: push away from the closer side
    if (distLeft < distRight) {
        biasX = 1.0 / Math.max(distLeft, 0.1); // closer = stronger push right
    } else {
        biasX = -1.0 / Math.max(distRight, 0.1); // push left
    }

    // Vertical: push away from the closer side
    if (distTop < distBottom) {
        biasY = 1.0 / Math.max(distTop, 0.1); // push down
    } else {
        biasY = -1.0 / Math.max(distBottom, 0.1); // push up
    }

    // Normalize the bias vector
    const biasMag = Math.sqrt(biasX * biasX + biasY * biasY);
    if (biasMag > 0) {
        biasX /= biasMag;
        biasY /= biasMag;
    }

    // Determine how strongly to bias (stronger when closer to edge)
    const minEdgeDist = Math.min(distLeft, distRight, distTop, distBottom);
    // Bias strength: 0.0 at center (5+ units from edge), ~0.85 at the very edge
    const biasStrength = Math.max(0, 1.0 - minEdgeDist / 5.0) * 0.85;

    let remaining = totalAmount;
    while (remaining > 0) {
        const value = Math.min(remaining, Math.ceil(Math.random() * 3));
        remaining -= value;

        // Random base angle
        const randAngle = Math.random() * Math.PI * 2;
        let dirX = Math.cos(randAngle);
        let dirY = Math.sin(randAngle);

        // Blend random direction with wall-away bias
        dirX = dirX * (1 - biasStrength) + biasX * biasStrength;
        dirY = dirY * (1 - biasStrength) + biasY * biasStrength;

        // Normalize blended direction
        const dirMag = Math.sqrt(dirX * dirX + dirY * dirY);
        if (dirMag > 0) {
            dirX /= dirMag;
            dirY /= dirMag;
        }

        const dist = 0.3 + Math.random() * 0.7; // scatter radius 0.3-1.0
        const speed = 0.02 + Math.random() * 0.03;

        coinPickups.push({
            x: x + dirX * dist,
            y: y + dirY * dist,
            value: value,
            // Physics for bounce animation — biased away from nearest wall
            vx: dirX * speed,
            vy: dirY * speed,
            vz: 0.08 + Math.random() * 0.06, // vertical bounce velocity
            z: 0, // height off ground
            gravity: 0.004,
            bounces: 0,
            maxBounces: 2 + Math.floor(Math.random() * 2),
            settled: false,
            // Visual
            radius: 0.08 + value * 0.02,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.15,
            glow: 1.0, // spawn glow intensity
            bobPhase: Math.random() * Math.PI * 2,
            bobSpeed: 0.03 + Math.random() * 0.02
        });
    }
}

// --- Persistence ---
function saveGame() {
    const data = {
        coins,
        currentRoom,
        equippedWeapon: player.equippedWeapon,
        ownedWeapons: {
            pistol: WEAPONS.pistol.owned,
            ak47: WEAPONS.ak47.owned,
            shotgun: WEAPONS.shotgun.owned,
            sniper: WEAPONS.sniper.owned,
            rpg: WEAPONS.rpg.owned
        },
        weaponUpgrades: {
            pistol: { dmg: WEAPONS.pistol.damageLevel, fr: WEAPONS.pistol.firerateLevel, mag: WEAPONS.pistol.magLevel },
            ak47: { dmg: WEAPONS.ak47.damageLevel, fr: WEAPONS.ak47.firerateLevel, mag: WEAPONS.ak47.magLevel },
            shotgun: { dmg: WEAPONS.shotgun.damageLevel, fr: WEAPONS.shotgun.firerateLevel, mag: WEAPONS.shotgun.magLevel },
            sniper: { dmg: WEAPONS.sniper.damageLevel, fr: WEAPONS.sniper.firerateLevel, mag: WEAPONS.sniper.magLevel },
            rpg: { dmg: WEAPONS.rpg.damageLevel, fr: WEAPONS.rpg.firerateLevel, mag: WEAPONS.rpg.magLevel, rad: WEAPONS.rpg.radiusLevel }
        },
        powers: {
            explosion: POWERS.explosion.owned,
            explosionDmgLvl: POWERS.explosion.damageLevel,
            explosionRadLvl: POWERS.explosion.radiusLevel
        },
        equippedPowers,
        playerUpgrades,
        playerLevel,
        playerXP,
        equippedSkin,
        ownedSkins: Object.keys(SKINS).reduce((acc, k) => { acc[k] = SKINS[k].owned; return acc; }, {}),
        settings,
        stats
    };
    const SAVE_KEY = 'crossfire_zero_hour_save';
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadGame() {
    const OLD_KEY = 'void_save_data';
    const NEW_KEY = 'crossfire_zero_hour_save';

    let saved = localStorage.getItem(NEW_KEY);
    if (!saved) {
        saved = localStorage.getItem(OLD_KEY);
        // Migration if old data exists
        if (saved) {
            localStorage.setItem(NEW_KEY, saved);
        }
    }

    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        coins = data.coins || 0;
        currentRoom = data.currentRoom || 1;
        player.equippedWeapon = data.equippedWeapon || 'pistol';
        if (data.ownedWeapons) {
            WEAPONS.pistol.owned = data.ownedWeapons.pistol ?? true;
            WEAPONS.ak47.owned = data.ownedWeapons.ak47 ?? false;
            WEAPONS.shotgun.owned = data.ownedWeapons.shotgun ?? false;
            WEAPONS.sniper.owned = data.ownedWeapons.sniper ?? false;
            WEAPONS.rpg.owned = data.ownedWeapons.rpg ?? false;
        }
        if (data.settings) {
            settings = { ...settings, ...data.settings };
            updateSettingsUI();
        }
        if (data.stats) {
            stats = { ...stats, ...data.stats };
            updateStatsUI();
        }
        if (data.weaponUpgrades) {
            WEAPONS.pistol.damageLevel = data.weaponUpgrades.pistol?.dmg || 0;
            WEAPONS.pistol.firerateLevel = data.weaponUpgrades.pistol?.fr || 0;
            WEAPONS.pistol.magLevel = data.weaponUpgrades.pistol?.mag || 0;
            WEAPONS.ak47.damageLevel = data.weaponUpgrades.ak47?.dmg || 0;
            WEAPONS.ak47.firerateLevel = data.weaponUpgrades.ak47?.fr || 0;
            WEAPONS.ak47.magLevel = data.weaponUpgrades.ak47?.mag || 0;
            WEAPONS.shotgun.damageLevel = data.weaponUpgrades.shotgun?.dmg || 0;
            WEAPONS.shotgun.firerateLevel = data.weaponUpgrades.shotgun?.fr || 0;
            WEAPONS.shotgun.magLevel = data.weaponUpgrades.shotgun?.mag || 0;
            WEAPONS.sniper.damageLevel = data.weaponUpgrades.sniper?.dmg || 0;
            WEAPONS.sniper.firerateLevel = data.weaponUpgrades.sniper?.fr || 0;
            WEAPONS.sniper.magLevel = data.weaponUpgrades.sniper?.mag || 0;
            WEAPONS.rpg.damageLevel = data.weaponUpgrades.rpg?.dmg || 0;
            WEAPONS.rpg.firerateLevel = data.weaponUpgrades.rpg?.fr || 0;
            WEAPONS.rpg.magLevel = data.weaponUpgrades.rpg?.mag || 0;
            WEAPONS.rpg.radiusLevel = data.weaponUpgrades.rpg?.rad || 0;
        }
        if (data.powers) {
            POWERS.explosion.owned = !!data.powers.explosion;
            POWERS.explosion.damageLevel = data.powers.explosionDmgLvl || 0;
            POWERS.explosion.radiusLevel = data.powers.explosionRadLvl || 0;
        }
        equippedPowers = data.equippedPowers || [null, null, null];

        if (data.playerUpgrades) {
            playerUpgrades = { ...playerUpgrades, ...data.playerUpgrades };
        }
        playerLevel = data.playerLevel || 1;
        playerXP = data.playerXP || 0;

        if (data.equippedSkin) {
            equippedSkin = data.equippedSkin;
            player.skin = equippedSkin;
        }
        if (data.ownedSkins) {
            for (const k in data.ownedSkins) {
                if (SKINS[k]) SKINS[k].owned = data.ownedSkins[k];
            }
        }

        applyUpgrades();
        updateHUD();
        updateShopUI();
        updateSkinsUI();
        updatePowersUI();
    } catch (e) {
        console.error("Failed to load save data", e);
    }
}

function applyUpgrades() {
    for (const key in WEAPONS) {
        const w = WEAPONS[key];
        w.damage = w.baseDamage * (1 + w.damageLevel * 0.2); // 20% increase per level
        w.cooldown = w.baseCooldown * Math.pow(0.85, w.firerateLevel); // 15% reduction per level
        w.ammo = Math.floor(w.baseAmmo * (1 + w.magLevel * 0.25)); // 25% increase per level
        if (w.isRocket) {
            w.explosionRadius = w.baseRadius * (1 + (w.radiusLevel || 0) * 0.15); // 15% increase per level
        }
    }

    player.maxHp = 100 + (playerUpgrades.healthLevel * 20);
    player.speed = player.baseSpeed * (1 + playerUpgrades.speedLevel * 0.1);
}

function updateSettingsUI() {
    const toggleMusic = document.getElementById('toggle-music');
    if (toggleMusic) {
        if (settings.music) toggleMusic.classList.add('active');
        else toggleMusic.classList.remove('active');
    }
    const toggleSFX = document.getElementById('toggle-sfx');
    if (toggleSFX) {
        if (settings.sfx) toggleSFX.classList.add('active');
        else toggleSFX.classList.remove('active');
    }
    const musicVolumeSlider = document.getElementById('music-volume-slider');
    if (musicVolumeSlider) musicVolumeSlider.value = settings.musicVolume;
    const sfxVolumeSlider = document.getElementById('sfx-volume-slider');
    if (sfxVolumeSlider) sfxVolumeSlider.value = settings.sfxVolume;
}

function updateSkinsUI() {
    skinsGrid.innerHTML = '';
    for (const key in SKINS) {
        const skin = SKINS[key];
        const item = document.createElement('div');
        item.className = 'shop-item';

        let previewStyle = '';
        if (skin.type === 'color') previewStyle = `background: ${skin.value}`;
        else if (skin.type === 'gradient') previewStyle = `background: linear-gradient(135deg, ${skin.value[0]}, ${skin.value[1]})`;
        else if (skin.type === 'texture') {
            if (skin.value === 'camo') previewStyle = 'background: #2d4c1e; background-image: radial-gradient(#1b2e12 20%, transparent 20%); background-size: 10px 10px;';
            else if (skin.value === 'blood') previewStyle = 'background: #444; background-image: radial-gradient(#6e0000 30%, transparent 30%); background-size: 8px 8px;';
        }

        item.innerHTML = `
            <div class="item-icon ${skin.type === 'rainbow' ? 'skin-rainbow' : ''}" style="border-radius: 50%; width: 40px; height: 40px; ${previewStyle}; margin: 10px;"></div>
            <div class="item-details">
                <span class="item-name">${skin.name}</span>
                <span class="item-status">${skin.owned ? 'OWNED' : skin.price + ' COINS'}</span>
            </div>
            <button class="equip-btn ${player.skin === key ? 'active' : ''}" data-skin="${key}">
                ${player.skin === key ? 'EQUIPPED' : (skin.owned ? 'EQUIP' : 'BUY')}
            </button>
        `;

        const btn = item.querySelector('button');
        btn.addEventListener('click', () => {
            if (skin.owned) {
                player.skin = key;
                equippedSkin = key;
                updateSkinsUI();
                saveGame();
            } else if (coins >= skin.price) {
                coins -= skin.price;
                skin.owned = true;
                updateHUD();
                updateSkinsUI();
                saveGame();
            }
        });

        skinsGrid.appendChild(item);
    }
}

function updatePowersUI() {
    const inventoryEl = document.getElementById('powers-inventory');
    if (!inventoryEl) return;
    inventoryEl.innerHTML = '';

    // Update Shop/Inventory
    for (const key in POWERS) {
        const p = POWERS[key];
        const item = document.createElement('div');
        item.className = `shop-item clickable ${selectedPowerId === key ? 'selected' : ''}`;
        const isEquipped = equippedPowers.includes(key);

        item.innerHTML = `
            <div class="item-icon">${p.icon}</div>
            <div class="item-details">
                <span class="item-name">${p.name}</span>
                <span class="item-status">${p.owned ? (isEquipped ? 'EQUIPPED' : 'OWNED') : p.price + ' COINS'}</span>
            </div>
            <button class="equip-btn ${p.owned ? '' : (coins < p.price ? 'locked' : '')}" data-power="${key}">
                ${p.owned ? (isEquipped ? 'IN SLOT' : 'EQUIP') : 'BUY'}
            </button>
        `;

        item.onclick = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            selectedPowerId = key;
            showPowerDetails(key);
            updatePowersUI();
        };

        const btn = item.querySelector('button');
        btn.addEventListener('click', () => {
            if (p.owned) {
                const unlocked = (selectedSlotIndex === 0 && playerLevel >= 3) ||
                    (selectedSlotIndex === 1 && playerLevel >= 5) ||
                    (selectedSlotIndex === 2 && playerLevel >= 10);

                if (unlocked) {
                    const oldIdx = equippedPowers.indexOf(key);
                    if (oldIdx !== -1) equippedPowers[oldIdx] = null;
                    equippedPowers[selectedSlotIndex] = key;
                    updatePowersUI();
                    saveGame();
                }
            } else if (coins >= p.price) {
                coins -= p.price;
                p.owned = true;
                updateHUD();
                updatePowersUI();
                showPowerDetails(key);
                saveGame();
            }
        });

        inventoryEl.appendChild(item);
    }

    // Update Slots
    const slotEls = document.querySelectorAll('.power-assignment-slot');
    slotEls.forEach((el, idx) => {
        const unlockLvl = idx === 0 ? 3 : (idx === 1 ? 5 : 10);
        const isUnlocked = playerLevel >= unlockLvl;
        const powerId = equippedPowers[idx];
        const power = powerId ? POWERS[powerId] : null;

        el.className = `power-assignment-slot ${isUnlocked ? 'unlocked' : ''} ${selectedSlotIndex === idx ? 'selected' : ''}`;
        el.querySelector('.slot-icon').textContent = power ? power.icon : (isUnlocked ? '-' : '🔒');
        el.querySelector('.slot-label').textContent = isUnlocked ? (power ? power.name : 'EMPTY') : `LVL ${unlockLvl}`;

        if (isUnlocked && selectedSlotIndex !== idx) {
            el.onclick = () => {
                selectedSlotIndex = idx;
                updatePowersUI();
            };
        } else {
            el.onclick = null;
        }
    });

    if (selectedPowerId) showPowerDetails(selectedPowerId);
}

function showPowerDetails(id) {
    const p = POWERS[id];
    const overlay = document.getElementById('power-modal-overlay');
    const upgradesSection = document.getElementById('popup-pd-upgrades-section');

    document.getElementById('popup-pd-icon').textContent = p.icon;
    document.getElementById('popup-pd-name').textContent = p.name;
    document.getElementById('popup-pd-desc').textContent = p.desc;

    if (p.owned) {
        upgradesSection.style.display = 'flex';
        const dmgMult = (p.baseDamageMult + p.damageLevel * 0.5).toFixed(1);
        const radius = (p.baseRadius * (1 + p.radiusLevel * 0.1)).toFixed(1);

        document.getElementById('popup-pd-stat-dmg').textContent = dmgMult;
        document.getElementById('popup-pd-stat-rad').textContent = radius;

        const upgDmgBtn = document.getElementById('btn-upg-power-dmg');
        const upgRadBtn = document.getElementById('btn-upg-power-rad');

        const dmgCost = 1000 + p.damageLevel * 1000;
        const radCost = 1000 + p.radiusLevel * 1000;

        upgDmgBtn.textContent = p.damageLevel >= 5 ? 'MAX' : `LVL ${p.damageLevel + 1} (${dmgCost} ⟡)`;
        upgRadBtn.textContent = p.radiusLevel >= 5 ? 'MAX' : `LVL ${p.radiusLevel + 1} (${radCost} ⟡)`;

        upgDmgBtn.disabled = p.damageLevel >= 5 || coins < dmgCost;
        upgRadBtn.disabled = p.radiusLevel >= 5 || coins < radCost;
    } else {
        upgradesSection.style.display = 'none';
    }

    overlay.classList.add('active');
}

function updateShopUI() {
    document.querySelectorAll('.equip-btn').forEach(btn => {
        const weaponId = btn.getAttribute('data-weapon');
        if (!weaponId) return;
        const weapon = WEAPONS[weaponId];
        const statusEl = btn.closest('.shop-item').querySelector('.item-status');

        if (weapon.owned) {
            statusEl.textContent = 'OWNED';
            if (player.equippedWeapon === weaponId) {
                btn.textContent = 'EQUIPPED';
                btn.classList.add('active');
            } else {
                btn.textContent = 'EQUIP';
                btn.classList.remove('active');
            }
        } else {
            statusEl.textContent = `${weapon.price} COINS`;
            btn.textContent = 'BUY';
            btn.classList.remove('active');
        }
    });
}

function drawWeaponIcons() {
    ['pistol', 'ak47', 'shotgun', 'sniper', 'rpg'].forEach(weaponId => {
        const iconCanvas = document.getElementById(`icon-${weaponId}`);
        if (!iconCanvas) return;
        const ictx = iconCanvas.getContext('2d');
        const cx = iconCanvas.width / 2;
        const cy = iconCanvas.height / 2;
        const weapon = WEAPONS[weaponId];
        const iconScale = 50;

        ictx.clearRect(0, 0, iconCanvas.width, iconCanvas.height);
        ictx.save();
        ictx.translate(cx, cy);
        ictx.rotate(-Math.PI / 6);

        ictx.fillStyle = weapon.gunColor;
        const gLength = weapon.length * iconScale;
        const gWidth = weapon.width * iconScale;

        ictx.translate(-gLength / 2, 0);

        ictx.fillRect(0, -gWidth / 2, gLength, gWidth);

        ictx.fillStyle = '#222';
        ictx.fillRect(gLength * 0.7, -gWidth / 2 - 1, gLength * 0.3, 2);

        if (weaponId === 'ak47') {
            ictx.fillStyle = '#3a2a1a';
            ictx.fillRect(0, gWidth / 2, gLength * 0.4, gWidth * 0.5);
            ictx.fillStyle = '#444';
            ictx.fillRect(gLength * 0.3, -gWidth / 2 - 3, gLength * 0.2, 3);
        } else if (weaponId === 'shotgun') {
            ictx.fillStyle = '#3a2a1a';
            ictx.fillRect(0, gWidth / 2, gLength * 0.5, gWidth * 0.5);
            ictx.fillStyle = '#222';
            ictx.fillRect(gLength * 0.2, -gWidth / 2 - 1, gLength * 0.8, gWidth / 2);
            ictx.fillRect(gLength * 0.2, 1, gLength * 0.8, gWidth / 2);
        } else if (weaponId === 'sniper') {
            // Long thin barrel highlight
            ictx.fillStyle = '#0d0d1a';
            ictx.fillRect(0, gWidth / 2, gLength * 0.35, gWidth * 0.6); // stock
            ictx.fillStyle = '#6600cc';
            ictx.fillRect(gLength * 0.5, -gWidth / 2 - 2, gLength * 0.15, 2); // scope
            ictx.fillStyle = '#444466';
            ictx.fillRect(gLength * 0.9, -gWidth / 4, gLength * 0.1, gWidth / 2); // muzzle
        } else if (weaponId === 'rpg') {
            ictx.fillStyle = '#4a5d23';
            ictx.fillRect(0, -gWidth / 2, gLength, gWidth);
            ictx.fillStyle = '#2d3a16';
            ictx.fillRect(gLength * 0.4, -gWidth / 2 - 2, gLength * 0.2, gWidth + 4); // grip/middle
            ictx.fillStyle = '#777';
            ictx.fillRect(gLength * 0.9, -gWidth / 2 - 3, gLength * 0.1, gWidth + 6); // end
            ictx.fillStyle = '#222';
            ictx.beginPath();
            ictx.moveTo(0, 0);
            ictx.lineTo(-gLength * 0.15, -gWidth);
            ictx.lineTo(-gLength * 0.15, gWidth);
            ictx.fill();
        } else {
            ictx.fillRect(0, gWidth / 2, gLength * 0.3, gWidth * 0.8);
        }

        ictx.restore();
    });
}

// --- Init ---
function init() {
    loadMaps();
    loadGame();
    // Fail-safe health check every 0.2 seconds
    setInterval(() => {
        if (player.hp < 0) player.hp = 0;
        if (player.hp > player.maxHp) player.hp = player.maxHp;
        if (player.hp <= 0 && gameState === 'playing') {
            triggerDeath();
        }
    }, 200);
    drawWeaponIcons();
    window.addEventListener('resize', resize);
    window.addEventListener('click', () => {
        if (gameState === 'menu') audioSystem.playMusic('menu');
    }, { once: true });
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    window.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        shoot();
    });
    window.addEventListener('mouseup', () => {
        isMouseDown = false;
    });

    window.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }
        // Reload
        if (e.key.toLowerCase() === 'r' && !player.reloading && player.ammo < player.maxAmmo && gameState === 'playing') {
            player.reloading = true;
            const weapon = WEAPONS[player.equippedWeapon];
            player.reloadTimer = weapon.reloadTime || 90;
            audioSystem.playSound(player.equippedWeapon, 'reload');
        }
        // Restart
        if (e.key.toLowerCase() === 'enter' && gameState === 'dead') {
            restartGame();
        }
        // Pause
        if (e.key === 'Escape') {
            if (gameState === 'playing') {
                gameState = 'paused';
                menuOverlay.classList.add('active');
                mainMenu.classList.remove('active');
                shopMenu.classList.remove('active');
                settingsMenu.classList.remove('active');
                upgradesMenu.classList.remove('active');
                powersMenu.classList.remove('active');
                pauseMenu.classList.add('active');
            } else if (gameState === 'paused') {
                resumeGame();
            }
        }
        // Powers
        if (e.key.toLowerCase() === 'q') usePower(0);
        if (e.key.toLowerCase() === 'e') usePower(1);
        if (e.key.toLowerCase() === 'f') usePower(2);
    });
    window.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });

    // Menu Button Listeners
    btnPlay.addEventListener('click', () => {
        restartGame();
        menuOverlay.classList.remove('active');
    });

    btnShop.addEventListener('click', () => {
        mainMenu.classList.remove('active');
        shopMenu.classList.add('active');
    });

    btnUpgrades.addEventListener('click', () => {
        updateUpgradesUI();
        mainMenu.classList.remove('active');
        upgradesMenu.classList.add('active');
    });

    btnSettings.addEventListener('click', () => {
        mainMenu.classList.remove('active');
        settingsMenu.classList.add('active');
    });

    btnShopBack.addEventListener('click', () => {
        shopMenu.classList.remove('active');
        mainMenu.classList.add('active');
    });

    btnUpgradesBack.addEventListener('click', () => {
        upgradesMenu.classList.remove('active');
        mainMenu.classList.add('active');
        saveGame();
    });

    btnStats.addEventListener('click', () => {
        updateStatsUI();
        mainMenu.classList.remove('active');
        statsMenu.classList.add('active');
    });

    btnStatsBack.addEventListener('click', () => {
        statsMenu.classList.remove('active');
        mainMenu.classList.add('active');
    });

    btnSettingsBack.addEventListener('click', () => {
        settingsMenu.classList.remove('active');
        mainMenu.classList.add('active');
        saveGame();
    });

    btnSkins.addEventListener('click', () => {
        updateSkinsUI();
        mainMenu.classList.remove('active');
        skinsMenu.classList.add('active');
    });

    btnSkinsBack.addEventListener('click', () => {
        skinsMenu.classList.remove('active');
        mainMenu.classList.add('active');
        saveGame();
    });

    const btnPowers = document.getElementById('btn-powers');
    const powersMenu = document.getElementById('powers-menu');

    btnPowers.addEventListener('click', () => {
        updatePowersUI();
        mainMenu.classList.remove('active');
        powersMenu.classList.add('active');
    });

    btnPowersBack.addEventListener('click', () => {
        powersMenu.classList.remove('active');
        mainMenu.classList.add('active');
        saveGame();
    });

    // Sub-UI elements logic handled in updatePowersUI
    const btnUpgPowerDmg = document.getElementById('btn-upg-power-dmg');
    const btnUpgPowerRad = document.getElementById('btn-upg-power-rad');
    const upgMsg = document.getElementById('popup-pd-upg-msg');

    btnUpgPowerDmg.onclick = () => {
        if (!selectedPowerId) return;
        const p = POWERS[selectedPowerId];
        const cost = 1000 + p.damageLevel * 1000;
        if (p.damageLevel < 5 && coins >= cost) {
            coins -= cost;
            p.damageLevel++;
            updateHUD();
            showPowerDetails(selectedPowerId);
            saveGame();
            upgMsg.textContent = "DAMAGE UPGRADED!";
            setTimeout(() => upgMsg.textContent = "", 2000);
        }
    };

    btnUpgPowerRad.onclick = () => {
        if (!selectedPowerId) return;
        const p = POWERS[selectedPowerId];
        const cost = 1000 + p.radiusLevel * 1000;
        if (p.radiusLevel < 5 && coins >= cost) {
            coins -= cost;
            p.radiusLevel++;
            updateHUD();
            showPowerDetails(selectedPowerId);
            saveGame();
            upgMsg.textContent = "RADIUS UPGRADED!";
            setTimeout(() => upgMsg.textContent = "", 2000);
        }
    };


    const btnResetData = document.getElementById('btn-reset-data');
    if (btnResetData) {
        btnResetData.addEventListener('click', () => {
            if (confirm("ARE YOU SURE? This will wipe all progress, coins, and unlocks forever.")) {
                localStorage.removeItem('void_save_data');
                // Hard reset variables
                coins = 0;
                currentRoom = 1;
                WEAPONS.ak47.owned = false;
                WEAPONS.shotgun.owned = false;
                WEAPONS.sniper.owned = false;
                WEAPONS.pistol.owned = true;
                WEAPONS.pistol.damageLevel = 0;
                WEAPONS.pistol.firerateLevel = 0;
                WEAPONS.ak47.damageLevel = 0;
                WEAPONS.ak47.firerateLevel = 0;
                WEAPONS.shotgun.damageLevel = 0;
                WEAPONS.shotgun.firerateLevel = 0;
                WEAPONS.sniper.damageLevel = 0;
                WEAPONS.sniper.firerateLevel = 0;
                WEAPONS.sniper.magLevel = 0;
                WEAPONS.pistol.magLevel = 0;
                WEAPONS.ak47.magLevel = 0;
                WEAPONS.shotgun.magLevel = 0;
                WEAPONS.rpg.owned = false;
                WEAPONS.rpg.damageLevel = 0;
                WEAPONS.rpg.firerateLevel = 0;
                WEAPONS.rpg.magLevel = 0;

                equippedPowers = [null, null, null];
                for (const k in POWERS) POWERS[k].owned = false;

                WEAPONS.sniper.firerateLevel = 0;

                equippedSkin = 'default';
                player.skin = 'default';
                for (const k in SKINS) {
                    SKINS[k].owned = (k === 'default');
                }

                playerLevel = 1;
                playerXP = 0;
                playerUpgrades = { healthLevel: 0, speedLevel: 0 };

                applyUpgrades();

                player.equippedWeapon = 'pistol';
                const weapon = WEAPONS['pistol'];
                player.maxAmmo = weapon.ammo;
                player.ammo = weapon.ammo;
                settings.music = false;
                settings.sfx = true;
                settings.musicVolume = 80;
                settings.sfxVolume = 80;
                stats = { totalKills: 0, maxRoom: 1, totalCoins: 0, totalShots: 0 };

                resetWorld();
                updateSettingsUI();
                updateStatsUI();
                updateShopUI();
                updateHUD();

                // Return to main menu
                gameState = 'menu';
                audioSystem.playMusic('menu');
                pauseMenu.classList.remove('active');
                statsMenu.classList.remove('active');
                settingsMenu.classList.remove('active');
                mainMenu.classList.add('active');
                saveGame();
            }
        });
    }

    btnContinue.addEventListener('click', resumeGame);

    const btnModalClose = document.getElementById('btn-modal-close');
    const modalOverlay = document.getElementById('power-modal-overlay');
    if (btnModalClose) {
        btnModalClose.onclick = () => {
            modalOverlay.classList.remove('active');
            selectedPowerId = null;
            updatePowersUI();
        };
    }

    window.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
            selectedPowerId = null;
            updatePowersUI();
        }
    });

    btnExit.addEventListener('click', () => {
        resetWorld();
        gameState = 'menu';
        audioSystem.playMusic('menu');
        pauseMenu.classList.remove('active');
        mainMenu.classList.add('active');
        saveGame();
    });

    btnDeathRestart.addEventListener('click', () => {
        deathMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        restartGame();
    });

    btnDeathExit.addEventListener('click', () => {
        resetWorld();
        gameState = 'menu';
        audioSystem.playMusic('menu');
        deathMenu.classList.remove('active');
        mainMenu.classList.add('active');
        saveGame();
    });

    // Shop Button Listeners (Equip/Buy)
    document.querySelectorAll('.equip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const weaponId = btn.getAttribute('data-weapon');
            const weapon = WEAPONS[weaponId];

            if (weapon.owned) {
                // Equip
                player.equippedWeapon = weaponId;
                player.maxAmmo = weapon.ammo;
                player.ammo = weapon.ammo; // Optional: refill on equip?
                player.reloading = false;

                // Update UI
                document.querySelectorAll('.equip-btn').forEach(b => {
                    if (b.getAttribute('data-weapon') === weaponId) {
                        b.textContent = 'EQUIPPED';
                        b.classList.add('active');
                    } else if (WEAPONS[b.getAttribute('data-weapon')].owned) {
                        b.textContent = 'EQUIP';
                        b.classList.remove('active');
                    }
                });
            } else if (coins >= weapon.price) {
                // Buy
                coins -= weapon.price;
                weapon.owned = true;
                btn.textContent = 'EQUIP';
                btn.closest('.shop-item').querySelector('.item-status').textContent = 'OWNED';
                updateHUD();
                stats.totalCoins += Math.floor(weapon.price); // track spending or earning? lets track earning below
                saveGame();
            }
        });
    });

    const btnUpgDmg = document.getElementById('btn-upg-dmg');
    const btnUpgFr = document.getElementById('btn-upg-fr');

    if (btnUpgDmg) {
        btnUpgDmg.addEventListener('click', () => {
            handleUpgrade('dmg');
        });
    }

    if (btnUpgFr) {
        btnUpgFr.addEventListener('click', () => {
            handleUpgrade('fr');
        });
    }

    const btnUpgMag = document.getElementById('btn-upg-mag');
    if (btnUpgMag) {
        btnUpgMag.addEventListener('click', () => {
            handleUpgrade('mag');
        });
    }

    const btnUpgRad = document.getElementById('btn-upg-rad');
    if (btnUpgRad) {
        btnUpgRad.addEventListener('click', () => {
            handleUpgrade('rad');
        });
    }

    const btnUpgHp = document.getElementById('btn-upg-hp');
    if (btnUpgHp) {
        btnUpgHp.addEventListener('click', () => {
            handleUpgrade('hp');
        });
    }

    const btnUpgSpd = document.getElementById('btn-upg-spd');
    if (btnUpgSpd) {
        btnUpgSpd.addEventListener('click', () => {
            handleUpgrade('spd');
        });
    }

    const musicSlider = document.getElementById('music-volume-slider');
    if (musicSlider) {
        musicSlider.addEventListener('input', (e) => {
            settings.musicVolume = parseInt(e.target.value);
            audioSystem.updateVolume();
            saveGame();
        });
    }

    const sfxSlider = document.getElementById('sfx-volume-slider');
    if (sfxSlider) {
        sfxSlider.addEventListener('input', (e) => {
            settings.sfxVolume = parseInt(e.target.value);
            saveGame();
        });
    }

    // Setting Toggles (Functional)
    const toggleMusic = document.getElementById('toggle-music');
    if (toggleMusic) {
        toggleMusic.addEventListener('click', () => {
            toggleMusic.classList.toggle('active');
            settings.music = toggleMusic.classList.contains('active');
            audioSystem.updateVolume();
            saveGame();
        });
    }

    const toggleSFX = document.getElementById('toggle-sfx');
    if (toggleSFX) {
        toggleSFX.addEventListener('click', () => {
            toggleSFX.classList.toggle('active');
            settings.sfx = toggleSFX.classList.contains('active');
            saveGame();
        });
    }

    resize();
    animate();
}

function updateUpgradesUI() {
    const weapon = WEAPONS[player.equippedWeapon];
    document.getElementById('upgrade-weapon-name').textContent = weapon.name;
    document.getElementById('dmg-lvl').textContent = weapon.damageLevel;
    document.getElementById('fr-lvl').textContent = weapon.firerateLevel;
    document.getElementById('mag-lvl').textContent = weapon.magLevel;

    const dmgCost = 100 * Math.pow(2, weapon.damageLevel);
    const frCost = 100 * Math.pow(2, weapon.firerateLevel);
    const magCost = 150 * Math.pow(2, weapon.magLevel);

    const btnDmg = document.getElementById('btn-upg-dmg');
    if (weapon.damageLevel >= 5) {
        btnDmg.textContent = 'MAX';
        btnDmg.classList.remove('active');
    } else {
        btnDmg.textContent = `UPGRADE (${dmgCost} C)`;
        btnDmg.classList.toggle('active', coins >= dmgCost);
    }

    const btnFr = document.getElementById('btn-upg-fr');
    if (weapon.firerateLevel >= 5) {
        btnFr.textContent = 'MAX';
        btnFr.classList.remove('active');
    } else {
        btnFr.textContent = `UPGRADE (${frCost} C)`;
        btnFr.classList.toggle('active', coins >= frCost);
    }

    const btnMag = document.getElementById('btn-upg-mag');
    if (weapon.magLevel >= 5) {
        btnMag.textContent = 'MAX';
        btnMag.classList.remove('active');
    } else {
        btnMag.textContent = `UPGRADE (${magCost} C)`;
        btnMag.classList.toggle('active', coins >= magCost);
    }

    // Radius upgrade (RPG Only)
    const rowRad = document.getElementById('row-upg-rad');
    if (weapon.isRocket) {
        rowRad.style.display = 'flex';
        document.getElementById('rad-lvl').textContent = weapon.radiusLevel || 0;
        const radCost = 200 * Math.pow(2, weapon.radiusLevel || 0);
        const btnRad = document.getElementById('btn-upg-rad');
        if ((weapon.radiusLevel || 0) >= 5) {
            btnRad.textContent = 'MAX';
            btnRad.classList.remove('active');
        } else {
            btnRad.textContent = `UPGRADE (${radCost} C)`;
            btnRad.classList.toggle('active', coins >= radCost);
        }
    } else {
        rowRad.style.display = 'none';
    }

    // Player Upgrades
    document.getElementById('hp-lvl').textContent = playerUpgrades.healthLevel;
    document.getElementById('spd-lvl').textContent = playerUpgrades.speedLevel;

    const hpCost = 500 * Math.pow(2, playerUpgrades.healthLevel);
    const spdCost = 500 * Math.pow(2, playerUpgrades.speedLevel);

    const btnHp = document.getElementById('btn-upg-hp');
    if (playerUpgrades.healthLevel >= 5) {
        btnHp.textContent = 'MAX';
        btnHp.classList.remove('active');
    } else {
        btnHp.textContent = `UPGRADE (${hpCost} C)`;
        btnHp.classList.toggle('active', coins >= hpCost);
    }

    const btnSpd = document.getElementById('btn-upg-spd');
    if (playerUpgrades.speedLevel >= 5) {
        btnSpd.textContent = 'MAX';
        btnSpd.classList.remove('active');
    } else {
        btnSpd.textContent = `UPGRADE (${spdCost} C)`;
        btnSpd.classList.toggle('active', coins >= spdCost);
    }
}

function handleUpgrade(type) {
    const weapon = WEAPONS[player.equippedWeapon];
    const upgMsg = document.getElementById('upg-msg');

    let currentLevel, cost;
    if (type === 'dmg') {
        currentLevel = weapon.damageLevel;
        cost = 100 * Math.pow(2, currentLevel);
    } else if (type === 'fr') {
        currentLevel = weapon.firerateLevel;
        cost = 100 * Math.pow(2, currentLevel);
    } else if (type === 'mag') {
        currentLevel = weapon.magLevel;
        cost = 150 * Math.pow(2, currentLevel);
    } else if (type === 'rad') {
        currentLevel = weapon.radiusLevel || 0;
        cost = 200 * Math.pow(2, currentLevel);
    } else if (type === 'hp') {
        currentLevel = playerUpgrades.healthLevel;
        cost = 500 * Math.pow(2, currentLevel);
    } else if (type === 'spd') {
        currentLevel = playerUpgrades.speedLevel;
        cost = 500 * Math.pow(2, currentLevel);
    }

    if (currentLevel >= 5) return;

    if (coins >= cost) {
        coins -= cost;
        if (type === 'dmg') weapon.damageLevel++;
        else if (type === 'fr') weapon.firerateLevel++;
        else if (type === 'mag') weapon.magLevel++;
        else if (type === 'rad') weapon.radiusLevel = (weapon.radiusLevel || 0) + 1;
        else if (type === 'hp') playerUpgrades.healthLevel++;
        else if (type === 'spd') playerUpgrades.speedLevel++;

        applyUpgrades();
        updateUpgradesUI();
        updateHUD();
        saveGame();

        upgMsg.textContent = "Upgrade successful!";
        upgMsg.style.color = "#44cc44";
        setTimeout(() => upgMsg.textContent = "", 2000);
    } else {
        upgMsg.textContent = "Not enough coins!";
        upgMsg.style.color = "#ff3333";
        setTimeout(() => upgMsg.textContent = "", 2000);
    }
}

function usePower(slotIndex) {
    const powerId = equippedPowers[slotIndex];
    if (!powerId || gameState !== 'playing') return;

    const p = POWERS[powerId];
    if (!p) return;
    const now = Date.now();
    if (now - p.lastUsed < p.cooldown) return;

    p.lastUsed = now;

    if (powerId === 'explosion') {
        audioSystem.playSound('rpg', 'explosion');
        screenShake = 15;
        const weapon = WEAPONS[player.equippedWeapon];
        const currentDamage = weapon.damage;
        const dmgMult = p.baseDamageMult + p.damageLevel * 0.5;
        const totalDamage = currentDamage * dmgMult;
        const radius = p.baseRadius * (1 + p.radiusLevel * 0.1);

        spawnParticles(player.x, player.y, '#ff6600', 60, 0.25);
        spawnParticles(player.x, player.y, '#ffff00', 30, 0.15);

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const dist = Math.sqrt((e.x - player.x) ** 2 + (e.y - player.y) ** 2);
            if (dist < radius) {
                e.hp -= totalDamage;
                spawnParticles(e.x, e.y, '#ff0000', 8, 0.08);
                if (e.hp <= 0) {
                    gainXP(getXPForType(e.type));
                    const reward = Math.floor(e.maxHp * 15);
                    spawnCoinPickups(e.x, e.y, reward);
                    stats.totalCoins += reward;
                    enemies.splice(i, 1);
                    killCount++;
                    stats.totalKills++;
                }
            }
        }
    }

    updateHUD();
}

function gainXP(amount) {
    playerXP += amount;
    while (playerXP >= getXPRequired(playerLevel)) {
        playerXP -= getXPRequired(playerLevel);
        playerLevel++;
        // Level up effect
        spawnParticles(player.x, player.y, '#fff', 30, 0.1);
    }
    updateHUD();
}

function resumeGame() {
    gameState = 'playing';
    menuOverlay.classList.remove('active');
    pauseMenu.classList.remove('active');
}

function restartGame() {
    currentRoom = 1;
    selectRandomMap();
    resetWorld();
    gameState = 'playing';
    audioSystem.playMusic('playing');
    spawnWave();
    saveGame();
}

function resetWorld() {
    player.x = roomWidth / 2;
    player.y = roomHeight / 2;

    player.hp = player.maxHp;
    const weapon = WEAPONS[player.equippedWeapon];
    player.maxAmmo = weapon.ammo;
    player.ammo = weapon.ammo;
    player.reloading = false;
    player.reloadTimer = 0;

    player.damageFlash = 0;
    player.invincibleTimer = 0;
    killCount = 0;
    bullets.length = 0;
    enemies.length = 0;
    particles.length = 0;
    explosionSmoke.length = 0;
    bloodSplats.length = 0;
    coinPickups.length = 0;
    screenShake = 0;
    roomClearTimer = 0;
    enemiesRemainingToSpawn = 0;
    gracePeriodActive = false;
    gracePeriodTimer = 0;
    gracePeriodMaxTimer = 0;
    allEnemiesDefeated = false;
    updateHUD();
}

function nextRoom() {
    currentRoom++;
    if (currentRoom > stats.maxRoom) stats.maxRoom = currentRoom;
    selectRandomMap();
    resetWorld(); // Clear old enemies/bullets and refill
    gameState = 'playing';
    spawnWave();
    saveGame();
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const minDim = Math.min(canvas.width, canvas.height);
    scale = minDim / ROOM_SIZE_BASE;

    roomWidth = canvas.width / scale;
    roomHeight = canvas.height / scale;

    offset.x = 0;
    offset.y = 0;
}

function shoot() {
    if (gameState !== 'playing') return;
    if (player.reloading) return;

    const weapon = WEAPONS[player.equippedWeapon];
    const now = Date.now();

    if (now - lastShootTime < weapon.cooldown) return;

    if (player.ammo <= 0) {
        // Auto-reload
        player.reloading = true;
        player.reloadTimer = weapon.reloadTime || 90;
        audioSystem.playSound(player.equippedWeapon, 'reload');
        return;
    }

    lastShootTime = now;
    player.ammo--;
    stats.totalShots++;
    audioSystem.playSound(player.equippedWeapon, 'shoot');

    const pelletCount = weapon.spread || 1;
    for (let i = 0; i < pelletCount; i++) {
        let spreadAngle = 0;
        if (pelletCount > 1) {
            // Wider spread (splash)
            spreadAngle = (Math.random() - 0.5) * 0.7;
        }

        const angle = player.angle + spreadAngle;
        const gunTipX = player.x + Math.cos(angle) * weapon.length;
        const gunTipY = player.y + Math.sin(angle) * weapon.length;

        const bSpeed = weapon.bulletSpeed || (0.22 + Math.random() * 0.05);
        bullets.push({
            x: gunTipX,
            y: gunTipY,
            vx: Math.cos(angle) * bSpeed,
            vy: Math.sin(angle) * bSpeed,
            radius: weapon.bulletSpeed ? 0.04 : 0.05, // sniper bullets are slightly thinner
            damage: weapon.damage,
            pierce: weapon.pierce || 0,
            isSniper: !!weapon.bulletSpeed,
            isRocket: weapon.isRocket || false,
            explosionRadius: weapon.explosionRadius || 0,
            bloodMult: weapon.isRocket ? 2.2 : (weapon.bulletSpeed ? 1.8 : (weapon.spread ? 1.5 : 1.0))
        });
    }

    muzzleFlash = weapon.bulletSpeed ? 6 : 4;
    screenShake = weapon.name === 'Shotgun' ? 6 : (weapon.name === 'Void Sniper' ? 9 : (weapon.isRocket ? 5 : (weapon.auto ? 2 : 3)));

    // Red flash
    const flash = document.getElementById('vignette');
    flash.style.backgroundColor = 'rgba(255, 200, 50, 0.08)';
    setTimeout(() => flash.style.backgroundColor = 'transparent', 40);

    updateHUD();
}

// --- HUD & UI Updates ---
function updateStatsUI() {
    document.getElementById('stat-total-kills').textContent = stats.totalKills;
    document.getElementById('stat-max-room').textContent = stats.maxRoom;
    document.getElementById('stat-total-coins').textContent = stats.totalCoins;
    document.getElementById('stat-total-shots').textContent = stats.totalShots;
}

function updatePowerHUD() {
    const powerKeys = ['Q', 'E', 'F'];
    equippedPowers.forEach((id, idx) => {
        const el = document.getElementById(`hud-slot-${idx}`);
        if (!el) return;
        const p = id ? POWERS[id] : null;
        const unlockLvl = idx === 0 ? 3 : (idx === 1 ? 5 : 10);
        const keyLabel = `<span style="font-size:0.55rem; opacity:0.5; margin-bottom:-2px;">${powerKeys[idx]}</span>`;

        if (playerLevel < unlockLvl) {
            el.innerHTML = `${keyLabel}🔒`;
            el.className = 'hud-power-slot';
        } else if (!p) {
            el.innerHTML = `${keyLabel}-`;
            el.className = 'hud-power-slot';
        } else {
            const now = Date.now();
            const cdRemaining = Math.max(0, p.cooldown - (now - p.lastUsed));
            if (cdRemaining > 0) {
                el.innerHTML = `${keyLabel}<span style="font-size:0.6rem;">${p.icon} ${(cdRemaining / 1000).toFixed(1)}s</span>`;
                el.className = 'hud-power-slot cooldown';
            } else {
                el.innerHTML = `${keyLabel}${p.icon}`;
                el.className = 'hud-power-slot ready';
            }
        }
    });
}

function updateHUD() {
    const roomInfo = document.getElementById('room-info');
    const hint = document.getElementById('hint');
    const coinCount = document.getElementById('coin-count');

    const xpFill = document.getElementById('xp-bar-fill');
    const lvlText = document.getElementById('player-level');
    const xpPercent = (playerXP / getXPRequired(playerLevel)) * 100;
    xpFill.style.width = `${xpPercent}%`;
    lvlText.textContent = `LVL ${playerLevel}`;

    coinCount.textContent = coins;
    roomInfo.textContent = `ROOM ${String(currentRoom).padStart(2, '0')} [10x10]  |  KILLS: ${killCount}`;

    if (player.reloading) {
        hint.textContent = 'RELOADING...';
        hint.style.color = 'rgba(255, 200, 50, 0.8)';
    } else if (player.ammo <= Math.floor(player.maxAmmo * 0.25) && player.ammo > 0) {
        hint.textContent = `LOW AMMO [${player.ammo}/${player.maxAmmo}]  —  R to reload`;
        hint.style.color = 'rgba(255, 100, 100, 0.8)';
    } else if (player.ammo === 0) {
        hint.textContent = 'NO AMMO — R to reload';
        hint.style.color = 'rgba(255, 50, 50, 1)';
    } else {
        updatePowerHUD();
        const menuCoinCount = document.getElementById('menu-coin-count');
        if (menuCoinCount) menuCoinCount.textContent = coins;

        const displayHp = Math.max(0, Math.ceil(player.hp));
        hint.textContent = `AMMO: ${player.ammo}/${player.maxAmmo} | HP: ${displayHp}`;
        hint.style.color = 'rgba(255, 255, 255, 0.5)';
    }
}

function triggerDeath() {
    if (gameState !== 'playing') return;
    player.hp = 0;
    gameState = 'dead';
    audioSystem.playMusic('dead');
    screenShake = 15;

    // Show Death Menu
    menuOverlay.classList.add('active');
    mainMenu.classList.remove('active');
    shopMenu.classList.remove('active');
    settingsMenu.classList.remove('active');
    pauseMenu.classList.remove('active');
    deathMenu.classList.add('active');
    deathStats.textContent = `SURVIVED ${currentRoom} ROOMS  •  ${killCount} KILLS  •  EARNED ${coins} COINS`;
    updateHUD();
}

// --- Update ---
function update() {
    if (gameState === 'dead' || gameState === 'menu' || gameState === 'paused') return;

    // Spawning logic
    if (enemiesRemainingToSpawn > 0) {
        nextSpawnTimer--;
        if (nextSpawnTimer <= 0) {
            spawnEnemy();
            enemiesRemainingToSpawn--;
            const msDelay = 800 - Math.min(currentRoom * 50, 500);
            nextSpawnTimer = msDelay / 16;
        }
    }

    updatePowerHUD();

    // Grace period logic (Vampire Survivors-style coin collection)
    if (gracePeriodActive) {
        gracePeriodTimer--;
        roomClearTimer = gracePeriodTimer; // sync for drawing

        // Player is invincible during grace period
        player.invincibleTimer = 10; // keep refreshing invincibility

        // Check if grace period ended or all coins collected
        if (gracePeriodTimer <= 0 || coinPickups.length === 0) {
            coinPickups.length = 0;
            gracePeriodActive = false;
            nextRoom();
            return;
        }
        // Fall through to allow player movement, coin collection, and particle updates below
        // But skip enemy spawning (already handled above) and combat (enemies array is empty)
    }

    // Room clear check (non-grace-period fallback)
    if (gameState === 'roomClear' && !gracePeriodActive) {
        roomClearTimer--;
        if (roomClearTimer <= 0) {
            nextRoom();
        }
        return;
    }

    // --- Player Movement ---
    let dx = 0;
    let dy = 0;

    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    if (dx !== 0 && dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len;
        dy /= len;
    }

    player.x += dx * player.speed;
    player.y += dy * player.speed;

    player.x = Math.max(player.radius, Math.min(roomWidth - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(roomHeight - player.radius, player.y));

    // Player angle
    const playerScreenX = offset.x + player.x * scale;
    const playerScreenY = offset.y + player.y * scale;
    player.angle = Math.atan2(mouseY - playerScreenY, mouseX - playerScreenX);

    // Reload timer
    if (player.reloading) {
        player.reloadTimer--;
        if (player.reloadTimer <= 0) {
            player.ammo = player.maxAmmo;
            player.reloading = false;
            updateHUD();
        }
    }

    // Damage flash decay
    if (player.damageFlash > 0) player.damageFlash--;
    if (player.invincibleTimer > 0) player.invincibleTimer--;

    // Automatic Fire
    if (isMouseDown && WEAPONS[player.equippedWeapon].auto) {
        shoot();
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const nextX = b.x + b.vx;
        const nextY = b.y + b.vy;

        // Bullets only die if they go far off screen
        if (nextX < -1 || nextX > roomWidth + 1 || nextY < -1 || nextY > roomHeight + 1) {
            bullets.splice(i, 1);
            continue;
        }

        // Check bullet-enemy collision
        let hitEnemy = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            const dist = Math.sqrt((nextX - e.x) ** 2 + (nextY - e.y) ** 2);
            if (dist < e.radius + b.radius) {
                if (b.isRocket) {
                    hitEnemy = true;
                } else {
                    e.hp -= b.damage;
                    spawnParticles(e.x, e.y, '#ff0000', 8, 0.06);
                    screenShake = 4;

                    const hitAngle = Math.atan2(b.vy, b.vx);
                    spawnBlood(e.x, e.y, hitAngle, '#ff0000', e.hp <= 0, b.bloodMult || 1.0);

                    if (e.hp <= 0) {
                        const xpGained = getXPForType(e.type);
                        gainXP(xpGained);

                        spawnParticles(e.x, e.y, e.color, 15, 0.08);
                        const reward = Math.floor(e.maxHp * (coins > 100 ? 5 : 15));
                        spawnCoinPickups(e.x, e.y, reward);
                        stats.totalCoins += reward;
                        enemies.splice(j, 1);
                        killCount++;
                        stats.totalKills++;
                        updateHUD();
                    }

                    if (b.pierce > 0) {
                        b.pierce--;
                    } else {
                        hitEnemy = true;
                    }
                }
                break;
            }
        }

        if (hitEnemy) {
            if (b.isRocket) {
                // EXPLOSION!
                audioSystem.playSound('rpg', 'explosion');
                screenShake = 6;
                spawnParticles(b.x, b.y, '#ff6600', 15, 0.06); // Reduced particles for smaller splash
                spawnParticles(b.x, b.y, '#ffff00', 10, 0.04);
                spawnParticles(b.x, b.y, '#444', 20, 0.03);

                // Add lingering smoke circle
                explosionSmoke.push({
                    x: b.x,
                    y: b.y,
                    radius: b.explosionRadius * 1.2,
                    life: 180, // 3 seconds at 60fps
                    maxLife: 180
                });

                // Damage all enemies in radius
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const e = enemies[j];
                    const dist = Math.sqrt((b.x - e.x) ** 2 + (b.y - e.y) ** 2);
                    if (dist < b.explosionRadius) {
                        e.hp -= b.damage;
                        spawnParticles(e.x, e.y, '#ff0000', 5, 0.05);

                        const splatAngle = Math.atan2(e.y - b.y, e.x - b.x);
                        spawnBlood(e.x, e.y, splatAngle, '#ff0000', e.hp <= 0, b.bloodMult || 1.0);

                        if (e.hp <= 0) {
                            const xpGained = getXPForType(e.type);
                            gainXP(xpGained);
                            spawnParticles(e.x, e.y, e.color, 15, 0.08);
                            const reward = Math.floor(e.maxHp * (coins > 100 ? 5 : 15));
                            spawnCoinPickups(e.x, e.y, reward);
                            stats.totalCoins += reward;
                            enemies.splice(j, 1);
                            killCount++;
                            stats.totalKills++;
                            updateHUD();
                        }
                    }
                }
            }
            bullets.splice(i, 1);
            continue;
        }

        b.x = nextX;
        b.y = nextY;

        if (b.x < -10 || b.x > 20 || b.y < -10 || b.y > 20) {
            bullets.splice(i, 1);
        }
    }

    // --- Enemy Update ---
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        // Move toward player
        const eDx = player.x - e.x;
        const eDy = player.y - e.y;
        const eDist = Math.sqrt(eDx * eDx + eDy * eDy);

        if (eDist > 0) {
            e.x += (eDx / eDist) * e.speed;
            e.y += (eDy / eDist) * e.speed;
        }

        e.wobble += e.wobbleSpeed;

        // Check collision with player
        if (eDist < player.radius + e.radius && player.invincibleTimer <= 0 && !gracePeriodActive) {
            player.hp -= e.damage;
            player.damageFlash = 15;
            player.invincibleTimer = 30;
            screenShake = 8;
            spawnParticles(player.x, player.y, '#ff0000', 10, 0.05);

            // Knockback enemy
            if (eDist > 0) {
                e.x -= (eDx / eDist) * 1;
                e.y -= (eDy / eDist) * 1;
            }

            if (player.hp <= 0) {
                triggerDeath();
                return; // Stop processing this frame
            }

            // Kamikaze mechanic for fast enemies
            if (e.type === 'wraith' || e.type === 'phantom') {
                spawnParticles(e.x, e.y, e.color, 15, 0.08);
                enemies.splice(i, 1);
                updateHUD();
                continue;
            }

            updateHUD();
        }
    }

    // Check if room is clear (all enemies dead and no pending spawns)

    // Check if room is clear (all enemies dead and no pending spawns)
    if (enemies.length === 0 && enemiesRemainingToSpawn <= 0 && gameState === 'playing') {
        // Calculate grace period based on coins on the ground (tiered)
        const coinCount = coinPickups.length;
        let graceSec;
        if (coinCount <= 10) graceSec = 5;
        else if (coinCount <= 19) graceSec = 5 + (coinCount - 10) / 9 * 10; // interpolate 5→15
        else if (coinCount <= 30) graceSec = 15;
        else graceSec = 25;
        const dynamicDuration = Math.round(graceSec * 60); // convert to frames
        // Start grace period for coin collection
        gracePeriodActive = true;
        gracePeriodTimer = dynamicDuration;
        gracePeriodMaxTimer = dynamicDuration;
        allEnemiesDefeated = true;
        gameState = 'roomClear';
        roomClearTimer = dynamicDuration; // sync for drawing
    }

    // --- Coin Pickup Collection (during normal play) ---
    updateCoinPickups();

    // --- Particle Update ---
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // --- Smoke Update ---
    for (let i = explosionSmoke.length - 1; i >= 0; i--) {
        explosionSmoke[i].life--;
        if (explosionSmoke[i].life <= 0) explosionSmoke.splice(i, 1);
    }

    // --- Blood Update ---
    for (let i = bloodSplats.length - 1; i >= 0; i--) {
        bloodSplats[i].life--;
        if (bloodSplats[i].life <= 0) bloodSplats.splice(i, 1);
    }

    // Muzzle flash decay
    if (muzzleFlash > 0) muzzleFlash--;
    if (screenShake > 0) screenShake *= 0.85;
    if (screenShake < 0.1) screenShake = 0;
}

// --- Drawing ---
function drawWall(x1, y1, x2, y2, isHorizontal) {
    // Walls removed in favor of open screen
}

function drawPlayer() {
    const px = offset.x + player.x * scale;
    const py = offset.y + player.y * scale;

    // Damage flash effect
    if (player.damageFlash > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${player.damageFlash / 30})`;
        ctx.beginPath();
        ctx.arc(px, py, player.radius * scale * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Player body
    const skinDef = SKINS[player.skin];
    if (skinDef.type === 'color') {
        const grad = ctx.createRadialGradient(px, py, 0, px, py, player.radius * scale);
        grad.addColorStop(0, skinDef.value);
        grad.addColorStop(1, '#666');
        ctx.fillStyle = grad;
    } else if (skinDef.type === 'gradient') {
        const grad = ctx.createLinearGradient(px - player.radius * scale, py - player.radius * scale, px + player.radius * scale, py + player.radius * scale);
        grad.addColorStop(0, skinDef.value[0]);
        grad.addColorStop(1, skinDef.value[1]);
        ctx.fillStyle = grad;
    } else if (skinDef.type === 'texture') {
        ctx.fillStyle = '#444'; // base
        ctx.beginPath();
        ctx.arc(px, py, player.radius * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.clip();
        if (skinDef.value === 'camo') {
            ctx.fillStyle = '#2d4c1e';
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                ctx.arc(px + (Math.sin(i) * 10), py + (Math.cos(i) * 10), 15, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (skinDef.value === 'blood') {
            ctx.fillStyle = '#6e0000';
            for (let i = 0; i < 15; i++) {
                ctx.beginPath();
                ctx.arc(px + (Math.sin(i * 2) * 12), py + (Math.cos(i * 3) * 12), 4 + Math.random() * 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
        ctx.fillStyle = 'transparent'; // prevent refilling
    } else if (skinDef.type === 'rainbow') {
        const hue = (Date.now() / 15) % 360;
        ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
    }

    if (skinDef.type !== 'texture' || true) {
        ctx.beginPath();
        ctx.arc(px, py, player.radius * scale, 0, Math.PI * 2);
        ctx.fill();
    }

    // Player outline
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gun Visual Enhancement
    const weapon = WEAPONS[player.equippedWeapon];
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.angle);

    // Gun body
    ctx.fillStyle = weapon.gunColor;
    const gLength = weapon.length * scale;
    const gWidth = weapon.width * scale;

    // Draw more than a stick - a blocky gun shape
    ctx.fillRect(0, -gWidth / 2, gLength, gWidth);

    // Extra details like a barrel highlight or handle
    ctx.fillStyle = '#222';
    ctx.fillRect(gLength * 0.7, -gWidth / 2 - 1, gLength * 0.3, 2); // Barrel end
    if (player.equippedWeapon === 'ak47') {
        ctx.fillStyle = '#3a2a1a'; // Wooden stock/grip feel
        ctx.fillRect(0, gWidth / 2, gLength * 0.4, gWidth * 0.5); // Grip
        ctx.fillStyle = '#444';
        ctx.fillRect(gLength * 0.3, -gWidth / 2 - 3, gLength * 0.2, 3); // Sight
    } else if (player.equippedWeapon === 'shotgun') {
        ctx.fillStyle = '#3a2a1a'; // Wooden stock
        ctx.fillRect(0, gWidth / 2, gLength * 0.5, gWidth * 0.5);
        ctx.fillStyle = '#222';
        // Double barrel look
        ctx.fillRect(gLength * 0.2, -gWidth / 2 - 1, gLength * 0.8, gWidth / 2);
        ctx.fillRect(gLength * 0.2, 1, gLength * 0.8, gWidth / 2);
    } else if (player.equippedWeapon === 'sniper') {
        ctx.fillStyle = '#0d0d1a'; // Dark stock
        ctx.fillRect(0, gWidth / 2, gLength * 0.35, gWidth * 0.6);
        ctx.fillStyle = '#6600cc'; // Purple scope
        ctx.fillRect(gLength * 0.45, -gWidth / 2 - 3, gLength * 0.2, 3);
        ctx.fillStyle = '#444466';
        ctx.fillRect(gLength * 0.88, -gWidth / 4, gLength * 0.12, gWidth / 2); // muzzle suppressor
    } else if (player.equippedWeapon === 'rpg') {
        ctx.fillStyle = '#4a5d23'; // Olive green
        ctx.fillRect(0, -gWidth / 2, gLength, gWidth);
        ctx.fillStyle = '#2d3a16'; // Grip
        ctx.fillRect(gLength * 0.4, gWidth / 2, gLength * 0.15, gWidth * 0.6);
        ctx.fillStyle = '#222'; // Rocket launcher back
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-gLength * 0.15, -gWidth * 1.5);
        ctx.lineTo(-gLength * 0.15, gWidth * 1.5);
        ctx.fill();
        ctx.fillStyle = '#777'; // Barrel details
        ctx.fillRect(gLength * 0.85, -gWidth / 2 - 2, gLength * 0.15, gWidth + 4);
    } else {
        ctx.fillRect(0, gWidth / 2, gLength * 0.3, gWidth * 0.8); // Pistol grip
    }

    ctx.restore();

    // Sniper laser sight
    if (player.equippedWeapon === 'sniper') {
        const laserStart = { x: px + Math.cos(player.angle) * gLength, y: py + Math.sin(player.angle) * gLength };
        const laserEnd = { x: px + Math.cos(player.angle) * gLength * 18, y: py + Math.sin(player.angle) * gLength * 18 };
        const laserGrad = ctx.createLinearGradient(laserStart.x, laserStart.y, laserEnd.x, laserEnd.y);
        laserGrad.addColorStop(0, 'rgba(180, 0, 255, 0.55)');
        laserGrad.addColorStop(1, 'rgba(180, 0, 255, 0)');
        ctx.strokeStyle = laserGrad;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(laserStart.x, laserStart.y);
        ctx.lineTo(laserEnd.x, laserEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Muzzle flash
    if (muzzleFlash > 0) {
        const gunTipX = px + Math.cos(player.angle) * gLength;
        const gunTipY = py + Math.sin(player.angle) * gLength;
        const flashSize = muzzleFlash * 5;
        const flashGrad = ctx.createRadialGradient(gunTipX, gunTipY, 0, gunTipX, gunTipY, flashSize);
        flashGrad.addColorStop(0, 'rgba(255, 220, 100, 0.9)');
        flashGrad.addColorStop(0.5, 'rgba(255, 150, 50, 0.4)');
        flashGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(gunTipX, gunTipY, flashSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawEnemies() {
    enemies.forEach(e => {
        const ex = offset.x + e.x * scale;
        const ey = offset.y + e.y * scale;
        const er = e.radius * scale;

        // Wobble effect
        const wobbleX = Math.sin(e.wobble) * 2;
        const wobbleY = Math.cos(e.wobble * 0.7) * 2;

        // Shadow under enemy
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(ex, ey + er * 0.8, er * 0.9, er * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Enemy body
        const bodyGrad = ctx.createRadialGradient(ex + wobbleX, ey + wobbleY, 0, ex, ey, er);
        bodyGrad.addColorStop(0, e.color);
        bodyGrad.addColorStop(0.7, `hsl(0, 40%, 12%)`);
        bodyGrad.addColorStop(1, 'rgba(20, 0, 0, 0.8)');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        if (e.type === 'wraith') {
            // Wraiths are more elongated/tear-drop shaped
            ctx.ellipse(ex + wobbleX, ey + wobbleY, er * 0.7, er * 1.2, Math.atan2(player.y - e.y, player.x - e.x) + Math.PI / 2, 0, Math.PI * 2);
        } else {
            ctx.arc(ex + wobbleX, ey + wobbleY, er, 0, Math.PI * 2);
        }
        ctx.fill();

        // Eyes - different patterns per type
        const angleToPlayer = Math.atan2(player.y - e.y, player.x - e.x);

        if (e.type === 'hulk') {
            // One big scary eye
            const eyeDist = er * 0.2;
            const eyeSize = er * 0.4;
            const eyeX = ex + wobbleX + Math.cos(angleToPlayer) * eyeDist;
            const eyeY = ey + wobbleY + Math.sin(angleToPlayer) * eyeDist;
            ctx.fillStyle = '#ff1100';
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, eyeSize * 0.3, 0, Math.PI * 2);
            ctx.fill();
        } else if (e.type === 'wraith') {
            // Many small twitchy eyes
            const eyeCount = 4;
            for (let i = 0; i < eyeCount; i++) {
                const off = (i - (eyeCount - 1) / 2) * 0.5;
                const eyeDist = er * 0.4;
                const eyeSize = er * 0.15;
                const eyeX = ex + wobbleX + Math.cos(angleToPlayer + off) * eyeDist;
                const eyeY = ey + wobbleY + Math.sin(angleToPlayer + off) * eyeDist;
                ctx.fillStyle = '#00ffff';
                ctx.beginPath();
                ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (e.type === 'phantom') {
            // Phantom: translucent trails and single ghostly eye
            ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 200) * 0.2;
            ctx.fillStyle = '#6600ff';
            ctx.beginPath();
            ctx.arc(ex + wobbleX, ey + wobbleY, er, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;

            const eyeSize = er * 0.3;
            const eyeX = ex + wobbleX + Math.cos(angleToPlayer) * (er * 0.1);
            const eyeY = ey + wobbleY + Math.sin(angleToPlayer) * (er * 0.1);
            ctx.fillStyle = '#cc00ff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#cc00ff';
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (e.type === 'nightmare') {
            // Nightmare: spike ball with deep red center
            const spikes = 8;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            for (let i = 0; i < spikes; i++) {
                const a = (i / spikes) * Math.PI * 2 + (Date.now() / 400);
                const outerR = er * 1.3;
                const innerR = er * 0.7;
                ctx.lineTo(ex + Math.cos(a) * outerR, ey + Math.sin(a) * outerR);
                ctx.lineTo(ex + Math.cos(a + Math.PI / spikes) * innerR, ey + Math.sin(a + Math.PI / spikes) * innerR);
            }
            ctx.closePath();
            ctx.fill();

            // Glowing red eyes (many)
            for (let i = 0; i < 3; i++) {
                const eyeX = ex + (Math.random() - 0.5) * er;
                const eyeY = ey + (Math.random() - 0.5) * er;
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(eyeX, eyeY, er * 0.15, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (e.type === 'colossus') {
            // Colossus: giant rocky monster
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.rect(ex - er + wobbleX, ey - er + wobbleY, er * 2, er * 2);
            ctx.fill();
            // Armor plates
            ctx.fillStyle = '#2d3a16';
            ctx.fillRect(ex - er * 0.8 + wobbleX, ey - er * 0.8 + wobbleY, er * 0.6, er * 0.6);
            ctx.fillRect(ex + er * 0.2 + wobbleX, ey - er * 0.8 + wobbleY, er * 0.6, er * 0.6);

            // Single massive eye
            const eyeSize = er * 0.5;
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(ex + wobbleX + Math.cos(angleToPlayer) * (er * 0.2), ey + wobbleY + Math.sin(angleToPlayer) * (er * 0.2), eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(ex + wobbleX + Math.cos(angleToPlayer) * (er * 0.3), ey + wobbleY + Math.sin(angleToPlayer) * (er * 0.3), eyeSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Standard two eyes (Stalker)
            const eyeDist = er * 0.3;
            const eyeSize = er * 0.2;
            const leftEyeX = ex + wobbleX + Math.cos(angleToPlayer - 0.4) * eyeDist;
            const leftEyeY = ey + wobbleY + Math.sin(angleToPlayer - 0.4) * eyeDist;
            ctx.fillStyle = '#ff2200';
            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, eyeSize * 0.4, 0, Math.PI * 2);
            ctx.fill();

            const rightEyeX = ex + wobbleX + Math.cos(angleToPlayer + 0.4) * eyeDist;
            const rightEyeY = ey + wobbleY + Math.sin(angleToPlayer + 0.4) * eyeDist;
            ctx.fillStyle = '#ff2200';
            ctx.beginPath();
            ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(rightEyeX, rightEyeY, eyeSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        // HP bar (if damaged)
        if (e.hp < e.maxHp) {
            const barWidth = er * 2;
            const barHeight = 3;
            const barX = ex - barWidth / 2;
            const barY = ey - er - 8;
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = '#ff3333';
            ctx.fillRect(barX, barY, barWidth * (e.hp / e.maxHp), barHeight);
        }
    });
}

function drawBullets() {
    bullets.forEach(b => {
        if (b.isRocket) {
            // RPG: Precise PG-7V rocket shape from reference
            const bx = offset.x + b.x * scale;
            const by = offset.y + b.y * scale;
            const br = b.radius * scale * 2.0;
            const angle = Math.atan2(b.vy, b.vx);

            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(angle);

            const olive = '#5d6e35';
            const darkOlive = '#3a4a16';

            // Rear section with swept back fins
            ctx.fillStyle = '#666'; // Tail tube
            ctx.fillRect(-br * 4.5, -br * 0.12, br * 2.0, br * 0.24);

            ctx.fillStyle = darkOlive;
            for (let sign of [1, -1]) {
                ctx.beginPath();
                ctx.moveTo(-br * 4.3, sign * br * 0.12);
                ctx.lineTo(-br * 5.2, sign * br * 0.8);
                ctx.lineTo(-br * 4.0, sign * br * 0.12);
                ctx.fill();
            }

            // Booster stem
            ctx.fillStyle = olive;
            ctx.fillRect(-br * 2.5, -br * 0.25, br * 3.5, br * 0.5);

            // Large Warhead section (Cylinder + Cone)
            ctx.beginPath();
            ctx.moveTo(br * 1.0, -br * 0.25);
            ctx.lineTo(br * 1.5, -br * 0.75);
            ctx.lineTo(br * 3.0, -br * 0.75);
            ctx.lineTo(br * 5.5, 0); // Extremely sharp long tip
            ctx.lineTo(br * 3.0, br * 0.75);
            ctx.lineTo(br * 1.5, br * 0.75);
            ctx.lineTo(br * 1.0, br * 0.25);
            ctx.closePath();
            ctx.fill();

            // Tip detailing (Fuze)
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(br * 5.5, 0, br * 0.08, 0, Math.PI * 2);
            ctx.fill();

            // Pointed Flame Exhaust
            const flicker = Math.random() * 0.4 + 0.6;
            const flameGrad = ctx.createLinearGradient(-br * 4.5, 0, -br * 11, 0);
            flameGrad.addColorStop(0, `rgba(255, 255, 180, ${flicker})`);
            flameGrad.addColorStop(0.3, `rgba(255, 120, 0, ${flicker * 0.8})`);
            flameGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = flameGrad;
            ctx.beginPath();
            ctx.moveTo(-br * 4.5, br * 0.12);
            ctx.lineTo(-br * 4.5 - br * 7 * flicker, 0);
            ctx.lineTo(-br * 4.5, -br * 0.12);
            ctx.fill();

            // Small smoke trail from rocket motor
            if (gameState === 'playing' && Math.random() > 0.4) {
                spawnParticles(b.x - b.vx * 0.5, b.y - b.vy * 0.5, 'rgba(180,180,180,0.2)', 1, 0.01);
            }

            ctx.restore();
        } else if (b.isSniper) {
            // Sniper: purple elongated bolt
            ctx.fillStyle = '#cc44ff';
            ctx.beginPath();
            ctx.arc(offset.x + b.x * scale, offset.y + b.y * scale, b.radius * scale, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(180, 0, 255, 0.45)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(offset.x + (b.x - b.vx * 5) * scale, offset.y + (b.y - b.vy * 5) * scale);
            ctx.lineTo(offset.x + b.x * scale, offset.y + b.y * scale);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#ff0';
            ctx.beginPath();
            ctx.arc(offset.x + b.x * scale, offset.y + b.y * scale, b.radius * scale, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(offset.x + (b.x - b.vx * 2) * scale, offset.y + (b.y - b.vy * 2) * scale);
            ctx.lineTo(offset.x + b.x * scale, offset.y + b.y * scale);
            ctx.stroke();
        }
    });
}

function spawnBlood(x, y, angle, color, isKill = false, sizeMult = 1.0) {
    // Instead of bigger circles, we increase the RATE (count) and SPREAD (distance)
    const baseCount = isKill ? 12 : 4;
    const count = Math.floor(baseCount * sizeMult);

    for (let i = 0; i < count; i++) {
        const spread = 0.8;
        const moveAngle = angle + (Math.random() - 0.5) * spread;
        // Spread longer based on sizeMult
        const dist = Math.random() * (isKill ? 0.9 : 0.4) * sizeMult;

        bloodSplats.push({
            x: x + Math.cos(moveAngle) * dist,
            y: y + Math.sin(moveAngle) * dist,
            size: 0.04 + Math.random() * 0.12, // Fixed size range
            rotation: Math.random() * Math.PI * 2,
            color: color,
            alpha: 0.4 + Math.random() * 0.3,
            life: 360, // 6 seconds
            maxLife: 360
        });
    }
    // Limit to 600 splats for performance since we increased the rate
    if (bloodSplats.length > 600) bloodSplats.splice(0, bloodSplats.length - 600);
}

function drawBloodSplats() {
    bloodSplats.forEach(s => {
        const sx = offset.x + s.x * scale;
        const sy = offset.y + s.y * scale;
        const sr = s.size * scale;

        ctx.globalAlpha = s.alpha * (s.life / s.maxLife);
        ctx.fillStyle = s.color;

        ctx.beginPath();
        ctx.ellipse(sx, sy, sr, sr * 0.6, s.rotation, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawExplosionSmoke() {
    explosionSmoke.forEach(s => {
        const alpha = (s.life / s.maxLife) * 0.7; // Increased visibility
        const sx = offset.x + s.x * scale;
        const sy = offset.y + s.y * scale;
        const sr = s.radius * scale;

        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
        // Lighter, more visible grays
        grad.addColorStop(0, `rgba(200, 200, 200, ${alpha})`);
        grad.addColorStop(0.5, `rgba(160, 160, 160, ${alpha * 0.6})`);
        grad.addColorStop(1, 'rgba(100, 100, 100, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawParticles() {
    particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(offset.x + p.x * scale, offset.y + p.y * scale, p.radius * scale, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawHealthBar() {
    const px = offset.x + player.x * scale;
    const py = offset.y + player.y * scale;

    // Floating bar above player
    const barWidth = 40;
    const barHeight = 4;
    const barX = px - barWidth / 2;
    const barY = py - player.radius * scale - 15;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    // HP bar
    const hpPercent = player.hp / player.maxHp;
    let hpColor;
    if (hpPercent > 0.6) hpColor = '#44cc44';
    else if (hpPercent > 0.3) hpColor = '#ccaa33';
    else hpColor = '#cc3333';

    ctx.fillStyle = '#222';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    // Ammo display below health
    ctx.textAlign = 'center';
    ctx.fillStyle = player.reloading ? 'rgba(255, 200, 50, 0.8)' : 'rgba(255, 255, 255, 0.7)';
    ctx.font = '700 10px Outfit, sans-serif';

    const ammoText = player.reloading
        ? `RELOADING`
        : `${player.ammo}/${player.maxAmmo}`;

    ctx.fillText(ammoText, px, barY - 5);
}

function drawRoom() {
    // Screen shake offset
    const shakeX = (Math.random() - 0.5) * screenShake * 2;
    const shakeY = (Math.random() - 0.5) * screenShake * 2;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20);

    // Background
    const currentMap = MAPS[currentMapIdx];
    if (currentMap.type === 'image' && mapImages[currentMapIdx] && mapImages[currentMapIdx].complete) {
        ctx.drawImage(mapImages[currentMapIdx], 0, 0, canvas.width, canvas.height);

        // Make the map darker (Horror overlay)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (currentMap.type === 'dungeon') {
        const ts = 32; // Fixed tile size for dungeon
        const mapW = 30;
        const mapH = 15;
        // Tile the dungeon map across the entire canvas
        for (let y = -mapH * ts; y < canvas.height + mapH * ts; y += mapH * ts) {
            for (let x = -mapW * ts; x < canvas.width + mapW * ts; x += mapW * ts) {
                for (let row = 0; row < mapH; row++) {
                    for (let col = 0; col < mapW; col++) {
                        const tile = DUNGEON_MAP_DATA[row][col];
                        drawDungeonTile(tile, x + col * ts, y + row * ts, ts);
                    }
                }
            }
        }

        // Optional: Vignette for dungeon
        const vig = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 4, canvas.width / 2, canvas.height / 2, canvas.width / 1.1);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (currentMap.type === 'bunker') {
        const ts = 32;
        const mapW = 30;
        const mapH = 15;
        for (let y = -mapH * ts; y < canvas.height + mapH * ts; y += mapH * ts) {
            for (let x = -mapW * ts; x < canvas.width + mapW * ts; x += mapW * ts) {
                for (let row = 0; row < mapH; row++) {
                    for (let col = 0; col < mapW; col++) {
                        const tile = BUNKER_MAP_DATA[row][col];
                        drawBunkerTile(tile, x + col * ts, y + row * ts, ts);
                    }
                }
            }
        }
        ctx.fillStyle = 'rgba(30,50,20,0.15)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const vig = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 6, canvas.width / 2, canvas.height / 2, canvas.width / 1.1);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = vig; ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (currentMap.type === 'desert') {
        const ts = 32; const mapW = 30; const mapH = 15;
        for (let y = -mapH * ts; y < canvas.height + mapH * ts; y += mapH * ts) {
            for (let x = -mapW * ts; x < canvas.width + mapW * ts; x += mapW * ts) {
                for (let row = 0; row < mapH; row++) {
                    for (let col = 0; col < mapW; col++) {
                        const tile = DESERT_MAP_DATA[row][col];
                        drawDesertTile(tile, x + col * ts, y + row * ts, ts);
                    }
                }
            }
        }
        ctx.fillStyle = 'rgba(180,120,20,0.08)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const vig = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 4, canvas.width / 2, canvas.height / 2, canvas.width / 1.1);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vig; ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (currentMap.type === 'sewer') {
        const ts = 32; const mapW = 30; const mapH = 15;
        for (let y = -mapH * ts; y < canvas.height + mapH * ts; y += mapH * ts) {
            for (let x = -mapW * ts; x < canvas.width + mapW * ts; x += mapW * ts) {
                for (let row = 0; row < mapH; row++) {
                    for (let col = 0; col < mapW; col++) {
                        const tile = SEWER_MAP_DATA[row][col];
                        drawSewerTile(tile, x + col * ts, y + row * ts, ts);
                    }
                }
            }
        }
        ctx.fillStyle = 'rgba(20,40,15,0.12)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const vig = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 6, canvas.width / 2, canvas.height / 2, canvas.width / 1.1);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = vig; ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (currentMap.type === 'office') {
        const ts = 32; const mapW = 30; const mapH = 15;
        for (let y = -mapH * ts; y < canvas.height + mapH * ts; y += mapH * ts) {
            for (let x = -mapW * ts; x < canvas.width + mapW * ts; x += mapW * ts) {
                for (let row = 0; row < mapH; row++) {
                    for (let col = 0; col < mapW; col++) {
                        const tile = OFFICE_MAP_DATA[row][col];
                        drawOfficeTile(tile, x + col * ts, y + row * ts, ts);
                    }
                }
            }
        }
        ctx.fillStyle = 'rgba(10,10,20,0.15)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const vig = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 6, canvas.width / 2, canvas.height / 2, canvas.width / 1.1);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = vig; ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        const bgGrad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 1.2);
        bgGrad.addColorStop(0, '#666');
        bgGrad.addColorStop(1, '#444');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);

        // Floor
        ctx.fillStyle = currentMap.wallColor || '#555';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= roomWidth; i++) {
        ctx.beginPath();
        ctx.moveTo(i * scale, 0);
        ctx.lineTo(i * scale, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i <= roomHeight; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * scale);
        ctx.lineTo(canvas.width, i * scale);
        ctx.stroke();
    }

    // Walls logic removed for open field.
    // drawWall calls removed.
}

function drawDeathScreen() {
    ctx.fillStyle = 'rgba(40, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawRoomClearScreen() {
    if (gracePeriodActive) {
        drawGracePeriodUI();
        return;
    }
    const progress = 1 - (roomClearTimer / ROOM_CLEAR_DELAY);

    ctx.fillStyle = `rgba(0, 50, 0, ${0.3 * (1 - progress)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = `rgba(100, 255, 100, ${0.8 * (1 - progress)})`;
    ctx.font = 'italic 700 2.5rem Playfair Display, serif';
    ctx.textAlign = 'center';
    ctx.fillText('ROOM CLEARED', canvas.width / 2, canvas.height / 2 - 10);

    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * (1 - progress)})`;
    ctx.font = '300 1rem Outfit, sans-serif';
    ctx.fillText(`Entering Room ${currentRoom + 1}...`, canvas.width / 2, canvas.height / 2 + 30);
}

// --- Coin Pickup Update ---
function updateCoinPickups() {
    for (let i = coinPickups.length - 1; i >= 0; i--) {
        const c = coinPickups[i];

        // Physics: bounce animation
        if (!c.settled) {
            c.x += c.vx;
            c.y += c.vy;
            c.z += c.vz;
            c.vz -= c.gravity;
            c.vx *= 0.98;
            c.vy *= 0.98;
            c.rotation += c.rotSpeed;

            if (c.z <= 0 && c.vz < 0) {
                c.z = 0;
                c.bounces++;
                if (c.bounces >= c.maxBounces) {
                    c.settled = true;
                    c.vx = 0;
                    c.vy = 0;
                    c.vz = 0;
                } else {
                    c.vz = Math.abs(c.vz) * 0.5; // dampened bounce
                    c.vx *= 0.6;
                    c.vy *= 0.6;
                }
            }
        } else {
            // Gentle floating bob once settled
            c.bobPhase += c.bobSpeed;
        }

        // Glow fade
        if (c.glow > 0.3) c.glow *= 0.98;

        // Clamp to room bounds
        c.x = Math.max(0.1, Math.min(roomWidth - 0.1, c.x));
        c.y = Math.max(0.1, Math.min(roomHeight - 0.1, c.y));

        // Auto-pickup: check distance to player
        const dx = player.x - c.x;
        const dy = player.y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < COIN_PICKUP_RADIUS) {
            // Collect this coin!
            coins += c.value;
            coinPickups.splice(i, 1);

            // VFX: golden particle burst
            spawnParticles(c.x, c.y, '#ffd700', 6, 0.06);
            spawnParticles(c.x, c.y, '#ffaa00', 4, 0.04);

            // SFX: coin pickup sound (reuse existing sound system)
            if (settings.sfx) {
                try {
                    const coinSfx = new Audio();
                    // Generate a quick "cha-ching" using oscillator
                    const actx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1200, actx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(2400, actx.currentTime + 0.08);
                    gain.gain.setValueAtTime(settings.sfxVolume / 400, actx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.15);
                    osc.start(actx.currentTime);
                    osc.stop(actx.currentTime + 0.15);
                } catch (e) { /* ignore audio errors */ }
            }

            updateHUD();
            continue;
        }

        // Magnetic attraction: follow the player from any distance
        if (c.settled) {
            // Constant slow drift + stronger pull when close
            let pullStrength = 0.016;

            if (dist < COIN_PICKUP_RADIUS * 4) {
                // Stronger vacuum effect when near
                const vacuum = 0.10 * (1 - dist / (COIN_PICKUP_RADIUS * 4));
                pullStrength = Math.max(pullStrength, vacuum);
            }

            // 2X Speed during grace period countdown
            if (gracePeriodActive) pullStrength *= 2.0;

            if (dist > 0) {
                c.x += (dx / dist) * pullStrength;
                c.y += (dy / dist) * pullStrength;
            }
        }
    }
}

// --- Draw Coin Pickups ---
function drawCoinPickups() {
    coinPickups.forEach(c => {
        const cx = offset.x + c.x * scale;
        const cy = offset.y + c.y * scale - (c.settled ? Math.sin(c.bobPhase) * 3 : c.z * scale * 0.5);
        const cr = c.radius * scale;

        // Shadow on ground
        const shadowAlpha = Math.max(0, 0.3 - c.z * 0.5);
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(offset.x + c.x * scale, offset.y + c.y * scale + cr * 0.5, cr * 0.8, cr * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        const glowSize = cr * (2.5 + Math.sin(c.bobPhase) * 0.5);
        const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize);
        glowGrad.addColorStop(0, `rgba(255, 215, 0, ${0.25 * c.glow})`);
        glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Coin body (stretched circle to simulate 3D coin rotation)
        ctx.save();
        ctx.translate(cx, cy);
        const stretchX = Math.abs(Math.cos(c.rotation)); // simulate spinning
        ctx.scale(Math.max(0.3, stretchX), 1);

        // Outer coin
        const coinGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
        coinGrad.addColorStop(0, '#ffe066');
        coinGrad.addColorStop(0.6, '#ffd700');
        coinGrad.addColorStop(1, '#cc9900');
        ctx.fillStyle = coinGrad;
        ctx.beginPath();
        ctx.arc(0, 0, cr, 0, Math.PI * 2);
        ctx.fill();

        // Inner coin detail
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(0, 0, cr * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Coin symbol
        ctx.fillStyle = '#cc8800';
        ctx.font = `bold ${Math.floor(cr * 1.2)}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (stretchX > 0.5) {
            ctx.fillText('⟡', 0, 0);
        }

        // Edge highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, cr * 0.9, -Math.PI * 0.3, Math.PI * 0.3);
        ctx.stroke();

        ctx.restore();
    });
}

// --- Grace Period UI ---
function drawGracePeriodUI() {
    const secondsLeft = Math.ceil(gracePeriodTimer / 60);
    const progress = gracePeriodMaxTimer > 0 ? gracePeriodTimer / gracePeriodMaxTimer : 0;
    const coinsLeft = coinPickups.length;

    // Subtle green tint overlay
    ctx.fillStyle = `rgba(0, 80, 0, ${0.08 + Math.sin(Date.now() / 300) * 0.03})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Top center banner
    const bannerY = 80;
    const bannerW = 350;
    const bannerH = 90;
    const bannerX = canvas.width / 2 - bannerW / 2;

    // Banner background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + Math.sin(Date.now() / 200) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
    ctx.fill();
    ctx.stroke();

    // "COLLECT COINS!" text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 1.3rem Outfit, sans-serif';
    ctx.fillText('⟡ COLLECT COINS! ⟡', canvas.width / 2, bannerY + 30);

    // Timer countdown
    const timerColor = secondsLeft <= 3 ? '#ff4444' : '#ffffff';
    ctx.fillStyle = timerColor;
    ctx.font = `bold 1.8rem Outfit, sans-serif`;
    ctx.fillText(`${secondsLeft}s`, canvas.width / 2, bannerY + 62);

    // Progress bar under banner
    const barW = bannerW - 20;
    const barH = 4;
    const barX = bannerX + 10;
    const barY = bannerY + bannerH - 10;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(barX, barY, barW, barH);

    const barColor = secondsLeft <= 3 ? '#ff4444' : '#ffd700';
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barW * progress, barH);

    // Coins remaining indicator
    if (coinsLeft > 0) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.font = '0.75rem Outfit, sans-serif';
        ctx.fillText(`${coinsLeft} coins remaining`, canvas.width / 2, bannerY + bannerH + 18);
    } else {
        ctx.fillStyle = 'rgba(100, 255, 100, 0.8)';
        ctx.font = '0.75rem Outfit, sans-serif';
        ctx.fillText('All coins collected!', canvas.width / 2, bannerY + bannerH + 18);
    }
}

function animate() {
    update();
    drawRoom();
    drawBloodSplats();
    drawExplosionSmoke();
    drawCoinPickups();
    drawParticles();
    drawBullets();
    drawEnemies();
    drawPlayer();
    drawHealthBar();

    if (gameState === 'dead') {
        drawDeathScreen();
    } else if (gameState === 'roomClear') {
        drawRoomClearScreen();
    }

    ctx.restore();
    requestAnimationFrame(animate);
}

init();
