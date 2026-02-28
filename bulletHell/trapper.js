import { BasePlayerLogic } from "./logic.js";

const MINE_ARM_DELAY = 0.4;     
const MINE_DETECT_RADIUS = 38;  
const MINE_BASE_AOE = 80;     
const MINE_LIFETIME = 18;     
const MAX_MINES = 40;        

class TrapperLogic extends BasePlayerLogic {
    constructor() {
        super();
        this.bulletDamage   = 400;  
        this.shootInterval  = 1.2;  
        this.mines          = [];   
    }

    get playerChoice() { return "trapper"; }


    _shootBullet() {
        if (this.mines.length >= MAX_MINES) return;

        const aoeRadius = MINE_BASE_AOE + this.bulletCountModifier * 8;

        this.mines.push({
            x: this.player.x,
            y: this.player.y,
            armTimer: MINE_ARM_DELAY,  
            lifetime: MINE_LIFETIME,
            aoeRadius,
        });
    }

    updateLogic(delta) {
        super.updateLogic(delta);
        if (!this.paused && !this.gameOver) {
            this._updateMines(delta);
        }
    }

    _updateMines(delta) {
        const toExplode = [];

        this.mines = this.mines.filter(mine => {
            mine.lifetime -= delta;
            if (mine.lifetime <= 0) return false; 
            if (mine.armTimer > 0) {
                mine.armTimer -= delta;
                return true; 
            }

            for (const e of this.enemies) {
                if (Math.hypot(e.x - mine.x, e.y - mine.y) < MINE_DETECT_RADIUS + e.size) {
                    toExplode.push(mine);
                    return false; 
                }
            }
            return true;
        });

        for (const mine of toExplode) {
            this._explodeMine(mine);
        }
    }

    _explodeMine(mine) {
        const r = mine.aoeRadius;

        let killed = 0;
        this.enemies = this.enemies.filter(e => {
            if (Math.hypot(e.x - mine.x, e.y - mine.y) < r + e.size) {
                e.health -= this.bulletDamage;
                e.hitTimer = this.HIT_FLASH_DURATION;
                if (e.health <= 0) {
                    killed++;
                    this.enemiesKilled++;
                    this.currentStreak++;
                    if (this.currentStreak % 10 === 0)
                        this._addNotification(`${this.currentStreak} Kill Streak!`, "You're on fire!");
                    if (Math.random() < 0.30)
                        this.items.push({ x: e.x, y: e.y, type: Math.random() < 0.5 ? "powerup" : "apple" });
                    this._onEnemyDeath(e);
                    return false;
                }
            }
            return true;
        });

        const nearbyMines = this.mines.filter(m =>
            m.armTimer <= 0 &&
            Math.hypot(m.x - mine.x, m.y - mine.y) < r
        );
        this.mines = this.mines.filter(m =>
            !(m.armTimer <= 0 && Math.hypot(m.x - mine.x, m.y - mine.y) < r)
        );
        for (const m of nearbyMines) this._explodeMine(m);

        if (!this.invincible) {
            if (Math.hypot(this.player.x - mine.x, this.player.y - mine.y) < r) {
                this.playerHealth -= 15;
                this.playerHitTimer = this.HIT_FLASH_DURATION;
                this.currentStreak = 0;
                this.playerHealth = Math.max(0, this.playerHealth);
                if (this.playerHealth === 0) {
                    this.gameOver = true;
                    this.score *= this.gameStageModifier;
                    if (this.score > this.highScore) {
                        this.highScore = Math.floor(this.score);
                        localStorage.setItem("highScore", this.highScore);
                    }
                }
            }
        }

        const count = 20 + Math.floor(r / 10);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 200;
            this.particles.push({
                type: "explosion",
                x: mine.x + (Math.random() - 0.5) * 20,
                y: mine.y + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.35 + Math.random() * 0.45,
                maxLife: 0.8,
                size: 3 + Math.random() * 6,
            });
        }

        this.particles.push({
            type: "explosion_ring",
            x: mine.x,
            y: mine.y,
            vx: 0, vy: 0,
            life: 0.25,
            maxLife: 0.25,
            size: r,
        });

        if (killed > 1) {
            this._addNotification(`${killed}x Chain Kill!`, "CHAIN REACTION!");
        }
    }

    _onEnemyDeath(e) {
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 80;
            this.particles.push({
                x: e.x, y: e.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.3 + Math.random() * 0.2,
                maxLife: 0.5,
                size: 2 + Math.random() * 3,
            });
        }
    }

    getState() {
        const base = super.getState();
        return { ...base, mines: this.mines };
    }

    restartGame() {
        super.restartGame();
        this.mines = [];
    }
}

const instance = new TrapperLogic();

export const initLogic       = (c) => instance.initLogic(c);
export const updateLogic     = (d) => instance.updateLogic(d);
export const getState        = ()  => instance.getState();
export const restartGame     = ()  => instance.restartGame();
export const handleKeyDown   = (e) => instance.handleKeyDown(e);
export const handleKeyUp     = (e) => instance.handleKeyUp(e);
export const handleMouseMove = (e) => instance.handleMouseMove(e);
export const evaluateHand    = (c) => instance.evaluateHand(c);