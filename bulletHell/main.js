const gameModules = {
    "shooter": "./shooter.js",
    "zapper":  "./bolter.js",
    "trapper": "./trapper.js",
};

import {
    initGraphics,
    drawWorld,
    drawUI,
    drawPlayer,
    drawBullets,
    drawEnemies,
    drawHand,
    drawStatsPanel,
    drawItems,
    drawPauseScreen,
    drawGameOverScreen,
    drawNotifications,
    drawDraftScreen,
    drawHandPreview,
    drawParticles,
    drawPlayerSelectScreen,
    drawEnemyBullets,
    drawLasers,
    drawMines,
    drawShopScreen
} from "./graphics.js";

import { 
    SHOP_ITEMS, 
    getOwnedLevels, 
    buyItem, 
    resetShop 
} from "./shop.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.imageSmoothingEnabled = false;

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});


let shopActive = false;
let shopSelectedIndex = 0;
let _shopResetConfirm = false;


initGraphics(canvas, ctx);

function getShopState() {
    return {
        items: SHOP_ITEMS,
        owned: getOwnedLevels(),
        coins: parseInt(localStorage.getItem("coins") || "0"),
        selectedIndex: shopSelectedIndex,
        resetConfirm: _shopResetConfirm,
    };
}

function getBestTimes() {
    return {
        shooter: parseFloat(localStorage.getItem("bestTime_shooter") || "0"),
        zapper:  parseFloat(localStorage.getItem("bestTime_zapper")  || "0"),
        trapper: parseFloat(localStorage.getItem("bestTime_trapper") || "0"),
    };
}

let menuActive = true;
let menuChoice = "shooter";
const menuOptions = ["shooter", "zapper", "trapper"]; 

let logic = null; 

let gameKeyHandler = null;
let gameKeyUpHandler = null;
let gameMouseHandler = null;

document.addEventListener("keydown", async e => {

    if (shopActive) {
        if (e.key === "ArrowUp")   shopSelectedIndex = Math.max(0, shopSelectedIndex - 1);
        if (e.key === "ArrowDown") shopSelectedIndex = Math.min(SHOP_ITEMS.length - 1, shopSelectedIndex + 1);
        if (e.key === "Enter")     buyItem(SHOP_ITEMS[shopSelectedIndex].id);
        if (e.key.toLowerCase() === "x") {
            if (_shopResetConfirm) {
                resetShop();
                _shopResetConfirm = false;
            } else {
                _shopResetConfirm = true;
                setTimeout(() => _shopResetConfirm = false, 3000);
            }
        }
        if (e.key === "Escape" || e.key.toLowerCase() === "p") shopActive = false;
        return;
    }

    if (menuActive) {
        if (e.key.toLowerCase() === "s") { shopActive = true; return; }
        const idx = menuOptions.indexOf(menuChoice);
        
        if (e.key === "ArrowLeft")  menuChoice = menuOptions[(idx - 1 + menuOptions.length) % menuOptions.length];
        if (e.key === "ArrowRight") menuChoice = menuOptions[(idx + 1) % menuOptions.length];
        if (e.key === "Enter") {
            menuActive = false;
            logic = await import(gameModules[menuChoice]);
            logic.initLogic(canvas);

            gameKeyHandler = e => {
                if (e.key.toLowerCase() === "r") {
                    const state = logic.getState();
                    if (state.gameOver) logic.restartGame();
                }
                if (e.key === "Escape") {
                    const state = logic.getState();
                    if (state.gameOver) window.location.reload();
                }
                logic.handleKeyDown(e);
            };
            gameKeyUpHandler = e => logic.handleKeyUp(e);
            gameMouseHandler = e => logic.handleMouseMove(e);

            document.addEventListener("keydown", gameKeyHandler);
            document.addEventListener("keyup", gameKeyUpHandler);
            document.addEventListener("mousemove", gameMouseHandler);
        }
        return;
    }
});

let lastTime = performance.now();

function gameLoop(now) {
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (shopActive) {
        drawShopScreen(getShopState());
        requestAnimationFrame(gameLoop);
        return;
    }

    if (menuActive || !logic) {
        ctx.fillStyle = "#0a0a0f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawPlayerSelectScreen(menuChoice, getBestTimes()); 
        requestAnimationFrame(gameLoop);
        return;
    }



    logic.updateLogic(delta);

    const state = logic.getState();

    if (state.gameOver && !state._bestTimeSaved) {
        const key = `bestTime_${state.playerChoice}`;
        const prev = parseFloat(localStorage.getItem(key) || "0");
        if (state.timeAlive > prev) {
            localStorage.setItem(key, state.timeAlive.toFixed(1));
        }
        state._bestTimeSaved = true; 
    }

    drawWorld(state.camera);
    drawPlayer(state.player, state.camera, state);
    drawEnemies(state.enemies, state.camera);

    if (state.playerChoice === "trapper") {
        drawMines(state.mines, state.camera);
        drawParticles(state.particles, state.camera); 
    } else if (state.playerChoice === "zapper") {
        drawParticles(state.particles, state.camera);
    } else {
        drawBullets(state.bullets, state.camera);
    }
    drawUI(state);
    drawStatsPanel(state);
    drawItems(state.items, state.camera);
    drawNotifications(state.notifications);
    
    drawEnemyBullets(state.enemyBullets, state.camera);
    drawLasers(state.lasers, state.camera);

    drawHand(state.hand, state.selected, state.activeIndex);
    drawHandPreview(state.hand, state.selected);
    if (state.draft) {
        drawDraftScreen(state);
    } else if (state.paused) {
        drawPauseScreen(state);
    } else if (state.gameOver) {
        drawGameOverScreen(state);
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);