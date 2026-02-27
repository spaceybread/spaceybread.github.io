import { evaluateHand } from "./logic.js";


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

    grassTile = createTileTexture(["#2e7d32", "#388e3c", "#1b5e20"]);
    darkGrassTile = createTileTexture(["#1b5e20", "#0f3d13"]);
    dirtTile = createTileTexture(["#6d4c41", "#5d4037"]);
    stoneTile = createTileTexture(["#888888", "#919191"]);
}

function createTileTexture(colors) {
    const off = document.createElement("canvas");
    off.width = 16;
    off.height = 16;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;

    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const c = colors[Math.floor(Math.random() * colors.length)];
            octx.fillStyle = c;
            octx.fillRect(x, y, 1, 1);
        }
    }

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
        }
    }
}

export function drawPlayer(player, camera, state) {
    const sx = player.x - camera.x;
    const sy = player.y - camera.y;
    const s = player.size;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(sx - s / 2 + 3, sy - s / 2 + 3, s, s);

    ctx.fillStyle = state.playerHitTimer > 0 ? "#ff4444" : "red";
    ctx.fillRect(sx - s / 2, sy - s / 2, s, s);

    if (state.playerHitTimer > 0) {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - s / 2, sy - s / 2, s, s);
    }

    if (state.nearestDir) {
        const tipDist = s / 2 + 3;
        ctx.strokeStyle = state.playerHitTimer > 0 ? "white" : "rgba(255,255,255,0.8)";
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(sx + state.nearestDir.x * (s / 2 + 2),
                   sy + state.nearestDir.y * (s / 2 + 2));
        ctx.lineTo(sx + state.nearestDir.x * tipDist,
                   sy + state.nearestDir.y * tipDist);
        ctx.stroke();

        const angle = Math.atan2(state.nearestDir.y, state.nearestDir.x);
        ctx.beginPath();
        ctx.moveTo(sx + state.nearestDir.x * tipDist,
                   sy + state.nearestDir.y * tipDist);
        ctx.lineTo(sx + Math.cos(angle + 2.5) * (tipDist - 5),
                   sy + Math.sin(angle + 2.5) * (tipDist - 5));
        ctx.lineTo(sx + Math.cos(angle - 2.5) * (tipDist - 5),
                   sy + Math.sin(angle - 2.5) * (tipDist - 5));
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fill();
    }
}

export function drawEnemies(enemies, camera) {
    for (const e of enemies) {
        const sx = e.x - camera.x;
        const sy = e.y - camera.y;
        const s = e.size;

        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(sx - s / 2 + 3, sy - s / 2 + 3, s, s);

        ctx.fillStyle = e.hitTimer > 0 ? "#ff00ff" : "purple";
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
        ctx.fillStyle = "#e53935";
        ctx.fillRect(bx, by, barW * (e.health / e.maxHealth), barH);
    }
}

export function drawHand(hand, selected, activeIndex) {
    const cardWidth = 100;
    const cardHeight = 150;
    const spacing = 20;

    const totalWidth =
        hand.length * cardWidth + (hand.length - 1) * spacing;

    const startX = canvas.width / 2 - totalWidth / 2;
    const baseY = canvas.height - cardHeight - 20;

    hand.forEach((card, i) => {
        const x = startX + i * (cardWidth + spacing);

        const isActive = i === activeIndex;
        const isSelected = selected.has(i);

        const lift = isActive ? -20 : 0;

        drawCard(
            x,
            baseY + lift + 75,
            cardWidth,
            cardHeight,
            card,
            isSelected
        );
    });
}

