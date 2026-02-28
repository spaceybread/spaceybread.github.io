export const SHOP_ITEMS = [
    {
        id: "start_speed",
        name: "Worn Boots",
        desc: "Start each run with +20 speed",
        cost: 600,
        maxLevel: 5,
        effect: (level) => ({ startSpeed: 20 * level }),
    },
    {
        id: "start_health",
        name: "Iron Heart",
        desc: "Start each run with +20 max health",
        cost: 800,
        maxLevel: 5,
        effect: (level) => ({ startHealth: 20 * level }),
    },
    {
        id: "start_damage",
        name: "Sharpened Edge",
        desc: "Start each run with +10 bullet damage",
        cost: 1000,
        maxLevel: 5,
        effect: (level) => ({ startDamage: 10 * level }),
    },
    {
        id: "start_hand_size",
        name: "Deep Pockets",
        desc: "Start each run with +1 hand size",
        cost: 1500,
        maxLevel: 3,
        effect: (level) => ({ startHandSize: level }),
    },
    {
        id: "start_discards",
        name: "Second Thoughts",
        desc: "Start each run with +1 max discards",
        cost: 1200,
        maxLevel: 3,
        effect: (level) => ({ startDiscards: level }),
    },
    {
        id: "boss_coins",
        name: "Bounty Hunter",
        desc: "Bosses drop +10 coins each",
        cost: 1600,
        maxLevel: 3,
        effect: (level) => ({ bossCoinsBonus: 10 * level }),
    },
    {
        id: "coin_magnet",
        name: "Coin Magnet",
        desc: "All enemies drop +1 coin",
        cost: 900,
        maxLevel: 4,
        effect: (level) => ({ coinBonus: level }),
    },
    {
        id: "fire_rate",
        name: "Hair Trigger",
        desc: "Start with -0.1s fire interval",
        cost: 1300,
        maxLevel: 4,
        effect: (level) => ({ startFireRate: 0.1 * level }),
    },
];

export function getOwnedLevels() {
    const raw = localStorage.getItem("shopOwned");
    return raw ? JSON.parse(raw) : {};
}

export function buyItem(itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return false;

    const owned = getOwnedLevels();
    const currentLevel = owned[itemId] || 0;
    if (currentLevel >= item.maxLevel) return false;

    const cost = item.cost * (currentLevel + 1);
    const coins = parseInt(localStorage.getItem("coins") || "0");
    if (coins < cost) return false;

    localStorage.setItem("coins", coins - cost);
    owned[itemId] = currentLevel + 1;
    localStorage.setItem("shopOwned", JSON.stringify(owned));
    return true;
}

export function getStartingBonuses() {
    const owned = getOwnedLevels();
    const bonuses = {};
    for (const item of SHOP_ITEMS) {
        const level = owned[item.id] || 0;
        if (level > 0) {
            Object.assign(bonuses, item.effect(level));
        }
    }
    return bonuses;
}

export function resetShop() {
    localStorage.removeItem("shopOwned");
}