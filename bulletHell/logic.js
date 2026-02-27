let canvas;

let playerSpeed = 200;
let ENEMY_SPEED = 60;

let keys = {};
let player;
let camera;
let enemies;
let score;
let startTime;

let hand = [];
let deck = [];
let selected = new Set();
let activeIndex = 0;
let discards = 3;
let lastDiscardUpdate = 0; 
let remHands = 5; 
let lastHandUpdate = 0;
let playedHand = "None!"; 

let maxHandSize = 7;

let playerHealth = 100;
let bullets = [];
let mouseWorld = { x: 0, y: 0 };
const BULLET_SPEED = 500;
let bulletDamage = 25;
const ENEMY_MAX_HEALTH = 100;
let maxPlayerHealth = 100;
let bulletCountModifier = 1; 

let maxHands = 5; 
let maxDiscards = 3; 
let handRefresh = 30; 
let discardRefresh = 20; 

let gameStageModifier = 1; 

let shootTimer = 0;
let shootInterval = 2;

let items = [];

let gameOver = false;
let paused = false;
let highScore = parseInt(localStorage.getItem("highScore") || "0");

let pausedAt = 0;
let totalPausedTime = 0;

let playerHitTimer = 0;
const HIT_FLASH_DURATION = 0.15;
let enemiesKilled = 0;
let currentStreak = 0;

function sortHand() {
    hand.sort((b, a) => a.value - b.value);
}

let notifications = [];

function addNotification(title, subtitle) {
    notifications.push({
        title,
        subtitle,
        timer: 2.5
    });
}


function createDeck() {
    const suits = ["♠", "♥", "♦", "♣"];
    const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const values = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

    const deck = [];

    for (const suit of suits) {
        for (let i = 0; i < ranks.length; i++) {
            deck.push({
                suit,
                rank: ranks[i],
                value: values[i]
            });
        }
    }

    return deck;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


export function initLogic(c) {
    canvas = c;

    deck = shuffle(createDeck());
    hand = deck.splice(0, maxHandSize);
    sortHand();
    selected.clear();
    activeIndex = 0;

    player = {
        x: 0,
        y: 0,
        size: 16
    };
    camera = {
        x: 0,
        y: 0
    };
    enemies = [];
    score = 0;
    startTime = performance.now();
    
    playerHealth = 100;
    bullets = [];
    items = [];

    document.addEventListener("keydown", e => {
        keys[e.key.toLowerCase()] = true;
        if (e.key.toLowerCase() === "h") {
            if (!gameOver) {
                paused = !paused;
                if (paused) {
                    pausedAt = performance.now();
                } else {
                    totalPausedTime += performance.now() - pausedAt;
                }
            }
        }
    })

    document.addEventListener("mousemove", e => {
        mouseWorld.x = e.clientX + camera.x;
        mouseWorld.y = e.clientY + camera.y;
    });

    // document.addEventListener("click", shootBullet);

    document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
    document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);
    document.addEventListener("keydown", handleCardInput);


}

function handleCardInput(e) {
    if (paused || gameOver) return;

    if (hand.length === 0) return;

    if (e.key === "ArrowRight") {
        activeIndex = (activeIndex + 1) % hand.length;
    }

    if (e.key === "ArrowLeft") {
        activeIndex = (activeIndex - 1 + hand.length) % hand.length;
    }

    if (e.key === "ArrowUp") {
        selected.add(activeIndex);
    }

    if (e.key === "ArrowDown") {
        selected.delete(activeIndex);
    }

    if (e.key === "Enter") {
        let selectedCards = [...selected].map(i => hand[i]); 
        if (selectedCards.length != 5) return; 

        if (remHands == 0) return; 
        scoreSelectedCards(selectedCards);
        discardSelected(false);
        sortHand();
        remHands -=1; 
    }

    if (e.key === "Shift") {


        discardSelected(true);
        sortHand();
    }
}