function drawCard(x, y, w, h, card, isSelected) {

    let colorMap = {
        "♥": "red", 
        "♦": "orange", 
        "♠": "black",
        "♣": "blue" 
    }

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + 4, y + 4, w, h);   
    
    ctx.fillStyle = isSelected ? "#FFD700" : "white";
    ctx.fillRect(x, y, w, h);

    

    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);



    ctx.fillStyle = colorMap[card.suit]; 

    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(card.rank, x + 8, y + 22);

    ctx.font = "16px monospace";
    ctx.fillText(card.suit, x + 8, y + 40);

    ctx.save();
    ctx.translate(x + w - 8, y + h - 8);
    ctx.rotate(Math.PI);
    ctx.textAlign = "left";
    ctx.font = "bold 18px monospace";
    ctx.fillText(card.rank, 0, -10);
    ctx.font = "16px monospace";
    ctx.fillText(card.suit, 0, 8);
    ctx.restore();

    ctx.font = "48px monospace";
    ctx.textAlign = "center";
    ctx.fillText(card.suit, x + w / 2, y + h / 2 + 15);
}

export function drawBullets(bullets, camera) {
    for (const b of bullets) {
        const sx = b.x - camera.x;
        const sy = b.y - camera.y;

        ctx.save();
        ctx.shadowColor = "#ffaa00";
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 180, 0, 0.3)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffdd00";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();

        ctx.restore();

        const speed = Math.hypot(b.vx, b.vy);
        if (speed > 0) {
            const nx = b.vx / speed;
            const ny = b.vy / speed;
            const grad = ctx.createLinearGradient(
                sx, sy,
                sx - nx * 18, sy - ny * 18
            );
            grad.addColorStop(0, "rgba(255, 200, 0, 0.6)");
            grad.addColorStop(1, "rgba(255, 100, 0, 0)");

            ctx.beginPath();
            ctx.moveTo(sx + ny * 2, sy - nx * 2);
            ctx.lineTo(sx - ny * 2, sy + nx * 2);
            ctx.lineTo(sx - nx * 18, sy - ny * 18);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
        }
    }
}

export function drawItems(items, camera) {
    for (const item of items) {
        const sx = item.x - camera.x;
        const sy = item.y - camera.y;

        if (item.type === "apple") {
            ctx.fillStyle = "#e53935";
            ctx.fillRect(sx - 7, sy - 7, 14, 14);
            ctx.strokeStyle = "black";
            ctx.lineWidth = 2;
            ctx.strokeRect(sx - 7, sy - 7, 14, 14);
            ctx.fillStyle = "#43a047";
            ctx.fillRect(sx, sy - 10, 2, 4);

        } else if (item.type === "draft") {
            ctx.fillStyle = "white";
            ctx.fillRect(sx - 8, sy - 12, 16, 22);
            ctx.strokeStyle = "black";
            ctx.lineWidth = 2;
            ctx.strokeRect(sx - 8, sy - 12, 16, 22);
            ctx.fillStyle = "black";
            ctx.font = "8px monospace";
            ctx.textAlign = "center";
            ctx.fillText("?", sx, sy + 2);

        } else if (item.type === "powerup") {
            ctx.fillStyle = "#1565c0";
            ctx.fillRect(sx - 9, sy - 9, 18, 18);
            ctx.strokeStyle = "#FFD700";
            ctx.lineWidth = 2;
            ctx.strokeRect(sx - 9, sy - 9, 18, 18);
            ctx.fillStyle = "#FFD700";
            ctx.font = "bold 12px monospace";
            ctx.textAlign = "center";
            ctx.fillText("★", sx, sy + 5);
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
        ["",                "+2 hand size, +bullets, +fire rate"],
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

    ctx.font = "18px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("press R to restart", canvas.width / 2, canvas.height / 2 + 100);
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

    state.draft.cards.forEach((card, i) => {
        const x = startX + i * (cardW + spacing);
        const isActive = i === state.draft.activeIndex;

        const lift = isActive ? -20 : 0;

        if (isActive) {
            ctx.shadowColor = "#FFD700";
            ctx.shadowBlur = 20;
        }

        drawDraftCard(x, cardY + lift + 20, cardW, cardH, card, isActive);
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

export function drawPlayerSelectScreen(selectedChoice) {
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
            icon: "X",
        },
        {
            key: "bolter",
            title: "BOLTER",
            desc: "Zaps a random enemy in range instantly",
            icon: "Z",
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
    ctx.fillText("← → to choose · Enter to confirm", canvas.width / 2, canvas.height / 2 + cardH / 2 + 40);
}