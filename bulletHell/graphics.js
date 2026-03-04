import { BasePlayerLogic } from "./logic.js";

import { 
    SHOP_ITEMS, 
    getOwnedLevels, 
    buyItem, 
    resetShop 
} from "./shop.js";

const _evalInstance = new BasePlayerLogic();
const evaluateHand = (cards) => _evalInstance.evaluateHand(cards);


let canvas, ctx;

const TILE_SIZE = 48;

let grassTile, darkGrassTile, dirtTile, stoneTile;

let mouse = {
    x: 0,
    y: 0
};

window.addEventListener("mousemove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

export function initGraphics(c, context) {
    canvas = c;
    ctx = context;

    grassTile     = createTileTexture(["#2e7d32", "#388e3c", "#1b5e20", "#33691e", "#2e7d32"], { type: "grass" });
    darkGrassTile = createTileTexture(["#1b5e20", "#0f3d13", "#1a4a10", "#163d0f"], { type: "darkgrass" });
    dirtTile      = createTileTexture(["#6d4c41", "#5d4037", "#795548", "#4e342e"], { type: "dirt" });
    stoneTile     = createTileTexture(["#757575", "#616161", "#9e9e9e", "#6d6d6d", "#555"], { type: "stone" });
}

function rnd(min, max) { return min + Math.random() * (max - min); }
function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }

function createTileTexture(colors, options = {}) {
    const size = 48;
    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;

    for (let x = 0; x < size; x += 2) {
        for (let y = 0; y < size; y += 2) {
            octx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            octx.fillRect(x, y, 2, 2);
        }
    }

    const type = options.type || "grass";

    if (type === "grass") {
        const tuftCount = rndInt(3, 6);
        for (let i = 0; i < tuftCount; i++) {
            const tx = rndInt(4, size - 6);
            const ty = rndInt(8, size - 4);
            const h = rndInt(3, 7);
            octx.fillStyle = Math.random() < 0.5 ? "rgba(80,160,40,0.55)" : "rgba(20,80,10,0.5)";
            octx.fillRect(tx, ty - h, 2, h);
            if (Math.random() < 0.5) {
                octx.fillRect(tx + (Math.random() < 0.5 ? -2 : 2), ty - h + 2, 2, h - 2);
            }
        }
        if (Math.random() < 0.25) {
            octx.fillStyle = Math.random() < 0.5 ? "rgba(255,220,80,0.7)" : "rgba(255,255,255,0.5)";
            const fx = rndInt(6, size - 6);
            const fy = rndInt(6, size - 6);
            octx.fillRect(fx, fy, 2, 2);
        }
    }

    if (type === "darkgrass") {
        const patchCount = rndInt(2, 4);
        for (let i = 0; i < patchCount; i++) {
            const px = rndInt(4, size - 10);
            const py = rndInt(4, size - 10);
            const pw = rndInt(4, 10);
            const ph = rndInt(3, 7);
            octx.fillStyle = "rgba(10,50,8,0.45)";
            octx.fillRect(px, py, pw, ph);
        }
        for (let i = 0; i < rndInt(2, 4); i++) {
            const tx = rndInt(4, size - 4);
            const ty = rndInt(6, size - 2);
            octx.fillStyle = "rgba(30,100,15,0.6)";
            octx.fillRect(tx, ty - rndInt(2, 5), 2, rndInt(2, 5));
        }
    }

    if (type === "dirt") {
        const pebbleCount = rndInt(3, 7);
        for (let i = 0; i < pebbleCount; i++) {
            const px = rndInt(4, size - 6);
            const py = rndInt(4, size - 6);
            const pw = rndInt(3, 7);
            const ph = rndInt(2, 4);
            octx.fillStyle = Math.random() < 0.5
                ? "rgba(80,55,40,0.5)"
                : "rgba(120,90,60,0.4)";
            octx.fillRect(px, py, pw, ph);
            octx.fillStyle = "rgba(200,160,110,0.25)";
            octx.fillRect(px, py, pw - 1, 1);
        }
        if (Math.random() < 0.5) {
            octx.strokeStyle = "rgba(60,40,25,0.4)";
            octx.lineWidth = 1;
            octx.beginPath();
            const cx = rndInt(8, size - 8);
            const cy = rndInt(8, size - 8);
            octx.moveTo(cx, cy);
            octx.lineTo(cx + rndInt(-10, 10), cy + rndInt(4, 10));
            octx.stroke();
        }
    }

    if (type === "stone") {
        const blockW = rndInt(16, 28);
        const blockH = rndInt(12, 20);
        const offX = rndInt(0, blockW);
        const offY = rndInt(0, blockH);
        octx.strokeStyle = "rgba(40,40,40,0.5)";
        octx.lineWidth = 1;
        for (let y = (offY % blockH); y < size; y += blockH) {
            octx.beginPath(); octx.moveTo(0, y); octx.lineTo(size, y); octx.stroke();
        }
        for (let row = 0; row * blockH < size + blockH; row++) {
            const rowOffX = row % 2 === 0 ? offX : offX + blockW / 2;
            for (let x = (rowOffX % blockW) - blockW; x < size + blockW; x += blockW) {
                const y0 = row * blockH + offY % blockH;
                octx.beginPath(); octx.moveTo(x, y0); octx.lineTo(x, y0 + blockH); octx.stroke();
            }
        }
        if (Math.random() < 0.6) {
            octx.strokeStyle = "rgba(20,20,20,0.35)";
            octx.lineWidth = 1;
            const cx = rndInt(10, size - 10);
            const cy = rndInt(10, size - 10);
            octx.beginPath();
            octx.moveTo(cx, cy);
            octx.lineTo(cx + rndInt(-8, 8), cy + rndInt(-8, 8));
            octx.lineTo(cx + rndInt(-4, 12), cy + rndInt(4, 14));
            octx.stroke();
        }
        octx.fillStyle = "rgba(255,255,255,0.06)";
        octx.fillRect(0, 0, size, 2);
        octx.fillRect(0, 0, 2, size);
    }

    octx.fillStyle = "rgba(0,0,0,0.12)";
    for (let i = 0; i < 14; i++) {
        octx.fillRect(rndInt(0, size - 1), rndInt(0, size - 1), rndInt(1, 3), 1);
    }
    octx.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 7; i++) {
        octx.fillRect(rndInt(0, size - 1), rndInt(0, size - 1), 1, 1);
    }

    octx.strokeStyle = "rgba(0,0,0,0.20)";
    octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(0, 0); octx.lineTo(size, 0);
    octx.moveTo(0, 0); octx.lineTo(0, size);
    octx.stroke();
    octx.strokeStyle = "rgba(255,255,255,0.05)";
    octx.beginPath();
    octx.moveTo(size - 1, 0); octx.lineTo(size - 1, size);
    octx.moveTo(0, size - 1); octx.lineTo(size, size - 1);
    octx.stroke();

    return off;
}