function shootBullet() {
    if (enemies.length === 0) return;

    let nearest = null;
    let nearestDist = Infinity;
    for (const e of enemies) {
        const dist = Math.hypot(e.x - player.x, e.y - player.y);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = e;
        }
    }

    const dx = nearest.x - player.x;
    const dy = nearest.y - player.y;
    const len = Math.hypot(dx, dy);

    for (let i = 0; i < bulletCountModifier; i++) {
        let dir = (i % 2 === 0) ? -1 : 1;
        const spreadDx = dx + dir * i * 20;
        const spreadLen = Math.hypot(spreadDx, dy);
        bullets.push({
            x: player.x,
            y: player.y,
            vx: (spreadDx / spreadLen) * BULLET_SPEED,
            vy: (dy / spreadLen) * BULLET_SPEED,
            life: 2
        });
    }
}

function discardSelected(isCounted) {

    if (discards == 0 && isCounted) {
        return; 
    }

    

    const newHand = [];

    for (let i = 0; i < hand.length; i++) {
        if (!selected.has(i)) {
            newHand.push(hand[i]);
        }
    }

    if (newHand.length == hand.length) {
        return; 
    }

    if (isCounted) discards -= 1; 

    const needed = maxHandSize - newHand.length;

    for (let i = 0; i < needed; i++) {
        if (deck.length === 0) {
            deck = shuffle(createDeck());
        }
        newHand.push(deck.pop());
    }

    hand = newHand;
    selected.clear();
    activeIndex = 0;
}

function scoreSelectedCards(cards) {
    let isFlush = true; 
    for (let i = 1; i < cards.length; i++) isFlush = isFlush && (cards[0].suit == cards[i].suit); 

    let isStraight = true; 
    
    if (cards[0].value == 14 && cards[1].value == 5) {
        isStraight = cards[2].value == 4 && cards[3].value == 3 && cards[4].value == 2; 
    } else {
        for (let i = 1; i < cards.length; i++) {
            isStraight = isStraight && (cards[0].value - cards[i].value == i); 
        }
    }

    if (isStraight && isFlush) {
        if (cards[4].value == 10) {
            // royal flush
            playedHand = "Royal Flush"; 
            // better weapons? future work
            // for now it's just a massive score boost
            // with a hand upgrade and bullet count boost
            
            let ect = enemies.length; 
            score += ect * 256; 
            maxHandSize += 2; 
            bulletCountModifier += cards[4].value;
            shootInterval = Math.min(0.1, shootInterval - 0.4); 
            enemies = []; 
            addNotification("Royal Flush", "Screen cleared · +2 hand size · +bullets · +fire rate");

            return; 
        } else {
            // straight flush
            playedHand = "Straight Flush"; 
            let ect = enemies.length; 
            score += ect * 16; 

            enemies = []; 
            addNotification("Straight Flush", "Screen cleared · score bonus");

            return; 
        }
    }

    const frequency = {};

    cards.forEach(element => {
        if (frequency[element.value]) {
            frequency[element.value]++;
        } else {
            frequency[element.value] = 1;
        }
    });

    let uniqueCards = Object.keys(frequency).length;
    if (uniqueCards == 2) {
        // either four of kind or full house

        if (frequency[cards[0].value] == 1 || frequency[cards[0].value] == 4) {
            // four of a kind
            playedHand = "Four of a Kind";
            // get a larger hand
            maxHandSize += 1; 
            addNotification("Four of a Kind", "+1 hand size");
            return; 
        } else {
            // full house
            playedHand = "Full House";
            // if smaller number appears three times, 
            // increase number of max hands and max discards
            // otherwise, 
            // increase the rate at which you replenish them 
            
            if (cards[0].value == cards[2].value) {
                discardRefresh = Math.max(1, discardRefresh - Math.ceil(cards[4].value / 5))
                handRefresh = Math.max(2, handRefresh - Math.ceil(cards[4].value / 5))
                addNotification("Full House", "Faster hand & discard refresh");
            } else {
                maxDiscards += 1; 
                maxHands += 1; 
                addNotification("Full House", "+1 max hands · +1 max discards");
            }
            

            return; 
        }
    }

    if (isFlush) {
        // flush
        playedHand = "Flush";
        // increase max health
        maxPlayerHealth += cards[0].value;
        addNotification("Flush", `+${cards[0].value} max health`);

        return; 
    }

    if (isStraight) {
        // straight 
        playedHand = "Straight";
        // increase number of bullets
        bulletCountModifier += Math.ceil(cards[4].value / 2); 
        addNotification("Straight", `+${Math.ceil(cards[4].value / 2)} bullet count`);

        return;     
    }

    if (uniqueCards == 3) {
        // either three of a kind of two pair
        let hasSingle = false; 
        for (let i = 0; i < cards.length; i++) hasSingle = hasSingle || (frequency[cards[i].value] == 1); 
        
        if (!hasSingle) {
            playedHand = "Three of a Kind"; 
            // buff damage
            bulletDamage += Math.ceil(cards[0].value / 2);
            addNotification("Three of a Kind", `+${Math.ceil(cards[0].value / 2)} bullet damage`);
            return; 
        } else {
            playedHand = "Two Pair";
            // speed up the player 
            let ct = cards[0].value;
            if (frequency[ct] == 1) ct = cards[1].value;  
            addNotification("Two Pair", `+${ct} player speed`);
            playerSpeed += ct; 

            return; 
        }
    }

    if (uniqueCards == 4) {
        playedHand = "Pair"; 

        for (let i = 0; i < cards.length; i++) {
            if (frequency[cards[i].value] == 2) {
                // heal the player
                    shootInterval = Math.max(0.1, shootInterval - 0.01 * cards[i].value); 
                    addNotification("Pair", `-${(0.01 * cards[i].value).toFixed(2)}s fire rate`);

                return; 
            }
        }

    }

    // high card lmao
    playedHand = "High Card"; 
    // heal the player
    playerHealth = Math.min(maxPlayerHealth, playerHealth + cards[0].value); 
    addNotification("High Card", `+${cards[0].value} health`);

    return; 
}

