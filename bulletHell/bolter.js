import { BasePlayerLogic } from "./logic.js";

const SHOOT_RADIUS = 600;

class BolterLogic extends BasePlayerLogic {
    constructor() {
        super();
        this.bulletDamage = 100;
        this.shootInterval = 3;
    }

    get playerChoice() { return "zapper"; }

    _shootBullet() {
        if (this.enemies.length === 0) return;
        const inRange = this.enemies.filter(e =>
            Math.hypot(e.x - this.player.x, e.y - this.player.y) < SHOOT_RADIUS
        );
        if (inRange.length === 0) return;

        for (let i = 0; i < this.bulletCountModifier; i++) {
            const target = inRange[Math.floor(Math.random() * inRange.length)];
            target.health -= this.bulletDamage;
            target.hitTimer = this.HIT_FLASH_DURATION;
            this.particles.push({
                type: "bolt",
                x1: this.player.x, y1: this.player.y,
                x2: target.x, y2: target.y,
                x: target.x, y: target.y,
                life: 0.1, maxLife: 0.1, vx: 0, vy: 0, size: 0
            });
        }
    }

    _onEnemyDeath(e) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 120;
            this.particles.push({
                x: e.x, y: e.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.4 + Math.random() * 0.3,
                maxLife: 0.7,
                size: 3 + Math.random() * 4,
            });
        }
    }
}

const instance = new BolterLogic();

export const initLogic     = (c) => instance.initLogic(c);
export const updateLogic   = (d) => instance.updateLogic(d);
export const getState      = ()  => instance.getState();
export const restartGame   = ()  => instance.restartGame();
export const handleKeyDown = (e) => instance.handleKeyDown(e);
export const handleKeyUp   = (e) => instance.handleKeyUp(e);
export const handleMouseMove = (e) => instance.handleMouseMove(e);
export const evaluateHand  = (c) => instance.evaluateHand(c);