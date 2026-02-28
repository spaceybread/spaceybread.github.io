export class BasePlayerLogic {
    constructor() {
        this.canvas = null;
        this.playerSpeed = 200;
        this.ENEMY_SPEED = 60;
        this.keys = {};
        this.player = null;
        this.camera = null;
        this.enemies = [];
        this.score = 0;
        this.startTime = 0;
        this.hand = [];
        this.deck = [];
        this.selected = new Set();
        this.activeIndex = 0;
        this.discards = 3;
        this.lastDiscardUpdate = 0;
        this.remHands = 5;
        this.lastHandUpdate = 0;
        this.playedHand = "None!";
        this.maxHandSize = 7;
        this.playerHealth = 100;
        this.bullets = [];
        this.mouseWorld = { x: 0, y: 0 };
        this.BULLET_SPEED = 750;
        this.bulletDamage = 40;
        this.enemyMaxHealth = 100;
        this.maxPlayerHealth = 100;
        this.bulletCountModifier = 1;
        this.maxHands = 5;
        this.maxDiscards = 3;
        this.handRefresh = 15;
        this.discardRefresh = 10;
        this.gameStageModifier = 1;
        this.shootTimer = 0;
        this.shootInterval = 1.5;
        this.items = [];
        this.gameOver = false;
        this.paused = false;
        this.highScore = parseInt(localStorage.getItem("highScore") || "0");
        this.pausedAt = 0;
        this.totalPausedTime = 0;
        this.playerHitTimer = 0;
        this.HIT_FLASH_DURATION = 0.15;
        this.enemiesKilled = 0;
        this.currentStreak = 0;
        this.draft = null;
        this.tempEffects = [];
        this.invincible = false;
        this.notifications = [];
        this.particles = [];
        this.enemyBullets = [];
        this.lasers = [];
        this._laserSpawnTimer = 0;
        this._bossTimer = 60;

        this.POWERUPS = [
            { name: "Speed Boost",   desc: "+50 speed for 10s",   apply: () => { this.playerSpeed += 50;      this._addTempEffect(() => this.playerSpeed -= 50, 10); } },
            { name: "Rapid Fire",    desc: "4x fire rate for 8s", apply: () => { this.shootInterval /= 4;     this._addTempEffect(() => this.shootInterval *= 4, 8); } },
            { name: "Double Damage", desc: "4x damage for 8s",    apply: () => { this.bulletDamage *= 4;      this._addTempEffect(() => this.bulletDamage /= 4, 8); } },
            { name: "Shield",        desc: "Invincible for 5s",   apply: () => {                              this._addTempEffect(() => {}, 5, true); } },
        ];
    }

    // ── must be overridden ──────────────────────────────────────────
    get playerChoice() { throw new Error("override playerChoice"); }
    _shootBullet() { throw new Error("override _shootBullet"); }

    // ── init ────────────────────────────────────────────────────────
    initLogic(canvas) {
        this.canvas = canvas;
        this.deck = this._shuffle(this._createDeck());
        this.hand = this.deck.splice(0, this.maxHandSize);
        this._sortHand();
        this.selected.clear();
        this.activeIndex = 0;
        this.player = { x: 0, y: 0, size: 16 };
        this.camera = { x: 0, y: 0 };
        this.enemies = [];
        this.score = 0;
        this.startTime = performance.now();
        this.playerHealth = 100;
        this.bullets = [];
        this.items = [];
    }

    handleKeyDown(e) {
        this.keys[e.key.toLowerCase()] = true;
        if (e.key.toLowerCase() === "h" && !this.gameOver) {
            this.paused = !this.paused;
            if (this.paused) {
                this.pausedAt = performance.now();
            } else {
                this.totalPausedTime += performance.now() - this.pausedAt;
            }
        }
        this._handleCardInput(e);
    }

    handleKeyUp(e) { this.keys[e.key.toLowerCase()] = false; }

    handleMouseMove(e) {
        this.mouseWorld.x = e.clientX + this.camera.x;
        this.mouseWorld.y = e.clientY + this.camera.y;
    }

    // ── update ──────────────────────────────────────────────────────
    updateLogic(delta) {
        if (this.paused || this.gameOver) return;

        let dx = 0, dy = 0;
        if (this.keys["w"]) dy -= 1;
        if (this.keys["s"]) dy += 1;
        if (this.keys["a"]) dx -= 1;
        if (this.keys["d"]) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            this.player.x += (dx / len) * this.playerSpeed * delta;
            this.player.y += (dy / len) * this.playerSpeed * delta;
            this.score += delta * 10;
        }

        this.shootTimer += delta;
        if (this.shootTimer >= this.shootInterval) {
            this.shootTimer = 0;
            this._shootBullet();
        }

        this.camera.x = this.player.x - this.canvas.width / 2;
        this.camera.y = this.player.y - this.canvas.height / 2;

        this.playerHitTimer = Math.max(0, this.playerHitTimer - delta);
        for (const e of this.enemies) {
            if (e.hitTimer > 0) e.hitTimer = Math.max(0, e.hitTimer - delta);
        }

        this.notifications = this.notifications.filter(n => { n.timer -= delta; return n.timer > 0; });
        this.tempEffects = this.tempEffects.filter(e => {
            e.timer -= delta;
            if (e.timer <= 0) { e.revert(); if (e.isShield) this.invincible = false; return false; }
            return true;
        });
        this.particles = this.particles.filter(p => {
            p.x += p.vx * delta; p.y += p.vy * delta;
            p.vx *= 0.92; p.vy *= 0.92;
            p.life -= delta;
            return p.life > 0;
        });

        this._spawnEnemies(delta);
        this._updateEnemies(delta);
        this._updateBullets(delta);
        this._checkPlayerEnemyCollision();
        this._updateLaserSpawning(delta);
        this._updateLasers(delta);
        this._updateBossSpawning(delta);
        this._checkItemPickup();
    }

    // ── state ───────────────────────────────────────────────────────
    getState() {
        let timeScore;
        if (this.paused || this.gameOver) {
            timeScore = (this.pausedAt - this.startTime - this.totalPausedTime) / 1000;
        } else {
            timeScore = (performance.now() - this.startTime - this.totalPausedTime) / 1000;
        }

        if (timeScore - this.lastDiscardUpdate > this.discardRefresh) {
            if (this.discards < this.maxDiscards) this.discards++;
            this.lastDiscardUpdate = timeScore;
        }
        if (timeScore - this.lastHandUpdate > this.handRefresh) {
            if (this.remHands < this.maxHands) this.remHands++;
            this.lastHandUpdate = timeScore;
        }

        this.gameStageModifier = 1 + Math.floor(timeScore / 7.5) / 20;

        let nearestDir = null;
        if (this.enemies.length > 0) {
            const nearest = this.enemies.reduce((best, e) =>
                Math.hypot(e.x - this.player.x, e.y - this.player.y) <
                Math.hypot(best.x - this.player.x, best.y - this.player.y) ? e : best
            , this.enemies[0]);
            const ddx = nearest.x - this.player.x;
            const ddy = nearest.y - this.player.y;
            const dlen = Math.hypot(ddx, ddy);
            nearestDir = { x: ddx / dlen, y: ddy / dlen };
        }

        return {
            player: this.player, camera: this.camera,
            playerHealth: this.playerHealth, playerMaxHealth: this.maxPlayerHealth,
            bullets: this.bullets, enemies: this.enemies,
            score: this.score, remHands: this.remHands, discards: this.discards,
            playedHand: this.playedHand, timeAlive: timeScore,
            hand: this.hand, selected: this.selected, activeIndex: this.activeIndex,
            playerSpeed: this.playerSpeed, bulletDamage: this.bulletDamage,
            bulletCountModifier: this.bulletCountModifier, shootInterval: this.shootInterval,
            maxHands: this.maxHands, maxDiscards: this.maxDiscards,
            handRefresh: this.handRefresh, discardRefresh: this.discardRefresh,
            maxHandSize: this.maxHandSize, items: this.items,
            gameOver: this.gameOver, paused: this.paused, highScore: this.highScore,
            playerHitTimer: this.playerHitTimer, nearestDir,
            enemiesKilled: this.enemiesKilled, currentStreak: this.currentStreak,
            notifications: this.notifications, draft: this.draft,
            invincible: this.invincible,
            tempEffects: this.tempEffects.map(e => ({ timer: e.timer, isShield: e.isShield })),
            particles: this.particles,
            playerChoice: this.playerChoice,
            enemyBullets: this.enemyBullets,
            lasers: this.lasers,
        };
    }

    restartGame() {
        this.gameOver = false;
        this.paused = false;
        this.playerSpeed = 200;
        this.bulletDamage = 40;
        this.bulletCountModifier = 1;
        this.shootInterval = 1.5;
        this.maxPlayerHealth = 100;
        this.maxHandSize = 7;
        this.maxHands = 5;
        this.maxDiscards = 3;
        this.handRefresh = 15;
        this.discardRefresh = 10;
        this.highScore = parseInt(localStorage.getItem("highScore") || "0");
        this.deck = this._shuffle(this._createDeck());
        this.hand = this.deck.splice(0, this.maxHandSize);
        this._sortHand();
        this.selected.clear();
        this.activeIndex = 0;
        this.enemies = [];
        this.bullets = [];
        this.items = [];
        this.particles = [];
        this.score = 0;
        this.playerHealth = 100;
        this.discards = this.maxDiscards;
        this.remHands = this.maxHands;
        this.shootTimer = 0;
        this.startTime = performance.now();
        this.lastDiscardUpdate = 0;
        this.lastHandUpdate = 0;
        this.playedHand = "None!";
        this.gameStageModifier = 1;
        this.pausedAt = 0;
        this.totalPausedTime = 0;
        this.playerHitTimer = 0;
        this.enemiesKilled = 0;
        this.currentStreak = 0;
        this.notifications = [];
        this.draft = null;
        this.tempEffects = [];
        this.enemyBullets = [];
        this.lasers = [];
        this._laserSpawnTimer = 0;
        this.invincible = false;
        this._bossTimer = 60;

    }

    // ── private helpers ─────────────────────────────────────────────
    _createDeck() {
        const suits = ["♠", "♥", "♦", "♣"];
        const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
        const values = [14,2,3,4,5,6,7,8,9,10,11,12,13];
        const deck = [];
        for (const suit of suits)
            for (let i = 0; i < ranks.length; i++)
                deck.push({ suit, rank: ranks[i], value: values[i] });
        return deck;
    }

    _shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    _sortHand() { this.hand.sort((a, b) => b.value - a.value); }

    _addNotification(title, subtitle) {
        this.notifications.push({ title, subtitle, timer: 2.5 });
    }

    _addTempEffect(revert, duration, isShield = false) {
        if (isShield) this.invincible = true;
        this.tempEffects.push({ revert, timer: duration, isShield });
    }

    _handleCardInput(e) {
        if (this.gameOver) return;

        if (this.draft) {
            if (e.key === "ArrowRight") this.draft.activeIndex = (this.draft.activeIndex + 1) % 3;
            if (e.key === "ArrowLeft")  this.draft.activeIndex = (this.draft.activeIndex + 2) % 3;
            if (e.key === "Enter") {
                this.hand.push(this.draft.cards[this.draft.activeIndex]);
                this._sortHand();
                this.draft = null;
                this.paused = false;
            }
            return;
        }

        if (this.paused || this.hand.length === 0) return;

        if (e.key === "ArrowRight") this.activeIndex = (this.activeIndex + 1) % this.hand.length;
        if (e.key === "ArrowLeft")  this.activeIndex = (this.activeIndex - 1 + this.hand.length) % this.hand.length;
        if (e.key === "ArrowUp")    this.selected.add(this.activeIndex);
        if (e.key === "ArrowDown")  this.selected.delete(this.activeIndex);

        if (e.key === "Enter") {
            const selectedCards = [...this.selected].map(i => this.hand[i]);
            if (selectedCards.length !== 5) {
                this._addNotification("Invalid Hand!", `Select ${5 - selectedCards.length} more cards!`);
                return;
            }
            if (this.remHands === 0) {
                this._addNotification("No Hands!", `Wait ${((this.lastHandUpdate + this.handRefresh) - ((performance.now() - this.startTime) / 1000)).toFixed(2)}s!`);
                return;
            }
            this._scoreSelectedCards(selectedCards);
            this._discardSelected(false);
            this._sortHand();
            this.remHands--;
        }

        if (e.key === "Shift") {
            this._discardSelected(true);
            this._sortHand();
        }
    }

    _discardSelected(isCounted) {
        if (this.discards === 0 && isCounted) {
            this._addNotification("No Discards", `Wait ${((this.lastDiscardUpdate + this.discardRefresh) - ((performance.now() - this.startTime) / 1000)).toFixed(2)}s!`);
            return;
        }
        const newHand = this.hand.filter((_, i) => !this.selected.has(i));
        if (newHand.length === this.hand.length) return;
        if (isCounted) this.discards--;
        const needed = this.maxHandSize - newHand.length;
        for (let i = 0; i < needed; i++) {
            if (this.deck.length === 0) this.deck = this._shuffle(this._createDeck());
            newHand.push(this.deck.pop());
        }
        this.hand = newHand;
        this.selected.clear();
        this.activeIndex = 0;
    }

    evaluateHand(cards) {
        cards = [...cards].sort((a, b) => b.value - a.value);
        const isFlush = cards.every(c => c.suit === cards[0].suit);
        let isStraight = true;
        if (cards[0].value === 14 && cards[1].value === 5) {
            isStraight = cards[2].value === 4 && cards[3].value === 3 && cards[4].value === 2;
        } else {
            for (let i = 1; i < cards.length; i++)
                if (cards[0].value - cards[i].value !== i) { isStraight = false; break; }
        }
        if (isStraight && isFlush) return cards[0].value === 14 && cards[4].value === 10 ? "Royal Flush" : "Straight Flush";
        const freq = {};
        cards.forEach(c => freq[c.value] = (freq[c.value] || 0) + 1);
        const counts = Object.values(freq);
        const unique = counts.length;
        if (unique === 2) return counts.includes(4) ? "Four of a Kind" : "Full House";
        if (isFlush) return "Flush";
        if (isStraight) return "Straight";
        if (unique === 3) return counts.includes(3) ? "Three of a Kind" : "Two Pair";
        if (unique === 4) return "Pair";
        return "High Card";
    }

    _scoreSelectedCards(cards) {
        cards = [...cards].sort((a, b) => b.value - a.value);
        const result = this.evaluateHand(cards);
        this.playedHand = result;
        const freq = {};
        cards.forEach(c => freq[c.value] = (freq[c.value] || 0) + 1);

        switch (result) {
            case "Royal Flush":
                this.score += this.enemies.length * 256;
                this.maxHandSize += 2;
                this.bulletCountModifier += cards[4].value;
                this.shootInterval = Math.max(0.1, this.shootInterval - 0.4);
                this.enemies = [];
                this._addNotification("Royal Flush", "Screen cleared · +2 hand size · +bullets · +fire rate");
                break;
            case "Straight Flush":
                this.score += this.enemies.length * 16;
                this.enemies = [];
                this._addNotification("Straight Flush", "Screen cleared · score bonus");
                break;
            case "Four of a Kind":
                this.maxHandSize += 1;
                this._addNotification("Four of a Kind", "+1 hand size");
                break;
            case "Full House":
                if (cards[0].value === cards[2].value) {
                    this.discardRefresh = Math.max(1, this.discardRefresh - Math.ceil(cards[4].value / 5));
                    this.handRefresh = Math.max(2, this.handRefresh - Math.ceil(cards[4].value / 5));
                    this._addNotification("Full House", "Faster hand & discard refresh");
                } else {
                    this.maxDiscards++;
                    this.maxHands++;
                    this._addNotification("Full House", "+1 max hands · +1 max discards");
                }
                break;
            case "Flush":
                this.maxPlayerHealth += cards[0].value;
                this._addNotification("Flush", `+${cards[0].value} max health`);
                break;
            case "Straight":
                this.bulletCountModifier += cards[4].value;
                this._addNotification("Straight", `+${cards[4].value} bullet count`);
                break;
            case "Three of a Kind":
                this.bulletDamage *= 1 + Math.ceil(cards[0].value / 2) / 10;
                this._addNotification("Three of a Kind", `x${(1 + Math.ceil(cards[0].value / 2) / 10).toFixed(2)} bullet damage`);
                break;
            case "Two Pair": {
                let ct = cards[0].value;
                if (freq[ct] === 1) ct = cards[1].value;
                this.playerSpeed += ct;
                this._addNotification("Two Pair", `+${ct} player speed`);
                break;
            }
            case "Pair": {
                const pairCard = cards.find(c => freq[c.value] === 2);
                this.shootInterval = Math.max(0.1, this.shootInterval - 0.02 * pairCard.value);
                this._addNotification("Pair", `-${(0.01 * pairCard.value).toFixed(2)}s fire rate`);
                break;
            }
            case "High Card":
                this.playerHealth = Math.min(this.maxPlayerHealth, this.playerHealth + cards[0].value);
                this._addNotification("High Card", `+${cards[0].value} health`);
                break;
        }
        const suitCounts = { "♥": 0, "♠": 0, "♣": 0, "♦": 0 };
        for (const card of cards) suitCounts[card.suit]++;
    
        const hearts   = suitCounts["♥"];
        const spades   = suitCounts["♠"];
        const clubs    = suitCounts["♣"];
        const diamonds = suitCounts["♦"];
    
        if (hearts)   this.playerHealth = Math.min(this.maxPlayerHealth, this.playerHealth + hearts);
        if (spades)   this.bulletDamage += spades;
        if (clubs)    this.shootInterval = Math.max(0.1, this.shootInterval - clubs * 0.05);
        if (diamonds) this.playerSpeed += diamonds;
    
        const parts = [];
        if (hearts)   parts.push(`♥ +${hearts} HP`);
        if (spades)   parts.push(`♠ +${spades} dmg`);
        if (clubs)    parts.push(`♣ -${clubs * 0.05}s fire`);
        if (diamonds) parts.push(`♦ +${diamonds} spd`);
        if (parts.length > 0)
            this._addNotification("Suit Bonus", parts.join(" · "));
    }

    _spawnEnemies(delta) {
        if (Math.random() < delta * 1.5 * this.gameStageModifier) {
            const angle = Math.random() * Math.PI * 2;
            const roll = Math.random();
            const base = {
                x: this.player.x + Math.cos(angle) * 800,
                y: this.player.y + Math.sin(angle) * 800,
                hitTimer: 0,
            };
    
            if (roll < 0.5) {
                // weak ass
                this.enemies.push({ ...base, type: "normal", size: 14,
                    health: this.enemyMaxHealth * this.gameStageModifier,
                    maxHealth: this.enemyMaxHealth * this.gameStageModifier });
            } else if (roll < 0.7) {
                // aura farmer
                const hp = this.enemyMaxHealth * 5 * this.gameStageModifier;
                this.enemies.push({ ...base, type: "tank", size: 26,
                    health: hp, maxHealth: hp, auraRadius: 180 });
            } else if (roll < 0.9) {
                // glass cannon
                this.enemies.push({ ...base, type: "shooter", size: 9,
                    health: 1, maxHealth: 1, shootTimer: 0,
                    shootInterval: 2.5 + Math.random() * 1.5 });
            }
        }
    }

    _updateLaserSpawning(delta) {
        const currentTime = (performance.now() - this.startTime - this.totalPausedTime) / 1000;
    
        if (currentTime < 5) return;
    
        this._laserSpawnTimer += delta;
    
        let laserInterval = Math.max(
            15,
            40 - Math.floor((currentTime - 100) / 30) * 5
        );

        laserInterval = 15; 
    
        if (this._laserSpawnTimer >= laserInterval) {
            this._laserSpawnTimer = 0;
            this._spawnLaser();
        }
    }

    _updateBossSpawning(delta) {
        this._bossTimer -= delta;
        let c = 1; 
        if ((performance.now() - this.startTime) / 1000 > 300) c = 2; 
        
        if (this._bossTimer <= 0) {
            for (; c > 0; c--) {
                this._bossTimer = 60;
                this._spawnBoss();
            }
        }
    }
    
    _spawnBoss() {
        const angle = Math.random() * Math.PI * 2;
        const hp = 800 * this.gameStageModifier;
        this.enemies.push({
            type: "boss",
            x: this.player.x + Math.cos(angle) * 900,
            y: this.player.y + Math.sin(angle) * 900,
            size: 32,
            health: hp,
            maxHealth: hp,
            hitTimer: 0,
            shootTimer: 0,
            shootInterval: 2.2,
            bulletCount: 16,
        });
        this._addNotification("⚠ BOSS INCOMING", "Triangular terror approaches!");
    }

    _updateEnemies(delta) {
        let inAura = false;
        for (const e of this.enemies) {
            if (e.type === "tank") {
                if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < e.auraRadius) {
                    inAura = true;
                }
            }
        }
        this._inTankAura = inAura;
    
        for (const e of this.enemies) {
            const dx = this.player.x - e.x;
            const dy = this.player.y - e.y;
            const len = Math.hypot(dx, dy);
            const speed = e.type === "tank" ? this.ENEMY_SPEED * 0.35 : this.ENEMY_SPEED;
    
            e.x += (dx / len) * speed * this.gameStageModifier * delta;
            e.y += (dy / len) * speed * this.gameStageModifier * delta;
    
            if (e.type === "shooter") {
                e.shootTimer += delta;
                if (e.shootTimer >= e.shootInterval) {
                    e.shootTimer = 0;
                    const spread = (Math.random() - 0.5) * 1.2;
                    const aimAngle = Math.atan2(dy, dx) + spread;
                    const ENEMY_BULLET_SPEED = 220;
                    this.enemyBullets.push({
                        x: e.x, y: e.y,
                        vx: Math.cos(aimAngle) * ENEMY_BULLET_SPEED,
                        vy: Math.sin(aimAngle) * ENEMY_BULLET_SPEED,
                        life: 4,
                    });
                }
            }

            if (e.type === "boss") {
                e.shootTimer += delta;
                if (e.shootTimer >= e.shootInterval) {
                    e.shootTimer = 0;
                    const count = e.bulletCount;
                    for (let i = 0; i < count; i++) {
                        const a = (i / count) * Math.PI * 2;
                        const SPEED = 180;
                        this.enemyBullets.push({
                            x: e.x, y: e.y,
                            vx: Math.cos(a) * SPEED,
                            vy: Math.sin(a) * SPEED,
                            life: 5,
                            isBoss: true,
                        });
                    }
                }
            }
        }
    }

    _spawnLaser() {
        const angle = Math.random() * Math.PI;
        const WARNING_DURATION = 2.0;
        const ACTIVE_DURATION = 0.3;
        const HALF_LEN = 2000;
    
        const cx = this.player.x + (Math.random() - 0.5) * 600;
        const cy = this.player.y + (Math.random() - 0.5) * 600;
    
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
    
        this.lasers.push({
            x1: cx - cos * HALF_LEN,
            y1: cy - sin * HALF_LEN,
            x2: cx + cos * HALF_LEN,
            y2: cy + sin * HALF_LEN,
            cx, cy, cos, sin,
            halfLen: HALF_LEN,
            width: 28,
            phase: "warning",
            timer: WARNING_DURATION,
            warningDuration: WARNING_DURATION,
            activeDuration: ACTIVE_DURATION,
        });
    }
    
    _updateLasers(delta) {
        this.lasers = this.lasers.filter(laser => {
            laser.timer -= delta;
    
            if (laser.phase === "warning" && laser.timer <= 0) {
                laser.phase = "active";
                laser.timer = laser.activeDuration;
    
                this.enemies = this.enemies.filter(e => {
                    const dx = e.x - laser.cx;
                    const dy = e.y - laser.cy;
                    const proj = dx * laser.cos + dy * laser.sin;
                    const perpDist = Math.abs(dx * laser.sin - dy * laser.cos);
                    if (perpDist < laser.width / 2 + e.size && Math.abs(proj) < laser.halfLen) {
                        this._onEnemyDeath(e);
                        return false;
                    }
                    return true;
                });
    
                this.enemyBullets = this.enemyBullets.filter(b => {
                    const dx = b.x - laser.cx;
                    const dy = b.y - laser.cy;
                    const perpDist = Math.abs(dx * laser.sin - dy * laser.cos);
                    return perpDist >= laser.width / 2;
                });
    
                if (!this.invincible) {
                    const dx = this.player.x - laser.cx;
                    const dy = this.player.y - laser.cy;
                    const perpDist = Math.abs(dx * laser.sin - dy * laser.cos);
                    if (perpDist < laser.width / 2 + this.player.size / 2) {
                        this.playerHealth = 0; // instant kill
                        this.playerHitTimer = this.HIT_FLASH_DURATION;
                    }
                }
            }
    
            return laser.timer > 0;
        });
    }

    _updateBullets(delta) {
        // player bullets
        for (const b of this.bullets) {
            b.x += b.vx * delta; b.y += b.vy * delta; b.life -= delta;
        }
        for (const b of this.bullets) {
            for (const e of this.enemies) {
                if (Math.hypot(b.x - e.x, b.y - e.y) < e.size) {
                    e.health -= this.bulletDamage;
                    e.hitTimer = this.HIT_FLASH_DURATION;
                    b.life = 0;
                }
            }
        }
        this.bullets = this.bullets.filter(b => b.life > 0);
        this.enemies = this.enemies.filter(e => {
            if (e.health <= 0) {
                this.enemiesKilled++;
                this.currentStreak++;
                if (e.type === "boss") {
                    this._addNotification("BOSS DEFEATED!", "★ +1000 score bonus · +1 hand size");
                    this.maxHandSize += 1; 
                }
                if (this.currentStreak % 10 === 0)
                    this._addNotification(`${this.currentStreak} Kill Streak!`, "You're on fire!");
                if (Math.random() < 0.30)
                    this.items.push({ x: e.x, y: e.y, type: Math.random() < 0.5 ? "powerup" : "apple" });
                this._onEnemyDeath(e);
                return false;
            }
            return true;
        });
        // enemy bullets
        for (const b of this.enemyBullets) {
            b.x += b.vx * delta; b.y += b.vy * delta; b.life -= delta;
        }
        if (!this.invincible) {
            for (const b of this.enemyBullets) {
                if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < this.player.size) {
                    this.playerHealth -= 10;
                    this.playerHitTimer = this.HIT_FLASH_DURATION;
                    this.currentStreak = 0;
                    b.life = 0;
                }
            }
        }
        this.enemyBullets = this.enemyBullets.filter(b => b.life > 0);
    }

    // subclasses can override for death effects
    _onEnemyDeath(e) {}

    _openDraft() {
        const tempDeck = this._shuffle(this._createDeck());
        this.draft = { cards: tempDeck.slice(0, 3), activeIndex: 0 };
        this.paused = true;
    }

    _applyPowerup() {
        const p = this.POWERUPS[Math.floor(Math.random() * this.POWERUPS.length)];
        p.apply();
        this._addNotification(p.name, p.desc);
    }

    _checkPlayerEnemyCollision() {
        
        if (!this._basePlayerSpeed) this._basePlayerSpeed = this.playerSpeed;
        const targetSpeed = this._inTankAura
            ? this._basePlayerSpeed * 0.9
            : this._basePlayerSpeed;
        
        this.playerSpeed += (targetSpeed - this.playerSpeed) * 0.15;
    
        for (const e of this.enemies) {
            const dx = this.player.x - e.x;
            const dy = this.player.y - e.y;
            if (Math.hypot(dx, dy) < this.player.size / 2 + e.size) {
                if (!this.invincible) {
                    this.playerHealth -= 20;
                    this.playerHitTimer = this.HIT_FLASH_DURATION;
                    this.currentStreak = 0;
                }
                const len = Math.hypot(dx, dy);
                e.x -= (dx / len) * 30;
                e.y -= (dy / len) * 30;
            }
        }
        this.playerHealth = Math.max(0, this.playerHealth);
        if (this.playerHealth === 0) {
            this.gameOver = true;
            this.score *= this.gameStageModifier;
            if (this.score > this.highScore) {
                this.highScore = Math.floor(this.score);
                localStorage.setItem("highScore", this.highScore);
            }
            const timeKey = `bestTime_${this.playerChoice}`;
            const prevBest = parseFloat(localStorage.getItem(timeKey) || "0");
            const currentTime = (this.pausedAt - this.startTime - this.totalPausedTime) / 1000;
            if (currentTime > prevBest) {
                localStorage.setItem(timeKey, currentTime.toFixed(1));
            }
        }
    }

    _checkItemPickup() {
        this.items = this.items.filter(item => {
            if (Math.hypot(item.x - this.player.x, item.y - this.player.y) < this.player.size + 10) {
                if (item.type === "apple") {
                    this.playerHealth = Math.min(this.maxPlayerHealth, this.playerHealth + 20);
                    this._addNotification("Apple!", "+20 health");
                } else if (item.type === "draft") {
                    this._openDraft();
                } else if (item.type === "powerup") {
                    this._applyPowerup();
                }
                return false;
            }
            return true;
        });
    }
}