export function updateLogic(delta) {
    if (paused || gameOver) return;

    let dx = 0,
        dy = 0;

    if (keys["w"]) dy -= 1;
    if (keys["s"]) dy += 1;
    if (keys["a"]) dx -= 1;
    if (keys["d"]) dx += 1;

    if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;

        player.x += dx * playerSpeed * delta;
        player.y += dy * playerSpeed * delta;

        score += delta * 10;
    }

    shootTimer += delta;
    if (shootTimer >= shootInterval) {
        shootTimer = 0;
        shootBullet();
    }

    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;

    playerHitTimer = Math.max(0, playerHitTimer - delta);
    for (const e of enemies) {
        if (e.hitTimer > 0) e.hitTimer = Math.max(0, e.hitTimer - delta);
    }

    notifications = notifications.filter(n => {
        n.timer -= delta;
        return n.timer > 0;
    });

    spawnEnemies(delta);
    updateEnemies(delta);
    updateBullets(delta);
    
    checkPlayerEnemyCollision();
    checkItemPickup();
}

function spawnEnemies(delta) {
    if (Math.random() < delta * 1.5 * gameStageModifier) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 800;

        enemies.push({
            x: player.x + Math.cos(angle) * dist,
            y: player.y + Math.sin(angle) * dist,
            size: 14,
            health: ENEMY_MAX_HEALTH
        });
    }
}

function updateEnemies(delta) {
    for (const e of enemies) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const len = Math.hypot(dx, dy);

        e.x += (dx / len) * ENEMY_SPEED * gameStageModifier * delta;
        e.y += (dy / len) * ENEMY_SPEED * gameStageModifier * delta;
    }
}

function updateBullets(delta) {
    for (const b of bullets) {
        b.x += b.vx * delta;
        b.y += b.vy * delta;
        b.life -= delta;
    }

    for (const b of bullets) {
        for (const e of enemies) {
            const dx = b.x - e.x;
            const dy = b.y - e.y;
            if (Math.hypot(dx, dy) < e.size) {
                e.health -= bulletDamage;
                e.hitTimer = HIT_FLASH_DURATION; 
                b.life = 0;
            }
        }
    }

    bullets = bullets.filter(b => b.life > 0);
    enemies = enemies.filter(e => {
        if (e.health <= 0) {
            enemiesKilled++;
            currentStreak++;
            if (currentStreak % 10 === 0) {
                addNotification(`${currentStreak} Kill Streak!`, "You're on fire!");
            }
            if (Math.random() < 0.25) {
                const type = Math.random() < 0.5 ? "card" : "apple";
                items.push({ x: e.x, y: e.y, type });
            }
            return false;
        }
        return true;
    });
}

