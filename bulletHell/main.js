const gameModules = {
    "shooter": "./shooter.js",
    "bolter": "./bolter.js",
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
    drawPlayerSelectScreen
} from "./graphics.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.imageSmoothingEnabled = false;

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

initGraphics(canvas, ctx);

let menuActive = true;
let menuChoice = "shooter";
const menuOptions = ["shooter", "bolter"];

let logic = null; 

let gameKeyHandler = null;
let gameKeyUpHandler = null;
let gameMouseHandler = null;

document.addEventListener("keydown", async e => {
    if (menuActive) {
        const idx = menuOptions.indexOf(menuChoice);
        if (e.key === "ArrowLeft")  menuChoice = menuOptions[(idx - 1 + menuOptions.length) % menuOptions.length];
        if (e.key === "ArrowRight") menuChoice = menuOptions[(idx + 1) % menuOptions.length];
        if (e.key === "Enter") {
            menuActive = false;
            logic = await import(gameModules[menuChoice]);
            logic.initLogic(canvas);

            // Attach game listeners only after menu is done
            gameKeyHandler = e => {
                if (e.key.toLowerCase() === "r") {
                    const state = logic.getState();
                    if (state.gameOver) logic.restartGame();
                }
                logic.handleKeyDown(e);
            };
            gameKeyUpHandler = e => logic.handleKeyUp(e);
            gameMouseHandler = e => logic.handleMouseMove(e);

            document.addEventListener("keydown", gameKeyHandler);
            document.addEventListener("keyup", gameKeyUpHandler);
            document.addEventListener("mousemove", gameMouseHandler);
        }
        return; // always block menu keys from reaching game
    }
});
let lastTime = performance.now();

function gameLoop(now) {
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (menuActive || !logic) {
        ctx.fillStyle = "#0a0a0f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawPlayerSelectScreen(menuChoice);
        requestAnimationFrame(gameLoop);
        return;
    }

    logic.updateLogic(delta);

    const state = logic.getState();

    drawWorld(state.camera);
    drawPlayer(state.player, state.camera, state);
    drawEnemies(state.enemies, state.camera);
    if (state.playerChoice === "bolter") {
        drawParticles(state.particles, state.camera);
    } else {
        drawBullets(state.bullets, state.camera);
    }
    drawUI(state);
    drawStatsPanel(state);
    drawHand(state.hand, state.selected, state.activeIndex);
    drawItems(state.items, state.camera);
    drawNotifications(state.notifications);
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