function random2D(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function smoothNoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const sx = x - x0;
    const sy = y - y0;

    const n0 = random2D(x0, y0);
    const n1 = random2D(x1, y0);
    const ix0 = lerp(n0, n1, sx);

    const n2 = random2D(x0, y1);
    const n3 = random2D(x1, y1);
    const ix1 = lerp(n2, n3, sx);

    return lerp(ix0, ix1, sy);
}

export function drawWorld(camera) {
    const startX = Math.floor(camera.x / TILE_SIZE) - 1;
    const startY = Math.floor(camera.y / TILE_SIZE) - 1;

    const endX = startX + Math.ceil(canvas.width / TILE_SIZE) + 3;
    const endY = startY + Math.ceil(canvas.height / TILE_SIZE) + 3;

    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
            const noise = smoothNoise(x * 0.1, y * 0.1);

            let texture;
            if (noise < 0.1) texture = stoneTile;   
            else if (noise < 0.35) texture = dirtTile;
            else if (noise < 0.6) texture = darkGrassTile;
            else texture = grassTile;

            ctx.drawImage(
                texture,
                x * TILE_SIZE - camera.x,
                y * TILE_SIZE - camera.y,
                TILE_SIZE,
                TILE_SIZE
            );

            if (noise < 0.1) {
                ctx.fillStyle = "rgba(0,0,0,0.18)";
                ctx.fillRect(x * TILE_SIZE - camera.x, y * TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}

export function drawPlayer(player, camera, state) {
    const sx = player.x - camera.x;
    const sy = player.y - camera.y;
    const s = player.size;
    const now = performance.now() * 0.001;
    const hit = state.playerHitTimer > 0;
    const choice = state.playerChoice || "shooter";

    const palette = {
        shooter: { body: "#c0392b", accent: "#e74c3c", glow: "#ff6644", visor: "#c0392b" },
        zapper:  { body: "#1a237e", accent: "#3949ab", glow: "#66aaff", visor: "#1a237e" },
        trapper: { body: "#1b5e20", accent: "#388e3c", glow: "#44ff88", visor: "#1b5e20" },
    };
    const pal = palette[choice] || palette.shooter;

    const bob = Math.sin(now * 3.2) * 1.8;
    const tiltX = Math.sin(now * 2.1) * 0.03;

    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.rotate(tiltX);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(-s / 2 + 4, -s / 2 + 4, s, s);

    if (!hit) {
        const glowAlpha = 0.18 + 0.08 * Math.sin(now * 2.5);
        ctx.globalAlpha = glowAlpha;
        ctx.fillStyle = pal.glow;
        ctx.fillRect(-s / 2 - 4, -s / 2 - 4, s + 8, s + 8);
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = hit ? "#ffffff" : pal.body;
    ctx.fillRect(-s / 2, -s / 2, s, s);

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(-s / 2, -s / 2, s, 2);
    ctx.fillRect(-s / 2, -s / 2, 2, s);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(-s / 2, s / 2 - 2, s, 2);
    ctx.fillRect(s / 2 - 2, -s / 2, 2, s);

    ctx.fillStyle = hit ? "rgba(255,255,255,0.5)" : pal.accent;
    ctx.fillRect(-s / 2 + 3, -s / 2 + 3, s - 6, 5);

    const vw = Math.floor(s * 0.55);
    const vh = Math.floor(s * 0.18);
    const vx = -Math.floor(vw / 2);
    const vy = -Math.floor(s * 0.05);
    ctx.fillStyle = hit ? "#ffffff" : pal.visor;
    ctx.fillRect(vx, vy, vw, vh);
    if (!hit) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillRect(vx + 2, vy + 1, Math.floor(vw * 0.35), 1);
    }

    if (choice === "shooter") {
        if (state.nearestDir) {
            const angle = Math.atan2(state.nearestDir.y, state.nearestDir.x);
            ctx.save();
            ctx.rotate(angle);
            ctx.fillStyle = hit ? "white" : "#888888";
            ctx.fillRect(Math.floor(s * 0.3), -3, Math.floor(s * 0.38), 6);
            ctx.fillStyle = hit ? "white" : "#444444";
            ctx.fillRect(Math.floor(s * 0.55), -4, Math.floor(s * 0.2), 8);
            ctx.fillStyle = "rgba(255,255,255,0.3)";
            ctx.fillRect(Math.floor(s * 0.55), -4, Math.floor(s * 0.2), 2);
            ctx.restore();
        }
    } else if (choice === "zapper") {
        ctx.fillStyle = hit ? "white" : "#aaaaaa";
        ctx.fillRect(-2, -s / 2 - 9, 3, 9);
        const orbSize = Math.sin(now * 6) > 0 ? 7 : 5;
        const ox = -Math.floor(orbSize / 2);
        const oy = -s / 2 - 9 - orbSize;
        ctx.fillStyle = hit ? "white" : pal.visor;
        ctx.fillRect(ox, oy, orbSize, orbSize);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(ox, oy, orbSize, 1);
        ctx.fillRect(ox, oy, 1, orbSize);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(ox, oy + orbSize - 1, orbSize, 1);
    } else if (choice === "trapper") {
        const dotOn = Math.sin(now * 4) > 0;
        ctx.fillStyle = hit ? "white" : (dotOn ? pal.visor : pal.accent);
        ctx.fillRect(-s / 2 - 5, -2, 4, 4);
        ctx.fillRect( s / 2 + 1, -2, 4, 4);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(-s / 2 - 5, -2, 4, 4);
        ctx.strokeRect( s / 2 + 1, -2, 4, 4);
    }

    ctx.strokeStyle = hit ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-s / 2, -s / 2, s, s);

    ctx.restore();

    if (state.nearestDir) {
        const tipDist = s / 2 + bob + 14;
        const angle = Math.atan2(state.nearestDir.y, state.nearestDir.x);
        const ax = sx + state.nearestDir.x * tipDist;
        const ay = sy + bob + state.nearestDir.y * tipDist;

        ctx.save();
        ctx.fillStyle = hit ? "white" : pal.glow;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + Math.cos(angle + 2.4) * 7, ay + Math.sin(angle + 2.4) * 7);
        ctx.lineTo(ax + Math.cos(angle - 2.4) * 7, ay + Math.sin(angle - 2.4) * 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}


export function drawEnemies(enemies, camera) {
    for (const e of enemies) {
        const sx = e.x - camera.x;
        const sy = e.y - camera.y;
        const s = e.size;

        if (e.type === "tank" && e.auraRadius) {
            const time = performance.now() * 0.005;
        
            const pulse = Math.sin(time * 3) * 4;
            const radius = e.auraRadius + pulse;
        
            ctx.save();
        
            ctx.shadowBlur = 20;
            ctx.shadowColor = "rgba(180, 0, 255, 0.8)";
        
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(200, 0, 255, 0.6)";
            ctx.lineWidth = 3;
            ctx.stroke();
        
            const segments = 20;
            ctx.beginPath();
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const noise = (Math.random() - 0.5) * 8;
                const r = radius + noise;
        
                const x = sx + Math.cos(angle) * r;
                const y = sy + Math.sin(angle) * r;
        
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = "rgba(180, 0, 255, 0.9)";
            ctx.lineWidth = 2;
            ctx.stroke();
        
            ctx.restore();
        }

        if (e.type === "boss") {

            if (e.bossType === "mosspit") {
                const time = performance.now() * 0.001;
                const pulse = 0.5 + 0.5 * Math.sin(time * 1.5);
            
                for (let ring = 0; ring < 3; ring++) {
                    const ringPulse = 0.5 + 0.5 * Math.sin(time * 1.5 + ring * 1.2);
                    const ringRadius = e.auraRadius * (0.5 + ring * 0.25);
                    ctx.beginPath();
                    ctx.arc(sx, sy, ringRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(30, 120, 20, ${0.12 - ring * 0.03})`;
                    ctx.lineWidth = 18 - ring * 4;
                    ctx.stroke();
                }
            
                ctx.save();
                ctx.beginPath();
                ctx.arc(sx, sy, e.auraRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(60, 180, 30, ${0.25 + pulse * 0.15})`;
                ctx.lineWidth = 3;
                ctx.setLineDash([20, 15]);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            
                const segments = 32;
                ctx.save();
                ctx.beginPath();
                for (let i = 0; i <= segments; i++) {
                    const a = (i / segments) * Math.PI * 2;
                    const noise = Math.sin(a * 4 + time * 2) * 18 + Math.sin(a * 7 - time) * 10;
                    const r = e.auraRadius * 0.75 + noise;
                    const px = sx + Math.cos(a) * r;
                    const py = sy + Math.sin(a) * r;
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fillStyle = `rgba(20, 80, 10, ${0.08 + pulse * 0.06})`;
                ctx.fill();
                ctx.restore();
            
                ctx.save();
                ctx.shadowColor = "#22aa11";
                ctx.shadowBlur = 25 * pulse;
                ctx.beginPath();
                ctx.moveTo(sx,              sy - s);
                ctx.lineTo(sx + s * 0.866, sy + s * 0.5);
                ctx.lineTo(sx - s * 0.866, sy + s * 0.5);
                ctx.closePath();
                ctx.fillStyle = e.hitTimer > 0 ? "#aaffaa" : "#1a4d0a";
                ctx.fill();
                ctx.strokeStyle = e.hitTimer > 0 ? "white" : "#44cc22";
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.restore();
            
                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(-time * 0.4);
                ctx.beginPath();
                ctx.moveTo(0,           -s * 0.45);
                ctx.lineTo( s * 0.39,   s * 0.225);
                ctx.lineTo(-s * 0.39,   s * 0.225);
                ctx.closePath();
                ctx.fillStyle = `rgba(80, 200, 40, ${pulse * 0.6})`;
                ctx.fill();
                ctx.restore();
            
                const barW = 70, barH = 5;
                const bx = sx - barW / 2;
                const by = sy - s - 12;
                ctx.fillStyle = "#333";
                ctx.fillRect(bx, by, barW, barH);
                ctx.fillStyle = "#44cc22";
                ctx.fillRect(bx, by, barW * (e.health / e.maxHealth), barH);
                ctx.strokeStyle = "rgba(255,255,255,0.4)";
                ctx.lineWidth = 1;
                ctx.strokeRect(bx, by, barW, barH);
            
                continue;
            }


            const time = performance.now() * 0.001;
            const pulse = 0.7 + 0.3 * Math.sin(time * 2);
            const isSplitter = e.bossType === "splitter";
            const baseColor  = isSplitter ? "#003366" : "#8b0000";
            const glowColor  = isSplitter ? "#0088ff" : "#ff2200";
            const innerColor = isSplitter ? "#0044cc" : "#ff3c00";
        
            ctx.save();
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 30 * pulse;
        
            ctx.beginPath();
            ctx.moveTo(sx,               sy - s);
            ctx.lineTo(sx + s * 0.866,   sy + s * 0.5);
            ctx.lineTo(sx - s * 0.866,   sy + s * 0.5);
            ctx.closePath();
            ctx.fillStyle = e.hitTimer > 0 ? "#ffffff" : baseColor;
            ctx.fill();
            ctx.strokeStyle = e.hitTimer > 0 ? "white" : glowColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();
        
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(time * (isSplitter ? -2 : 1.5));
            ctx.beginPath();
            ctx.moveTo(0,           -s * 0.45);
            ctx.lineTo( s * 0.39,   s * 0.225);
            ctx.lineTo(-s * 0.39,   s * 0.225);
            ctx.closePath();
            ctx.fillStyle = `rgba(${isSplitter ? "0,120,255" : "255,60,0"}, ${pulse * 0.7})`;
            ctx.fill();
            ctx.restore();
        
            if (isSplitter) {
                const dotsLeft = 2 - e.generation;
                for (let d = 0; d < dotsLeft; d++) {
                    ctx.beginPath();
                    ctx.arc(sx - 8 + d * 16, sy + s + 10, 4, 0, Math.PI * 2);
                    ctx.fillStyle = "#0088ff";
                    ctx.fill();
                }
            }
        
            const barW = isSplitter ? 50 : 60, barH = 5;
            const bx = sx - barW / 2;
            const by = sy - s - 12;
            ctx.fillStyle = "#333";
            ctx.fillRect(bx, by, barW, barH);
            ctx.fillStyle = glowColor;
            ctx.fillRect(bx, by, barW * (e.health / e.maxHealth), barH);
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, barW, barH);
        
            continue;
        }

        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(sx - s / 2 + 3, sy - s / 2 + 3, s, s);
        
        

        if (e.type === "tank") {
            ctx.fillStyle = e.hitTimer > 0 ? "#ff00ff" : "#6a0dad";
        } else if (e.type === "shooter") {
            ctx.fillStyle = e.hitTimer > 0 ? "#ff00ff" : "#cc3300";
        } else {
            ctx.fillStyle = e.hitTimer > 0 ? "#ff00ff" : "purple";
        } 
        ctx.fillRect(sx - s / 2, sy - s / 2, s, s);

        if (e.hitTimer > 0) {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.strokeRect(sx - s / 2, sy - s / 2, s, s);
        }

        const barW = 30, barH = 4;
        const bx = sx - barW / 2;
        const by = sy - s / 2 - 8;
        ctx.fillStyle = "#333";
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = e.type === "tank" ? "#9c27b0" : "#e53935";
        ctx.fillRect(bx, by, barW * (e.health / e.maxHealth), barH);

        
    }
}

export function drawEnemyBullets(enemyBullets, camera) {
    for (const b of enemyBullets) {
        const sx = b.x - camera.x;
        const sy = b.y - camera.y;

        ctx.save();
        ctx.shadowColor = "#ff4400";
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ff6600";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();

        ctx.restore();
    }
}

export function drawLasers(lasers, camera) {
    for (const laser of lasers) {
        const x1 = laser.x1 - camera.x;
        const y1 = laser.y1 - camera.y;
        const x2 = laser.x2 - camera.x;
        const y2 = laser.y2 - camera.y;
        const totalLen = Math.hypot(x2 - x1, y2 - y1);
        const nx = (x2 - x1) / totalLen;
        const ny = (y2 - y1) / totalLen;

        if (laser.phase === "warning") {
            const progress = 1 - (laser.timer / laser.warningDuration);
            const pulse = Math.sin(progress * Math.PI * 8) > 0 ? 1 : 0.35;

            const segLen = 16;
            const gapLen = 10;
            const period = segLen + gapLen;
            let dist = 0;
            ctx.fillStyle = `rgba(255, 80, 0, ${pulse * 0.9})`;
            while (dist < totalLen) {
                const segEnd = Math.min(dist + segLen, totalLen);
                const sx1 = x1 + nx * dist;
                const sy1 = y1 + ny * dist;
                const sx2 = x1 + nx * segEnd;
                const sy2 = y1 + ny * segEnd;
                ctx.save();
                ctx.translate((sx1 + sx2) / 2, (sy1 + sy2) / 2);
                ctx.rotate(Math.atan2(ny, nx));
                ctx.fillRect(-(segEnd - dist) / 2, -1, segEnd - dist, 3);
                ctx.restore();
                dist += period;
            }

            const dotSpacing = 40;
            const dotSteps = Math.floor(totalLen / dotSpacing);
            ctx.fillStyle = `rgba(255, 200, 0, ${pulse})`;
            for (let i = 0; i <= dotSteps; i++) {
                const t = i / dotSteps;
                const tx = x1 + (x2 - x1) * t;
                const ty = y1 + (y2 - y1) * t;
                ctx.fillRect(Math.round(tx) - 2, Math.round(ty) - 2, 4, 4);
            }

            if (progress > 0.6) {
                const fadeIn = (progress - 0.6) / 0.4;
                const steps = Math.floor(totalLen / 4);
                for (let i = 0; i < steps; i++) {
                    const t = i / steps;
                    if (Math.random() > fadeIn * 0.6) continue; 
                    const tx = Math.round(x1 + (x2 - x1) * t);
                    const ty = Math.round(y1 + (y2 - y1) * t);
                    ctx.fillStyle = `rgba(255, 240, 180, ${fadeIn})`;
                    ctx.fillRect(tx - 1, ty - 1, 2, 2);
                }
            }

        } else if (laser.phase === "active") {
            const fade = laser.timer / laser.activeDuration;
            const w = laser.width;

            const glowSteps = 3;
            for (let g = glowSteps; g >= 1; g--) {
                const gw = w * (1 + g * 1.2);
                const alpha = (fade * 0.18) / g;
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = "#ff6600";
                ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
                ctx.rotate(Math.atan2(ny, nx));
                ctx.fillRect(-totalLen / 2, -gw / 2, totalLen, gw);
                ctx.restore();
            }

            ctx.save();
            ctx.globalAlpha = fade;
            ctx.fillStyle = "#ffdd44";
            ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
            ctx.rotate(Math.atan2(ny, nx));
            ctx.fillRect(-totalLen / 2, -Math.ceil(w / 2), totalLen, w);
            ctx.fillStyle = `rgba(255,255,255,${fade})`;
            ctx.fillRect(-totalLen / 2, -1, totalLen, 2);
            ctx.restore();
        }
    }
}

export function drawHand(hand, selected, activeIndex) {
    const cardWidth = 100;
    const cardHeight = 150;
    const maxHandWidth = canvas.width * 0.85;
    const minSpacing = -90; 

    const naturalWidth = hand.length * cardWidth + (hand.length - 1) * 20;
    const spacing = naturalWidth > maxHandWidth
        ? Math.max(minSpacing, (maxHandWidth - cardWidth) / (hand.length - 1) - cardWidth)
        : 20;

    const totalWidth = cardWidth + (hand.length - 1) * (cardWidth + spacing);
    const startX = canvas.width / 2 - totalWidth / 2;
    const baseY = canvas.height - cardHeight - 20;

    const now = performance.now() * 0.001;

    hand.forEach((card, i) => {
        const x = startX + i * (cardWidth + spacing);
        const isActive = i === activeIndex;
        const isSelected = selected.has(i);

        const phase = i * 0.72 + (card.suit?.charCodeAt(0) ?? 0) * 0.1;
        const floatY  = Math.sin(now * 1.4 + phase) * 4;
        const floatRot = Math.sin(now * 1.1 + phase + 1.2) * 0.018;

        const lift = isActive ? -20 : 0;
        const finalY = baseY + lift + 75 + floatY;

        ctx.save();
        ctx.translate(x + cardWidth / 2, finalY + cardHeight / 2);
        ctx.rotate(floatRot);
        ctx.translate(-(x + cardWidth / 2), -(finalY + cardHeight / 2));

        drawCard(x, finalY, cardWidth, cardHeight, card, isSelected);
        ctx.restore();
    });
}

function drawCard(x, y, w, h, card, isSelected) {
    const AGE_THRESHOLD = 20;
    const AGE_MAX = 60;
    const age = card.age || 0;
    const degradation = age < AGE_THRESHOLD ? 0 : Math.min(1, (age - AGE_THRESHOLD) / (AGE_MAX - AGE_THRESHOLD));

    const colorMap = {
        "♥": "red", "♦": "orange", "♠": "black", "♣": "blue"
    };
    const rankMap = { 14: "A", 11: "J", 12: "Q", 13: "K" };

    const displayValue = Math.max(2, card.value - Math.floor(degradation * 4));
    const displayRank = rankMap[displayValue] || String(displayValue);

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + 4, y + 4, w, h);

    ctx.fillStyle = isSelected ? "#FFD700" : "white";
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    if (degradation > 0) {
        const posInInterval = (degradation % 0.25) / 0.25;
        const barFill = 1 - posInInterval;
        const barColor = barFill > 0.5 ? "#2a8a2a"
                       : barFill > 0.2 ? "#cc7700"
                       : "#cc2200";
    
        const cx = x + 14;
        const cy = y + 52;
        const radius = 5;
        const thickness = 2.5;
    
        ctx.beginPath();
        ctx.arc(cx - 1, cy, radius + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.5;
        ctx.stroke();
    
        ctx.beginPath();
        ctx.arc(cx - 1, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = thickness;
        ctx.stroke();
    
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * barFill);
        ctx.beginPath();
        ctx.arc(cx - 1, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = barColor;
        ctx.lineWidth = thickness;
        ctx.stroke();
    }

    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = colorMap[card.suit];
    ctx.fillText(displayRank, x + 8, y + 22);

    ctx.font = "16px monospace";
    ctx.fillText(card.suit, x + 8, y + 40);

    ctx.font = "48px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = colorMap[card.suit];
    ctx.fillText(card.suit, x + w / 2, y + h / 2 + 15);

    ctx.save();
    ctx.translate(x + w - 8, y + h - 8);
    ctx.rotate(Math.PI);
    ctx.textAlign = "left";
    ctx.font = "bold 18px monospace";
    ctx.fillStyle = colorMap[card.suit];
    ctx.fillText(displayRank, 0, -10);
    ctx.font = "16px monospace";
    ctx.fillText(card.suit, 0, 8);
    ctx.restore();
}

export function drawBullets(bullets, camera) {
    for (const b of bullets) {
        const sx = Math.round(b.x - camera.x);
        const sy = Math.round(b.y - camera.y);

        const speed = Math.hypot(b.vx, b.vy);

        if (speed > 0) {
            const nx = b.vx / speed;
            const ny = b.vy / speed;
            const trailSteps = 5;
            for (let t = 1; t <= trailSteps; t++) {
                const tx = Math.round(sx - nx * t * 5);
                const ty = Math.round(sy - ny * t * 5);
                const ts = Math.max(1, 4 - t);
                const alpha = (1 - t / trailSteps) * 0.55;
                ctx.fillStyle = t === 1
                    ? `rgba(255,200,0,${alpha})`
                    : `rgba(255,100,0,${alpha * 0.7})`;
                ctx.fillRect(tx - Math.floor(ts / 2), ty - Math.floor(ts / 2), ts, ts);
            }
        }

        ctx.fillStyle = "rgba(255,160,0,0.25)";
        ctx.fillRect(sx - 6, sy - 6, 12, 12);

        ctx.fillStyle = "#ffcc00";
        ctx.fillRect(sx - 3, sy - 3, 6, 6);

        ctx.fillStyle = "#ffe066";
        ctx.fillRect(sx - 3, sy - 3, 6, 1); 
        ctx.fillRect(sx - 3, sy - 3, 1, 6); 
        ctx.fillStyle = "#cc8800";
        ctx.fillRect(sx - 3, sy + 2, 6, 1);
        ctx.fillRect(sx + 2, sy - 3, 1, 6);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
}

export function drawItems(items, camera) {
    const now = performance.now() * 0.001;
    for (const item of items) {
        const sx = item.x - camera.x;
        const sy = item.y - camera.y;
        const bob = Math.sin(now * 2.2 + item.x * 0.05) * 2.5;
        const isy = sy + bob;

        if (item.type === "apple") {
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.fillRect(sx - 6, isy + 9, 12, 3);

            ctx.fillStyle = "#c0392b";
            ctx.fillRect(sx - 5, isy - 5, 10, 10);
            ctx.fillStyle = "#922b21";
            ctx.fillRect(sx + 1, isy, 4, 4);
            ctx.fillStyle = "#f1948a";
            ctx.fillRect(sx - 3, isy - 3, 3, 2);
            ctx.strokeStyle = "#7b241c";
            ctx.lineWidth = 1;
            ctx.strokeRect(sx - 5, isy - 5, 10, 10);
            ctx.fillStyle = "#6d4c41";
            ctx.fillRect(sx, isy - 8, 2, 4);
            ctx.fillStyle = "#27ae60";
            ctx.fillRect(sx + 1, isy - 8, 4, 3);
            ctx.fillStyle = "#1e8449";
            ctx.fillRect(sx + 2, isy - 7, 2, 1);

        } else if (item.type === "draft") {
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.fillRect(sx - 7, isy + 13, 14, 3);

            ctx.fillStyle = "#f5f5f5";
            ctx.fillRect(sx - 8, isy - 11, 16, 22);
            ctx.fillStyle = "#FFD700";
            ctx.fillRect(sx - 8, isy - 11, 16, 5);
            ctx.strokeStyle = "#333";
            ctx.lineWidth = 1;
            ctx.strokeRect(sx - 8, isy - 11, 16, 22);
            ctx.fillStyle = "#222";
            ctx.font = "bold 11px monospace";
            ctx.textAlign = "center";
            ctx.fillText("?", sx, isy + 6);
            ctx.fillStyle = "#FFD700";
            ctx.fillRect(sx - 6, isy - 9, 2, 2);
            ctx.fillRect(sx + 4, isy - 9, 2, 2);

        } else if (item.type === "powerup") {
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.fillRect(sx - 8, isy + 10, 16, 3);

            const pulse = 0.7 + 0.3 * Math.sin(now * 3.5 + item.x);
            ctx.fillStyle = "#1565c0";
            ctx.fillRect(sx - 8, isy - 8, 16, 16);
            ctx.fillStyle = "#0d47a1";
            ctx.fillRect(sx - 8, isy - 8, 3, 3); 
            ctx.fillRect(sx + 5, isy - 8, 3, 3);  
            ctx.fillRect(sx - 8, isy + 5, 3, 3);  
            ctx.fillRect(sx + 5, isy + 5, 3, 3);  
            ctx.strokeStyle = "#FFD700";
            ctx.lineWidth = 1;
            ctx.strokeRect(sx - 8, isy - 8, 16, 16);
            ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
            ctx.font = "bold 13px monospace";
            ctx.textAlign = "center";
            ctx.fillText("★", sx, isy + 5);
            ctx.fillStyle = `rgba(255,255,255,${pulse * 0.5})`;
            ctx.fillRect(sx - 5, isy - 5, 3, 2);
        }
    }
}

export function drawParticles(particles, camera) {
    for (const p of particles) {
        const alpha = p.life / p.maxLife;
        const sx = p.x - camera.x;
        const sy = p.y - camera.y;

        if (p.type === "bolt") {
            ctx.save();
            ctx.shadowColor = "#00aaff";
            ctx.shadowBlur = 30;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(p.x1 - camera.x, p.y1 - camera.y);
            ctx.lineTo(p.x2 - camera.x, p.y2 - camera.y);
            ctx.stroke();
            ctx.strokeStyle = `rgba(100, 200, 255, ${alpha * 0.6})`;
            ctx.lineWidth = 10;
            ctx.stroke();
            ctx.restore();
            continue;
        }

        if (p.type === "shockwave") {
            const alpha = p.life / p.maxLife;
            const radius = p.maxRadius * (1 - alpha);
            ctx.save();
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 160, 30, ${alpha * 0.9})`;
            ctx.lineWidth = 4 + (1 - alpha) * 8;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sx, sy, radius * 0.55, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 200, ${alpha * 0.5})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            continue;
        }

        if (p.type === "explosion") {
            const hue = 15 + Math.random() * 25;
            ctx.save();
            ctx.shadowColor = "#ff6600";
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(sx, sy, p.size * (alpha + 0.3), 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 100%, ${35 + alpha * 35}%, ${alpha})`;
            ctx.fill();
            ctx.restore();
            continue;
        }
        
        if (p.type === "explosion_ring") {
            const radius = p.size * (1 - alpha); 
            ctx.save();
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 140, 20, ${alpha * 0.85})`;
            ctx.lineWidth = 3 + (1 - alpha) * 7;
            ctx.stroke();
            ctx.restore();
            continue;
        }

        ctx.beginPath();
        ctx.arc(sx, sy, p.size * 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 180, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.save();
        ctx.shadowColor = "#00ccff";
        ctx.shadowBlur = 40;

        ctx.beginPath();
        ctx.arc(sx, sy, p.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 150, 255, ${alpha * 0.6})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 230, 255, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, p.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
        ctx.restore();

        if (alpha > 0.5) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha - 0.5) * 2})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = "#00aaff";
            ctx.shadowBlur = 15;
            const flare = p.size * 4;
            ctx.beginPath();
            ctx.moveTo(sx - flare, sy); ctx.lineTo(sx + flare, sy);
            ctx.moveTo(sx, sy - flare); ctx.lineTo(sx, sy + flare);
            ctx.stroke();
            ctx.restore();
        }
    }
}

export function drawUI(state) {
    ctx.fillStyle = "white";
    ctx.font = "20px monospace";

    ctx.textAlign = "left";
    ctx.fillText(`Time Alive: ${state.timeAlive.toFixed(1)}s`, 20, 45);
    ctx.textAlign = "right";
    ctx.fillText(`Score: ${Math.floor(state.score)}`, canvas.width - 20, 45);
    ctx.textAlign = "left";
    ctx.fillText(`Last Hand: ${state.playedHand}`, 20, 70);
    ctx.fillText(`Hands | Discards: ${state.remHands} | ${state.discards}`, 20, 95);


    const barW = canvas.width, barH = 20;
    const bx = 0, by = 0;
    ctx.fillStyle = "#333";
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = "#43a047";
    ctx.fillRect(bx, by, barW * (state.playerHealth / state.playerMaxHealth), barH);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = "white";
    ctx.font = "12px monospace";
    ctx.fillText(`HP: ${state.playerHealth} / ${state.playerMaxHealth}`, bx + 4, by + 15);

    if (state.tempEffects && state.tempEffects.length > 0) {
        ctx.font = "13px monospace";
        ctx.textAlign = "right";
        state.tempEffects.forEach((e, i) => {
            ctx.fillStyle = e.isShield ? "#64b5f6" : "#FFD700";
            ctx.fillText(
                e.isShield ? `Shield: ${e.timer.toFixed(1)}s` : `Boost: ${e.timer.toFixed(1)}s`,
                canvas.width - 20,
                70 + i * 20
            );
        });
    }
}

export function drawStatsPanel(state) {
    const lines = [
        `Player Speed:    ${Math.floor(state.playerSpeed)}`,
        `Bullet Damage:   ${state.bulletDamage}`,
        `Bullet Count:    ${state.bulletCountModifier}`,
        `Fire Rate:       ${state.shootInterval.toFixed(2)}s`,
        `Max Health:      ${state.playerMaxHealth}`,
        `Max Hands:       ${state.maxHands}`,
        `Max Discards:    ${state.maxDiscards}`,
        `Hand Refresh:    ${state.handRefresh}s`,
        `Discard Refresh: ${state.discardRefresh}s`,
        `Hand Size:       ${state.maxHandSize}`,
        `Enemies Killed:  ${state.enemiesKilled}`,
        `Kill Streak:     ${state.currentStreak}`,
    ];

    const lineH = 18;
    const padding = 10;
    const panelW = 260;
    const panelH = lines.length * lineH + padding * 2.5;
    const panelX = 0;
    const panelY = canvas.height - panelH;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(panelX, panelY, panelW, panelH);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.font = "15px monospace";
    ctx.textAlign = "left";

    lines.forEach((line, i) => {
        const isStreak = line.startsWith("Kill Streak");
        ctx.fillStyle = (isStreak && state.currentStreak >= 10) ? "#FFD700" : "white";
        ctx.fillText(line, panelX + padding, panelY + padding + i * lineH + 13);
    });
}

export function drawPauseScreen(state) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";

    ctx.font = "bold 48px monospace";
    ctx.fillStyle = "white";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 60);

    ctx.font = "24px monospace";
    ctx.fillText(`Score: ${Math.floor(state.score)}`, canvas.width / 2, canvas.height / 2);
    ctx.fillText(`High Score: ${state.highScore}`, canvas.width / 2, canvas.height / 2 + 35);

    ctx.font = "18px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("press H to resume", canvas.width / 2, canvas.height / 2 + 85);

    const handInfo = [
        ["Royal Flush",     "Clear screen, massive score bonus,"],
        ["",                "+2 hand size"],
        ["Straight Flush",  "Clear screen + score bonus"],
        ["Four of a Kind",  "+1 hand size"],
        ["Full House",      "High card x3: faster refresh"],
        ["",                "Low card x3: +1 hand & discard"],
        ["Flush",           "+max health (by high card value)"],
        ["Straight",        "+bullets (by low card value)"],
        ["Three of a Kind", "xbullet damage (by high card value)"],
        ["Two Pair",        "+player speed (by pair value)"],
        ["Pair",            "xfire rate (by pair value)"],
        ["High Card",       "Heal (by high card value)"],
    ];
    
    const colX = canvas.width / 2;
    const startY = canvas.height / 2 + 140;
    const lineH = 22;
    const panelW = 620;
    const panelH = handInfo.length * lineH + 30;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(colX - panelW / 2, startY - 30, panelW, panelH);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(colX - panelW / 2, startY - 30, panelW, panelH);
    const panelX = colX - panelW / 2 + 15;
    const divider = panelX + 220;     
    
    handInfo.forEach(([hand, desc], i) => {
        const y = startY + i * lineH;
    
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = "#FFD700";
        ctx.textAlign = "right";
        ctx.fillText(hand, divider, y);
    
        ctx.font = "14px monospace";
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        ctx.fillText(desc, divider + 15, y);
    });

    const controls = [
        ["W A S D",      "Move"],
        ["Arrow Keys",   "Navigate / Select cards"],
        ["Enter",        "Play selected hand (need 5)"],
        ["Shift",        "Discard selected cards"],
        ["H",            "Pause / Unpause"],
    ];
    
    const ctrlStartY = startY + panelH - 15;
    const ctrlLineH = 22;
    const ctrlPanelW = 620;
    const ctrlPanelH = controls.length * ctrlLineH + 30;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(colX - ctrlPanelW / 2, ctrlStartY - 15, ctrlPanelW, ctrlPanelH);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(colX - ctrlPanelW / 2, ctrlStartY - 15, ctrlPanelW, ctrlPanelH);
    
    const ctrlDivider = colX - ctrlPanelW / 2 + 15 + 220;
    
    controls.forEach(([key, desc], i) => {
        const y = ctrlStartY + i * ctrlLineH;
    
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = "#88ccff";
        ctx.textAlign = "right";
        ctx.fillText(key, ctrlDivider, y);
    
        ctx.font = "14px monospace";
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        ctx.fillText(desc, ctrlDivider + 15, y);
    });
}

export function drawGameOverScreen(state) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";

    ctx.font = "bold 48px monospace";
    ctx.fillStyle = "#e53935";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 80);

    ctx.font = "24px monospace";
    ctx.fillStyle = "white";
    ctx.fillText(`Score: ${Math.floor(state.score)}`, canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillText(`High Score: ${state.highScore}`, canvas.width / 2, canvas.height / 2 + 20);

    if (Math.floor(state.score) >= state.highScore) {
        ctx.font = "bold 20px monospace";
        ctx.fillStyle = "#FFD700";
        ctx.fillText("NEW HIGH SCORE!", canvas.width / 2, canvas.height / 2 + 60);
    }

    ctx.font = "bold 22px monospace";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`⬡ +${state.sessionCoins || 0} coins earned`, canvas.width / 2, canvas.height / 2 + 95);

    ctx.font = "16px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText(`Total: ⬡ ${state.coins || 0}`, canvas.width / 2, canvas.height / 2 + 120);

    ctx.font = "18px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("R to restart · Esc to return to menu", canvas.width / 2, canvas.height / 2 + 160);
}

export function drawNotifications(notifications) {
    const centerX = canvas.width / 2;
    const baseY = canvas.height / 2 - 80;

    notifications.forEach((n, i) => {
        const age = 2.5 - n.timer;
        

        const slideOffset = Math.max(0, (0.3 - age) / 0.3) * 30;
        const alpha = n.timer < 0.5 ? n.timer / 0.5 : 1;
        
        const y = baseY - i * 70 + slideOffset;

        ctx.font = "bold 36px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 8;
        ctx.fillText(n.title, centerX, y);

        ctx.font = "16px monospace";
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillText(n.subtitle, centerX, y + 24);

        ctx.shadowBlur = 0;
    });
}

export function drawDraftScreen(state) {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";
    ctx.font = "bold 36px monospace";
    ctx.fillStyle = "#FFD700";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 8;
    ctx.fillText("CARD DRAFT", canvas.width / 2, canvas.height / 2 - 140);
    ctx.shadowBlur = 0;

    ctx.font = "16px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("← → to choose · Enter to pick", canvas.width / 2, canvas.height / 2 - 100);

    const cardW = 100;
    const cardH = 150;
    const spacing = 40;
    const totalW = 3 * cardW + 2 * spacing;
    const startX = canvas.width / 2 - totalW / 2;
    const cardY = canvas.height / 2 - cardH / 2;

    const now = performance.now() * 0.001;

    state.draft.cards.forEach((card, i) => {
        const x = startX + i * (cardW + spacing);
        const isActive = i === state.draft.activeIndex;

        const phase = i * 0.9;
        const floatY  = Math.sin(now * 1.4 + phase) * 5;
        const floatRot = Math.sin(now * 1.1 + phase + 1.0) * 0.022;
        const lift = isActive ? -20 : 0;
        const finalY = cardY + lift + 20 + floatY;

        if (isActive) {
            ctx.shadowColor = "#FFD700";
            ctx.shadowBlur = 20;
        }

        ctx.save();
        ctx.translate(x + cardW / 2, finalY + cardH / 2);
        ctx.rotate(floatRot);
        ctx.translate(-(x + cardW / 2), -(finalY + cardH / 2));
        drawDraftCard(x, finalY, cardW, cardH, card, isActive);
        ctx.restore();
        ctx.shadowBlur = 0;
    });
}

function drawDraftCard(x, y, w, h, card, isActive) {
    const isRed = card.suit === "♥" || card.suit === "♦";
    const colorMap = { "♥": "red", "♦": "orange", "♠": "black", "♣": "blue" };

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + 4, y + 4, w, h);

    ctx.fillStyle = isActive ? "#fffde7" : "white";
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = isActive ? "#FFD700" : "#333";
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = colorMap[card.suit];
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(card.rank, x + 8, y + 22);

    ctx.font = "16px monospace";
    ctx.fillText(card.suit, x + 8, y + 40);

    ctx.font = "48px monospace";
    ctx.textAlign = "center";
    ctx.fillText(card.suit, x + w / 2, y + h / 2 + 15);

    ctx.save();
    ctx.translate(x + w - 16, y + h - 20);
    ctx.rotate(Math.PI);
    ctx.textAlign = "left";
    
    ctx.font = "bold 18px monospace";
    ctx.fillStyle = colorMap[card.suit];
    ctx.fillText(card.rank, -8, 0);
    
    ctx.font = "16px monospace";
    ctx.fillText(card.suit, -8, 18);
    ctx.restore();
}

export function drawHandPreview(hand, selected) {
    if (selected.size !== 5) return;

    const selectedCards = [...selected].map(i => hand[i]).sort((a, b) => b.value - a.value);

    const handName = evaluateHand(selectedCards);

    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`▶ ${handName}`, canvas.width / 2, canvas.height - 150);
    ctx.shadowBlur = 0;
}

export function drawMines(mines, camera) {
    if (!mines || mines.length === 0) return;

    const now = performance.now() * 0.001;

    for (const mine of mines) {
        const sx = Math.round(mine.x - camera.x);
        const sy = Math.round(mine.y - camera.y);

        if (mine.triggered) {
            const flash = Math.sin(now * 80) > 0;
            ctx.fillStyle = flash ? "#ff4400" : "#ff0000";
            ctx.fillRect(sx - 8, sy - 8, 16, 16);
            ctx.fillStyle = flash ? "#ffaa00" : "#cc0000";
            ctx.fillRect(sx - 5, sy - 5, 10, 10);
            ctx.fillStyle = flash ? "#ffffff" : "#ff6600";
            ctx.fillRect(sx - 2, sy - 2, 4, 4);
            continue;
        }

        if (!mine.armed) {
            const progress = 1 - (mine.armTimer / 0.4);
            ctx.globalAlpha = progress * 0.85;

            ctx.fillStyle = "#1a3d1a";
            ctx.fillRect(sx - 4, sy - 4, 8, 8);
            ctx.strokeStyle = "#2d6b2d";
            ctx.lineWidth = 1;
            ctx.strokeRect(sx - 4, sy - 4, 8, 8);

            ctx.fillStyle = `rgba(255,220,0,${progress})`;
            ctx.fillRect(sx - 1, sy - 1, 2, 2);

            ctx.globalAlpha = 1;
            continue;
        }

        const pulse = Math.sin(now * 3 + mine.pulsePhase) > 0;
        const size = mine.isMega ? 10 : 7;
        const isGreen = !mine.isMega;
        const bodyColor  = mine.isMega ? "#cc4400" : "#1a1a1a";
        const glowColor  = mine.isMega ? "#ff8800" : "#00ff88";
        const coreColor  = mine.isMega ? (pulse ? "#ffaa00" : "#ff6600") : (pulse ? "#00ff88" : "#007744");

        const r = mine.aoeRadius;
        ctx.fillStyle = `rgba(${isGreen ? "80,255,80" : "255,80,0"}, 0.06)`;
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const rx = Math.round(sx + Math.cos(a) * r);
            const ry = Math.round(sy + Math.sin(a) * r);
            ctx.fillRect(rx - 1, ry - 1, 2, 2);
        }

        ctx.fillStyle = bodyColor;
        ctx.fillRect(sx - size, sy - size, size * 2, size * 2);

        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(sx - size, sy - size, size * 2, 2);
        ctx.fillRect(sx - size, sy - size, 2, size * 2);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(sx - size, sy + size - 2, size * 2, 2);
        ctx.fillRect(sx + size - 2, sy - size, 2, size * 2);

        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - size, sy - size, size * 2, size * 2);

        const coreSize = mine.isMega ? 4 : 3;
        ctx.fillStyle = coreColor;
        ctx.fillRect(sx - Math.floor(coreSize / 2), sy - Math.floor(coreSize / 2), coreSize, coreSize);

        ctx.fillStyle = `rgba(${isGreen ? "0,255,100" : "255,120,0"}, ${pulse ? 0.35 : 0.12})`;
        const armLen = Math.round(size * 1.8);
        ctx.fillRect(sx - armLen, sy, armLen - size, 1);  
        ctx.fillRect(sx + size,   sy, armLen - size, 1);  
        ctx.fillRect(sx, sy - armLen, 1, armLen - size);  
        ctx.fillRect(sx, sy + size,   1, armLen - size); 
    }
}

export function drawPlayerSelectScreen(selectedChoice, bestTimes = {}) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.92)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";
    ctx.font = "bold 52px monospace";
    ctx.fillStyle = "#FFD700";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 12;
    ctx.fillText("CHOOSE YOUR STYLE", canvas.width / 2, canvas.height / 2 - 160);
    ctx.shadowBlur = 0;

    const options = [
        {
            key: "shooter",
            title: "SHOOTER",
            desc: "Fires bullets at the nearest enemy",
            icon: "Ξ",
        },
        {
            key: "trapper",
            title: "TRAPPER",
            desc: "Places proximity mines",
            icon: "Π",
        },
        {
            key: "zapper",
            title: "ZAPPER",
            desc: "Zaps a random enemy in range instantly",
            icon: "Σ",
        },
    ];

    const cardW = 220;
    const cardH = 200;
    const spacing = 60;
    const totalW = options.length * cardW + (options.length - 1) * spacing;
    const startX = canvas.width / 2 - totalW / 2;
    const cardY = canvas.height / 2 - cardH / 2;

    options.forEach((opt, i) => {
        const x = startX + i * (cardW + spacing);
        const isActive = opt.key === selectedChoice;

        ctx.save();
        if (isActive) {
            ctx.shadowColor = "#FFD700";
            ctx.shadowBlur = 30;
        }

        ctx.fillStyle = isActive ? "#1a1a2e" : "#111";
        ctx.fillRect(x, cardY, cardW, cardH);

        ctx.strokeStyle = isActive ? "#FFD700" : "rgba(255,255,255,0.2)";
        ctx.lineWidth = isActive ? 3 : 1;
        ctx.strokeRect(x, cardY, cardW, cardH);
        ctx.restore();

        ctx.font = "48px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = isActive ? "#FFD700" : "white";;
        ctx.fillText(opt.icon, x + cardW / 2, cardY + 65);

        ctx.font = `bold 22px monospace`;
        ctx.fillStyle = isActive ? "#FFD700" : "white";
        ctx.fillText(opt.title, x + cardW / 2, cardY + 110);

        ctx.font = "13px monospace";
        ctx.fillStyle = "#aaa";

        const words = opt.desc.split(" ");
        let line = "";
        let lineY = cardY + 140;
        for (const word of words) {
            const test = line + word + " ";
            if (ctx.measureText(test).width > cardW - 20 && line !== "") {
                ctx.fillText(line.trim(), x + cardW / 2, lineY);
                line = word + " ";
                lineY += 18;
            } else {
                line = test;
            }
        }
        ctx.fillText(line.trim(), x + cardW / 2, lineY);
    });
    
    ctx.font = "16px monospace";
    ctx.fillStyle = "#aaa";
    ctx.textAlign = "center";
    ctx.fillText("← → to choose · Enter to confirm · S for shop", canvas.width / 2, canvas.height / 2 + cardH / 2 + 40);
}

export function drawShopScreen(shopState) {
    const { items, owned, coins, selectedIndex } = shopState;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";
    ctx.font = "bold 48px monospace";
    ctx.fillStyle = "#FFD700";
    ctx.fillText("SHOP", canvas.width / 2, 80);

    ctx.font = "bold 24px monospace";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`⬡ ${coins} coins`, canvas.width / 2, 130);

    ctx.font = "14px monospace";
    ctx.fillStyle = "#666";
    ctx.fillText("↑ ↓ to browse · Enter to buy · Esc / P to play", canvas.width / 2, 160);

    const itemH = 80;
    const panelW = 600;
    const startY = 200;
    const panelX = canvas.width / 2 - panelW / 2;

    items.forEach((item, i) => {
        const y = startY + i * (itemH + 10);
        const isSelected = i === selectedIndex;
        const level = owned[item.id] || 0;
        const isMaxed = level >= item.maxLevel;
        const cost = isMaxed ? null : item.cost * (level + 1);
        const canAfford = cost !== null && coins >= cost;

        ctx.fillStyle = isSelected ? "#1a1a2e" : "#111";
        ctx.fillRect(panelX, y, panelW, itemH);
        ctx.strokeStyle = isSelected ? "#FFD700" : "rgba(255,255,255,0.1)";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(panelX, y, panelW, itemH);

        const pipSize = 8;
        const pipSpacing = 12;
        for (let p = 0; p < item.maxLevel; p++) {
            ctx.beginPath();
            ctx.arc(panelX + 20 + p * pipSpacing, y + 15, pipSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = p < level ? "#FFD700" : "#333";
            ctx.fill();
        }

        ctx.font = "bold 18px monospace";
        ctx.fillStyle = isMaxed ? "#888" : (isSelected ? "#FFD700" : "white");
        ctx.textAlign = "left";
        ctx.fillText(item.name, panelX + 20, y + 42);

        ctx.font = "13px monospace";
        ctx.fillStyle = "#aaa";
        ctx.fillText(item.desc, panelX + 20, y + 62);

        ctx.textAlign = "right";
        if (isMaxed) {
            ctx.font = "bold 14px monospace";
            ctx.fillStyle = "#FFD700";
            ctx.fillText("MAXED", panelX + panelW - 20, y + 45);
        } else {
            ctx.font = "bold 18px monospace";
            ctx.fillStyle = canAfford ? "#FFD700" : "#555";
            ctx.fillText(`⬡ ${cost}`, panelX + panelW - 20, y + 45);
        }
    });

    ctx.font = "13px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = shopState.resetConfirm ? "#ff4444" : "#444";
    ctx.fillText(
        shopState.resetConfirm 
            ? "⚠ Press X again to confirm reset (no refund)" 
            : "X to reset all upgrades (no refund)",
        canvas.width / 2,
        startY + SHOP_ITEMS.length * (itemH + 10) + 30
    );
}