function checkPlayerEnemyCollision() {
    for (const e of enemies) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        if (Math.hypot(dx, dy) < player.size / 2 + e.size) {
            playerHealth -= 20; 
            const len = Math.hypot(dx, dy);
            playerHitTimer = HIT_FLASH_DURATION;
            currentStreak = 0;
            e.x -= (dx / len) * 30;
            e.y -= (dy / len) * 30;
        }
    }
    
    playerHealth = Math.max(0, playerHealth);
    if (playerHealth === 0) {
        gameOver = true;
        score = score * gameStageModifier; 
        if (score > highScore) {
            highScore = Math.floor(score);
            localStorage.setItem("highScore", highScore);
        }
    }
}

function checkItemPickup() {
    items = items.filter(item => {
        const dist = Math.hypot(item.x - player.x, item.y - player.y);
        if (dist < player.size + 10) {
            if (item.type === "apple") {
                playerHealth = Math.min(maxPlayerHealth, playerHealth + 20);
            } else if (item.type === "card") {
                if (deck.length === 0) deck = shuffle(createDeck());
                hand.push(deck.pop());
                sortHand();
            }
            return false;
        }
        return true;
    });
}

export function getState() {

    let timeScore;
    if (paused || gameOver) {
        timeScore = (pausedAt - startTime - totalPausedTime) / 1000;
    } else {
        timeScore = (performance.now() - startTime - totalPausedTime) / 1000;
    }

    if (timeScore - lastDiscardUpdate > discardRefresh) {
        if (discards < maxDiscards) discards += 1; 
        lastDiscardUpdate = timeScore; 
    }

    if (timeScore - lastHandUpdate > handRefresh) {
        if (remHands < maxHands) remHands += 1; 
        lastHandUpdate = timeScore; 
    }

    gameStageModifier = 1 + (Math.floor(timeScore / 30)) / 10; 


    let nearestDir = null;
    if (enemies.length > 0) {
        let nearest = enemies.reduce((best, e) => {
            return Math.hypot(e.x - player.x, e.y - player.y) 
                Math.hypot(best.x - player.x, best.y - player.y) ? e : best;
        }, enemies[0]);
        const ddx = nearest.x - player.x;
        const ddy = nearest.y - player.y;
        const dlen = Math.hypot(ddx, ddy);
        nearestDir = { x: ddx / dlen, y: ddy / dlen };
    }
    

    return {
        player,
        camera,
        playerHealth,
        playerMaxHealth: maxPlayerHealth,
        bullets,
        enemies,
        score,
        remHands, 
        discards,
        playedHand, 
        timeAlive: timeScore,
        hand,
        selected,
        activeIndex,
        playerSpeed,
        bulletDamage,
        bulletCountModifier,
        shootInterval,
        maxHands,
        maxDiscards,
        handRefresh,
        discardRefresh,
        maxHandSize,
        items,
        gameOver,
        paused,
        highScore,
        playerHitTimer,
        nearestDir,
        enemiesKilled,
        currentStreak,
        notifications
    };
}

export function restartGame() {
    gameOver = false;
    paused = false;
    playerSpeed = 200;
    bulletDamage = 25;
    bulletCountModifier = 1;
    shootInterval = 2;
    maxPlayerHealth = 100;
    maxHandSize = 7;
    maxHands = 5;
    maxDiscards = 3;
    handRefresh = 30;
    discardRefresh = 20;
    highScore = parseInt(localStorage.getItem("highScore") || "0");

    deck = shuffle(createDeck());
    hand = deck.splice(0, maxHandSize);
    sortHand();
    selected.clear();
    activeIndex = 0;
    enemies = [];
    bullets = [];
    items = [];
    score = 0;
    playerHealth = 100;
    discards = maxDiscards;
    remHands = maxHands;
    shootTimer = 0;
    startTime = performance.now();
    lastDiscardUpdate = 0;
    lastHandUpdate = 0;
    playedHand = "None!";
    gameStageModifier = 1;
    pausedAt = 0;
    totalPausedTime = 0;
    playerHitTimer = 0;
    enemiesKilled = 0;
    currentStreak = 0;
    notifications = [];
}