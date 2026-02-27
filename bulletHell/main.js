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
    drawNotifications
} from "./graphics.js";
import {
    initLogic,
    updateLogic,
    getState,
    restartGame
} from "./logic.js";

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
initLogic(canvas);

document.addEventListener("keydown", e => {
    if (e.key.toLowerCase() === "r") {
        const state = getState();
        if (state.gameOver) restartGame();
    }
});


let lastTime = performance.now();

function gameLoop(now) {
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    updateLogic(delta);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const state = getState();

    drawWorld(state.camera);
    drawPlayer(state.player, state.camera, state);
    drawEnemies(state.enemies, state.camera);
    drawBullets(state.bullets, state.camera); 
    drawUI(state);
    drawStatsPanel(state);
    drawHand(state.hand, state.selected, state.activeIndex);
    drawItems(state.items, state.camera);
    drawNotifications(state.notifications);
    if (state.paused) drawPauseScreen(state);
    if (state.gameOver) drawGameOverScreen(state);
    
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);