import { BasePlayerLogic } from "./logic.js";

class ShooterLogic extends BasePlayerLogic {
    get playerChoice() { return "shooter"; }

    _shootBullet() {
        if (this.enemies.length === 0) return;
        let nearest = this.enemies.reduce((best, e) =>
            Math.hypot(e.x - this.player.x, e.y - this.player.y) <
            Math.hypot(best.x - this.player.x, best.y - this.player.y) ? e : best
        , this.enemies[0]);

        const dx = nearest.x - this.player.x;
        const dy = nearest.y - this.player.y;
        const len = Math.hypot(dx, dy);

        for (let i = 0; i < this.bulletCountModifier; i++) {
            const dir = (i % 2 === 0) ? -1 : 1;
            const spreadDx = dx + dir * i * 20;
            const spreadLen = Math.hypot(spreadDx, dy);
            const vx = (spreadDx / spreadLen) * this.BULLET_SPEED;
            const vy = (dy / spreadLen) * this.BULLET_SPEED;
    
            const px = -vy / this.BULLET_SPEED;
            const py =  vx / this.BULLET_SPEED;
        
            for (let t = 0; t <= 2; t++) {
                this.bullets.push({
                    x: this.player.x + px * t * 8,
                    y: this.player.y + py * t * 8,
                    vx, vy,
                    life: 2
                });
            }
        }
    }
}

const instance = new ShooterLogic();

export const initLogic     = (c) => instance.initLogic(c);
export const updateLogic   = (d) => instance.updateLogic(d);
export const getState      = ()  => instance.getState();
export const restartGame   = ()  => instance.restartGame();
export const handleKeyDown = (e) => instance.handleKeyDown(e);
export const handleKeyUp   = (e) => instance.handleKeyUp(e);
export const handleMouseMove = (e) => instance.handleMouseMove(e);
export const evaluateHand  = (c) => instance.evaluateHand(c);