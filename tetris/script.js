export {};

const canvas = /** @type {HTMLCanvasElement} */ (
    document.getElementById("box1canvas")
);
const context = canvas.getContext("2d");

const BLACK = "#000000";
const GRAY = "#808080";
const RED = "#FF0000";
const GREEN = "#00FF00";
const BLUE = "#0000FF";
const YELLOW = "#FFFF00";
const PURPLE = "#FF00FF";
const CYAN = "#00FFFF"; 
const ORANGE = "#FF971C"; 
const TILESIZE = 50;

let gameOver = false;

const SHAPE_COLORS = {
    O: YELLOW,
    I: CYAN,
    J: BLUE,
    L: ORANGE,
    S: GREEN,
    Z: RED,
    T: PURPLE
};


const COLS = canvas.width / TILESIZE;
const ROWS = canvas.height / TILESIZE;

// const SHAPES = new Set(["O", "I", "J", "L", "S", "Z", "T"]);  
const SHAPES = new Set([ "J", "L", "T"]);  

let frameStep = 0; 
let updateMod = 32; 
let occupiedGrids = new Set(); 
let gridMap = new Map(); 
let allTetros = [];
let diassociatedTiles = []; 

function adjustColor(hex, amount) {
    hex = hex.replace("#", "");

    let r = parseInt(hex.slice(0, 2), 16);
    let g = parseInt(hex.slice(2, 4), 16);
    let b = parseInt(hex.slice(4, 6), 16);

    r = Math.min(255, Math.max(0, r + amount));
    g = Math.min(255, Math.max(0, g + amount));
    b = Math.min(255, Math.max(0, b + amount));

    return `rgb(${r}, ${g}, ${b})`;
}

let score = 0;
let linesCleared = 0;
let level = 1;

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");

function updateUI() {
    scoreEl.textContent = score;
    linesEl.textContent = linesCleared;
    levelEl.textContent = level;
}


class SquareTile {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;

        this.size = 50;
        this.band = 6;
    }

    make() {
        const light = adjustColor(this.color, 60);
        const dark = adjustColor(this.color, -60);

        context.fillStyle = this.color;
        context.fillRect(this.x, this.y, this.size, this.size);


        context.fillStyle = dark;
        context.fillRect(this.x, this.y + this.size - this.band, this.size, this.band); 
        context.fillRect(this.x + this.size - this.band, this.y, this.band, this.size); 

        context.fillStyle = light;
        context.fillRect(this.x, this.y, this.size, this.band);
        context.fillRect(this.x, this.y, this.band, this.size);

        let id = `${this.x / TILESIZE},${this.y / TILESIZE}`;
        occupiedGrids.add(id);
        gridMap.set(id, this)

    }

    setInactive() {
        let id = `${this.x / TILESIZE},${this.y / TILESIZE}`;
        occupiedGrids.delete(id); 
        gridMap.delete(id); 

        this.x = -1000; 
        this.y = -1000; 
        this.color = BLACK;
        this.size = 0;
        this.band = 0; 
    }
}

class Tetromino {
    constructor() {
        this.isActive = true;
        this.tiles = [];
    }
    
    step() {
        if (!this.isActive) return; 
        if (frameStep % updateMod !== 0) return; 
        // console.log(occupiedGrids); 
        // needs to fall here
        let shouldStep = true; 

        let thisPiecesGrid = new Set(); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            thisPiecesGrid.add(`${oldTile.x / TILESIZE},${oldTile.y / TILESIZE}`);
        }

        let otherPiecesGrid = occupiedGrids.difference(thisPiecesGrid); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 

            const gridX = oldTile.x / TILESIZE;
            const gridY = oldTile.y / TILESIZE + 1;
            
            if (otherPiecesGrid.has(`${gridX},${gridY}`)) {
                shouldStep = false;
            }
        }

        if (!shouldStep) {
            this.isActive = false;
            diassociatedTiles = diassociatedTiles.concat(this.tiles);
            return; 
        }
        
        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            let newTile = new SquareTile(oldTile.x, oldTile.y + TILESIZE, oldTile.color); 
            this.tiles[i] = newTile; 
        }

        // remove the old locations from the set
        thisPiecesGrid = new Set(); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            thisPiecesGrid.add(`${oldTile.x / TILESIZE},${oldTile.y / TILESIZE}`);
        }

        occupiedGrids = otherPiecesGrid.union(thisPiecesGrid);

    }

    shift(shft) {
        let thisPiecesGrid = new Set(); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            thisPiecesGrid.add(`${oldTile.x / TILESIZE},${oldTile.y / TILESIZE}`);
        }

        let otherPiecesGrid = occupiedGrids.difference(thisPiecesGrid); 
        let shouldShift = true; 
        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 

            const gridX = oldTile.x / TILESIZE + shft;
            const gridY = oldTile.y / TILESIZE;
            
            if (otherPiecesGrid.has(`${gridX},${gridY}`) || gridX == 11 || gridX == 0) {
                shouldShift = false;
            }
        }

        if (!shouldShift) return; 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            let newTile = new SquareTile(oldTile.x + TILESIZE * shft, oldTile.y, oldTile.color); 
            this.tiles[i] = newTile; 
        }
        thisPiecesGrid = new Set(); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            thisPiecesGrid.add(`${oldTile.x / TILESIZE},${oldTile.y / TILESIZE}`);
        }

        occupiedGrids = otherPiecesGrid.union(thisPiecesGrid);
        
    }

    rotate(rot) {
        console.log(`Rotate is not implemented for this tetronimo: ${rot}`); 
        return; 
    }
}

class TetrominoO extends Tetromino {
    constructor(x, y, color) {
        super(); 
         
        this.tiles.push(
            new SquareTile(x * TILESIZE, y * TILESIZE, color),
            new SquareTile((x + 1) * TILESIZE, (y + 1) * TILESIZE, color),
            new SquareTile((x + 1) * TILESIZE, y * TILESIZE, color), 
            new SquareTile(x * TILESIZE, (y + 1) * TILESIZE, color)
        ); 
    }

    make() {
        for (let i = 0; i < this.tiles.length; i++) {
            this.tiles[i].make();
          }
    }
}

class TetrominoI extends Tetromino {
    constructor(x, y, color) {
        super(); 
        this.state = 1; 
        this.tiles.push(
            new SquareTile(x * TILESIZE, y * TILESIZE, color),
            new SquareTile(x * TILESIZE, (y + 1) * TILESIZE, color),
            new SquareTile(x * TILESIZE, (y + 2) * TILESIZE, color), 
            new SquareTile(x * TILESIZE, (y + 3) * TILESIZE, color)
        ); 
    }

    make() {
        for (let i = 0; i < this.tiles.length; i++) {
            this.tiles[i].make();
          }
    }

    rotate(rot) {
        if (this.state === 0) {
            this.toState1(); 

        } else {
            this.toState0(); 

        }
    }

    toState0() {
        // the pivot tile is one we can guarantee exists as clean spot
        let pivotTile = this.tiles[1];

        const pivotX = pivotTile.x / TILESIZE;
        const pivotY = pivotTile.y / TILESIZE;
        
        if (occupiedGrids.has(`${pivotX - 1},${pivotY}`)) return;
        if (occupiedGrids.has(`${pivotX + 1},${pivotY}`)) return;
        if (occupiedGrids.has(`${pivotX + 2},${pivotY}`)) return;
            
        this.state = 0; 
        occupiedGrids.delete(`${pivotX},${pivotY + 2}`);
        occupiedGrids.delete(`${pivotX},${pivotY - 1}`); 
        occupiedGrids.delete(`${pivotX},${pivotY + 1}`);

        this.tiles[0] = new SquareTile((pivotX - 1) * TILESIZE, pivotY * TILESIZE, pivotTile.color);
        this.tiles[2] = new SquareTile((pivotX + 1) * TILESIZE, pivotY * TILESIZE, pivotTile.color);
        this.tiles[3] = new SquareTile((pivotX + 2) * TILESIZE, pivotY * TILESIZE, pivotTile.color);
    }

    toState1() {
        let pivotTile = this.tiles[1];

        const pivotX = pivotTile.x / TILESIZE;
        const pivotY = pivotTile.y / TILESIZE;
        
        if (occupiedGrids.has(`${pivotX},${pivotY + 2}`)) return;
        if (occupiedGrids.has(`${pivotX},${pivotY - 1}`)) return;
        if (occupiedGrids.has(`${pivotX},${pivotY + 1}`)) return;
            
        this.state = 1; 
        occupiedGrids.delete(`${pivotX - 1},${pivotY}`);
        occupiedGrids.delete(`${pivotX + 1},${pivotY}`); 
        occupiedGrids.delete(`${pivotX + 2},${pivotY}`);

        this.tiles[0] = new SquareTile((pivotX) * TILESIZE, (pivotY - 1) * TILESIZE, pivotTile.color);
        this.tiles[2] = new SquareTile((pivotX) * TILESIZE, (pivotY + 1) * TILESIZE, pivotTile.color);
        this.tiles[3] = new SquareTile((pivotX) * TILESIZE, (pivotY + 2) * TILESIZE, pivotTile.color);
    }
}

class TetrominoL extends Tetromino {
    constructor(x, y, color) {
        super(); 
        this.state = 0; 
        this.tiles.push(
            new SquareTile((x + 1) * TILESIZE, y * TILESIZE, color),
            new SquareTile((x + 1) * TILESIZE, (y + 1) * TILESIZE, color),
            new SquareTile((x + 1) * TILESIZE, (y + 2) * TILESIZE, color), 
            new SquareTile(x * TILESIZE, (y + 2) * TILESIZE, color)
        ); 
    }

    make() {
        for (let i = 0; i < this.tiles.length; i++) {
            this.tiles[i].make();
          }
    }

    rotate(rot) {
        let nextState = this.state + rot; 
        let pivotTile = this.tiles[1]; 

        occupiedGrids.delete(`${this.tiles[3].x / TILESIZE},${this.tiles[3].y / TILESIZE}`); 
        if (nextState % 2 == 0) {

            if (nextState % 4 == 0) {
                if (this.toVertical(occupiedGrids.has(`${(pivotTile.x - TILESIZE)},${(pivotTile.y + TILESIZE)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x - TILESIZE), (pivotTile.y + TILESIZE), pivotTile.color); 
            } else {
                if (this.toVertical(occupiedGrids.has(`${(pivotTile.x + TILESIZE)},${(pivotTile.y - TILESIZE)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x + TILESIZE), (pivotTile.y - TILESIZE), pivotTile.color); 
            }

        } else {
            if (nextState % 4 == 1) {
                if (this.toHorizontal(occupiedGrids.has(`${(pivotTile.x - TILESIZE)},${(pivotTile.y - TILESIZE)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x - TILESIZE), (pivotTile.y - TILESIZE), pivotTile.color); 
            } else {
                if (this.toHorizontal(occupiedGrids.has(`${(pivotTile.x + TILESIZE)},${(pivotTile.y + TILESIZE)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x + TILESIZE), (pivotTile.y + TILESIZE), pivotTile.color); 
            }
            
        }

        this.state = nextState; 
    }

    toVertical(cond) {

        if (cond) return -1; 

        let leftToTop = this.tiles[0];
        let rightToBot = this.tiles[2];

        let thisPiecesGrid = new Set(); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            thisPiecesGrid.add(`${oldTile.x / TILESIZE},${oldTile.y / TILESIZE}`);
        }

        let otherPiecesGrid = occupiedGrids.difference(thisPiecesGrid); 
        
        const s1x = leftToTop.x / TILESIZE;
        const s1y = leftToTop.y / TILESIZE;
        const s2x = rightToBot.x / TILESIZE;
        const s2y = rightToBot.y / TILESIZE;

        

        if (otherPiecesGrid.has(`${s1x + 1},${s1y - 1}`)) return -1;
        if (otherPiecesGrid.has(`${s2x - 1},${s2y + 1}`)) return -1;

        occupiedGrids.delete(`${s1x},${s1y}`);
        occupiedGrids.delete(`${s2x},${s2y}`); 

        this.tiles[0] = new SquareTile((s1x + 1) * TILESIZE, (s1y - 1) * TILESIZE, leftToTop.color);
        this.tiles[2] = new SquareTile((s2x - 1) * TILESIZE, (s2y + 1) * TILESIZE, rightToBot.color);
    }

    toHorizontal(cond) {

        if (cond) return -1; 

        let topToLeft = this.tiles[0];
        let botToRight = this.tiles[2];

        let thisPiecesGrid = new Set(); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            thisPiecesGrid.add(`${oldTile.x / TILESIZE},${oldTile.y / TILESIZE}`);
        }

        let otherPiecesGrid = occupiedGrids.difference(thisPiecesGrid); 
        
        const s1x = topToLeft.x / TILESIZE;
        const s1y = topToLeft.y / TILESIZE;
        const s2x = botToRight.x / TILESIZE;
        const s2y = botToRight.y / TILESIZE;

        

        if (otherPiecesGrid.has(`${s1x - 1},${s1y + 1}`)) return -1;
        if (otherPiecesGrid.has(`${s2x + 1},${s2y - 1}`)) return -1;

        occupiedGrids.delete(`${s1x},${s1y}`);
        occupiedGrids.delete(`${s2x},${s2y}`); 

        this.tiles[0] = new SquareTile((s1x - 1) * TILESIZE, (s1y + 1) * TILESIZE, topToLeft.color);
        this.tiles[2] = new SquareTile((s2x + 1) * TILESIZE, (s2y - 1) * TILESIZE, botToRight.color);
    } 
}

class TetrominoJ extends Tetromino {
    constructor(x, y, color) {
        super(); 
        this.state = 0; 
        this.tiles.push(
            new SquareTile(x * TILESIZE, y * TILESIZE, color),
            new SquareTile(x * TILESIZE, (y + 1) * TILESIZE, color),
            new SquareTile(x * TILESIZE, (y + 2) * TILESIZE, color), 
            new SquareTile((x + 1) * TILESIZE, (y + 2) * TILESIZE, color)
        ); 
    }

    make() {
        for (let i = 0; i < this.tiles.length; i++) {
            this.tiles[i].make();
          }
    }

    rotate(rot) {
        let nextState = this.state + rot; 
        let pivotTile = this.tiles[1]; 

        occupiedGrids.delete(`${this.tiles[3].x / TILESIZE},${this.tiles[3].y / TILESIZE}`); 
        if (nextState % 2 == 0) {

            if (nextState % 4 === 0) {
                if (this.toVertical(occupiedGrids.has(`${(pivotTile.x - TILESIZE)},${(pivotTile.y - TILESIZE)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x - TILESIZE), (pivotTile.y - TILESIZE), pivotTile.color); 
            } else {
                if (this.toVertical(occupiedGrids.has(`${(pivotTile.x + TILESIZE)},${(pivotTile.y + TILESIZE)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x + TILESIZE), (pivotTile.y + TILESIZE), pivotTile.color); 
            }
            

        } else {            
            if (nextState % 4 === 1) {
                if (this.toHorizontal(occupiedGrids.has(`${(pivotTile.x + TILESIZE)},${(pivotTile.y - TILESIZE)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x + TILESIZE), (pivotTile.y - TILESIZE), pivotTile.color); 
            } else {
                if (this.toHorizontal(occupiedGrids.has(`${(pivotTile.x - TILESIZE)},${(pivotTile.y + TILESIZE)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x - TILESIZE), (pivotTile.y + TILESIZE), pivotTile.color); 
            }
            
        }
        this.state = nextState; 
    }

    toVertical(cond) {

        if (cond) return -1; 

        let leftToTop = this.tiles[0];
        let rightToBot = this.tiles[2];

        let thisPiecesGrid = new Set(); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            thisPiecesGrid.add(`${oldTile.x / TILESIZE},${oldTile.y / TILESIZE}`);
        }

        let otherPiecesGrid = occupiedGrids.difference(thisPiecesGrid); 
        
        const s1x = leftToTop.x / TILESIZE;
        const s1y = leftToTop.y / TILESIZE;
        const s2x = rightToBot.x / TILESIZE;
        const s2y = rightToBot.y / TILESIZE;

        

        if (otherPiecesGrid.has(`${s1x + 1},${s1y - 1}`)) return -1;
        if (otherPiecesGrid.has(`${s2x - 1},${s2y + 1}`)) return -1;

        occupiedGrids.delete(`${s1x},${s1y}`);
        occupiedGrids.delete(`${s2x},${s2y}`); 

        this.tiles[0] = new SquareTile((s1x + 1) * TILESIZE, (s1y - 1) * TILESIZE, leftToTop.color);
        this.tiles[2] = new SquareTile((s2x - 1) * TILESIZE, (s2y + 1) * TILESIZE, rightToBot.color);
    }

    toHorizontal(cond) {

        if (cond) return -1; 

        let topToLeft = this.tiles[0];
        let botToRight = this.tiles[2];

        let thisPiecesGrid = new Set(); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            thisPiecesGrid.add(`${oldTile.x / TILESIZE},${oldTile.y / TILESIZE}`);
        }

        let otherPiecesGrid = occupiedGrids.difference(thisPiecesGrid); 
        
        const s1x = topToLeft.x / TILESIZE;
        const s1y = topToLeft.y / TILESIZE;
        const s2x = botToRight.x / TILESIZE;
        const s2y = botToRight.y / TILESIZE;

        

        if (otherPiecesGrid.has(`${s1x - 1},${s1y + 1}`)) return -1;
        if (otherPiecesGrid.has(`${s2x + 1},${s2y - 1}`)) return -1;

        occupiedGrids.delete(`${s1x},${s1y}`);
        occupiedGrids.delete(`${s2x},${s2y}`); 

        this.tiles[0] = new SquareTile((s1x - 1) * TILESIZE, (s1y + 1) * TILESIZE, topToLeft.color);
        this.tiles[2] = new SquareTile((s2x + 1) * TILESIZE, (s2y - 1) * TILESIZE, botToRight.color);
    }
}

class TetrominoZ extends Tetromino {
    constructor(x, y, color) {
        super(); 
        this.state = 0; 
        this.tiles.push(
            new SquareTile(x * TILESIZE, y * TILESIZE, color),
            new SquareTile(x * TILESIZE, (y + 1) * TILESIZE, color),
            new SquareTile((x + 1) * TILESIZE, y * TILESIZE, color), 
            new SquareTile((x + 1) * TILESIZE, (y - 1) * TILESIZE, color)
        ); 
    }

    make() {
        for (let i = 0; i < this.tiles.length; i++) {
            this.tiles[i].make();
          }
    }

    rotate(rot) {
        if (this.state === 0) {
            this.toState1(); 

        } else {
            this.toState0(); 

        }
    }

    // Z and S are fairly interesting in that there are actually two tiles
    // that never move under rotations!  

    toState0() {
        let sTile1 = this.tiles[1];
        let sTile2 = this.tiles[3];

        const s1x = sTile1.x / TILESIZE;
        const s1y = sTile1.y / TILESIZE;
        const s2x = sTile2.x / TILESIZE;
        const s2y = sTile2.y / TILESIZE;

        if (occupiedGrids.has(`${s1x - 2},${s1y}`)) return;
        if (occupiedGrids.has(`${s2x},${s2y - 2}`)) return;

        this.state = 0; 
        occupiedGrids.delete(`${s1x},${s1y}`);
        occupiedGrids.delete(`${s2x},${s2y}`); 

        this.tiles[1] = new SquareTile((s1x - 2) * TILESIZE, (s1y) * TILESIZE, sTile1.color);
        this.tiles[3] = new SquareTile((s2x) * TILESIZE, (s2y - 2) * TILESIZE, sTile2.color);
    }

    toState1() {
        let sTile1 = this.tiles[1];
        let sTile2 = this.tiles[3];

        const s1x = sTile1.x / TILESIZE;
        const s1y = sTile1.y / TILESIZE;
        const s2x = sTile2.x / TILESIZE;
        const s2y = sTile2.y / TILESIZE;

        if (occupiedGrids.has(`${s1x + 2},${s1y}`)) return;
        if (occupiedGrids.has(`${s2x},${s2y + 2}`)) return;

        this.state = 1; 
        occupiedGrids.delete(`${s1x},${s1y}`);
        occupiedGrids.delete(`${s2x},${s2y}`); 

        this.tiles[1] = new SquareTile((s1x + 2) * TILESIZE, (s1y) * TILESIZE, sTile1.color);
        this.tiles[3] = new SquareTile((s2x) * TILESIZE, (s2y + 2) * TILESIZE, sTile2.color);
    }
}

class TetrominoS extends Tetromino {
    constructor(x, y, color) {
        super(); 

        this.tiles.push(
            new SquareTile((x + 1) * TILESIZE, y * TILESIZE, color),
            new SquareTile((x + 1) * TILESIZE, (y + 1) * TILESIZE, color),
            new SquareTile(x * TILESIZE, y * TILESIZE, color), 
            new SquareTile(x * TILESIZE, (y - 1) * TILESIZE, color)
        ); 
    }

    make() {
        for (let i = 0; i < this.tiles.length; i++) {
            this.tiles[i].make();
          }
    }

    rotate(rot) {
        if (this.state === 0) {
            this.toState1(); 

        } else {
            this.toState0(); 

        }
    }

    toState0() {
        let sTile1 = this.tiles[1];
        let sTile2 = this.tiles[3];

        const s1x = sTile1.x / TILESIZE;
        const s1y = sTile1.y / TILESIZE;
        const s2x = sTile2.x / TILESIZE;
        const s2y = sTile2.y / TILESIZE;

        if (occupiedGrids.has(`${s1x - 2},${s1y}`)) return;
        if (occupiedGrids.has(`${s2x},${s2y + 2}`)) return;

        this.state = 0; 
        occupiedGrids.delete(`${s1x},${s1y}`);
        occupiedGrids.delete(`${s2x},${s2y}`); 

        this.tiles[1] = new SquareTile((s1x - 2) * TILESIZE, (s1y) * TILESIZE, sTile1.color);
        this.tiles[3] = new SquareTile((s2x) * TILESIZE, (s2y + 2) * TILESIZE, sTile2.color);
    }

    toState1() {
        let sTile1 = this.tiles[1];
        let sTile2 = this.tiles[3];

        const s1x = sTile1.x / TILESIZE;
        const s1y = sTile1.y / TILESIZE;
        const s2x = sTile2.x / TILESIZE;
        const s2y = sTile2.y / TILESIZE;

        if (occupiedGrids.has(`${s1x + 2},${s1y}`)) return;
        if (occupiedGrids.has(`${s2x},${s2y - 2}`)) return;

        this.state = 1; 
        occupiedGrids.delete(`${s1x},${s1y}`);
        occupiedGrids.delete(`${s2x},${s2y}`); 

        this.tiles[1] = new SquareTile((s1x + 2) * TILESIZE, (s1y) * TILESIZE, sTile1.color);
        this.tiles[3] = new SquareTile((s2x) * TILESIZE, (s2y - 2) * TILESIZE, sTile2.color);
    }
}

class TetrominoT extends Tetromino {
    constructor(x, y, color) {
        super(); 
        this.state = 0; 

        this.tiles.push(
            new SquareTile(x * TILESIZE, y * TILESIZE, color),
            new SquareTile(x * TILESIZE, (y - 1) * TILESIZE, color),
            new SquareTile(x * TILESIZE, (y + 1) * TILESIZE, color), 
            new SquareTile((x + 1) * TILESIZE, y * TILESIZE, color)
        ); 
    }

    make() {
        for (let i = 0; i < this.tiles.length; i++) {
            this.tiles[i].make();
          }
    }

    rotate(rot) {
        let nextState = this.state + rot; 
        let pivotTile = this.tiles[0]; 

        if (nextState % 2 == 0) {
            if (nextState % 4 == 0) {
                if (this.toVertical(occupiedGrids.has(`${(pivotTile.x + TILESIZE)},${(pivotTile.y)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x + TILESIZE), (pivotTile.y), pivotTile.color); 
            } else {
                if (this.toVertical(occupiedGrids.has(`${(pivotTile.x - TILESIZE)},${(pivotTile.y)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x - TILESIZE), (pivotTile.y), pivotTile.color); 
            }

        } else {
            if (nextState % 4 == 1) {
                if (this.toHorizontal(occupiedGrids.has(`${(pivotTile.x)},${(pivotTile.y + TILESIZE)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x), (pivotTile.y + TILESIZE), pivotTile.color); 
            } else {
                if (this.toHorizontal(occupiedGrids.has(`${(pivotTile.x)},${(pivotTile.y - TILESIZE)}`)) === -1) return;
                this.tiles[3] = new SquareTile((pivotTile.x), (pivotTile.y - TILESIZE), pivotTile.color); 
            }
        }
        this.state = nextState; 
    }

    toVertical(cond) {

        if (cond) return -1; 

        let leftToTop = this.tiles[1];
        let rightToBot = this.tiles[2];

        let thisPiecesGrid = new Set(); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            thisPiecesGrid.add(`${oldTile.x / TILESIZE},${oldTile.y / TILESIZE}`);
        }

        let otherPiecesGrid = occupiedGrids.difference(thisPiecesGrid); 
        
        const s1x = leftToTop.x / TILESIZE;
        const s1y = leftToTop.y / TILESIZE;
        const s2x = rightToBot.x / TILESIZE;
        const s2y = rightToBot.y / TILESIZE;

        

        if (otherPiecesGrid.has(`${s1x + 1},${s1y - 1}`)) return -1;
        if (otherPiecesGrid.has(`${s2x - 1},${s2y + 1}`)) return -1;

        occupiedGrids.delete(`${s1x},${s1y}`);
        occupiedGrids.delete(`${s2x},${s2y}`); 

        this.tiles[1] = new SquareTile((s1x + 1) * TILESIZE, (s1y - 1) * TILESIZE, leftToTop.color);
        this.tiles[2] = new SquareTile((s2x - 1) * TILESIZE, (s2y + 1) * TILESIZE, rightToBot.color);
    }

    toHorizontal(cond) {

        if (cond) return -1; 

        let topToLeft = this.tiles[1];
        let botToRight = this.tiles[2];

        let thisPiecesGrid = new Set(); 

        for (let i = 0; i < this.tiles.length; i++) {
            let oldTile = this.tiles[i]; 
            thisPiecesGrid.add(`${oldTile.x / TILESIZE},${oldTile.y / TILESIZE}`);
        }

        let otherPiecesGrid = occupiedGrids.difference(thisPiecesGrid); 
        
        const s1x = topToLeft.x / TILESIZE;
        const s1y = topToLeft.y / TILESIZE;
        const s2x = botToRight.x / TILESIZE;
        const s2y = botToRight.y / TILESIZE;

        

        if (otherPiecesGrid.has(`${s1x - 1},${s1y + 1}`)) return -1;
        if (otherPiecesGrid.has(`${s2x + 1},${s2y - 1}`)) return -1;

        occupiedGrids.delete(`${s1x},${s1y}`);
        occupiedGrids.delete(`${s2x},${s2y}`); 

        this.tiles[1] = new SquareTile((s1x - 1) * TILESIZE, (s1y + 1) * TILESIZE, topToLeft.color);
        this.tiles[2] = new SquareTile((s2x + 1) * TILESIZE, (s2y - 1) * TILESIZE, botToRight.color);
    }

}


function makeFrame() {
    context.fillStyle = BLACK;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const cols = canvas.width / TILESIZE;
    const rows = canvas.height / TILESIZE;

    // add this if you want a line on top as well! 

    // for (let x = 0; x < cols; x++) {
    //     new SquareTile(x * TILESIZE, 0, GRAY).make();
    // }

    for (let x = 0; x < cols; x++) {
        new SquareTile(x * TILESIZE, (rows - 1) * TILESIZE, GRAY).make();
    }

    for (let y = -10; y < rows - 1; y++) {
        new SquareTile(0, y * TILESIZE, GRAY).make();
        new SquareTile((cols - 1) * TILESIZE, y * TILESIZE, GRAY).make();
    }

}


let shapesUsedInCycle = new Set(); 
let activeTetro = null; 
function addRandomTetronimo() {
    // console.log(shapesUsedInCycle); 

    if (shapesUsedInCycle.size == SHAPES.size) {
        shapesUsedInCycle = new Set(); 
        renderBag();
    }
    let possibleShapes = Array.from(SHAPES.difference(shapesUsedInCycle)); 
    let rIdx = Math.floor(Math.random() * possibleShapes.length); 
    let pickedShape = possibleShapes[rIdx]; 

    let max = 9; let min = 1; 
    let dropX = Math.floor(Math.random() * (max - min + 1)) + min;
    let dropY = -5; 
    let newTetro;

    switch (pickedShape) {
        case "O": 
            newTetro = new TetrominoO(dropX, dropY, YELLOW); 
            break; 

        case "I":
            newTetro = new TetrominoI(dropX, dropY, CYAN); 
            break; 
        
        case "J": 
            newTetro = new TetrominoJ(dropX, dropY, BLUE); 
            break; 

        case "L":
            newTetro = new TetrominoL(dropX, dropY, ORANGE); 
            break;
            
        case "S": 
            newTetro = new TetrominoS(dropX, dropY, GREEN); 
            break; 

        case "Z":
            newTetro = new TetrominoZ(dropX, dropY, RED); 
            break;

        case "T":
            newTetro = new TetrominoT(dropX, dropY, PURPLE); 
            break;
    }
    allTetros.push(newTetro); 
    activeTetro = newTetro; 
    shapesUsedInCycle.add(pickedShape);
    renderBag();
}

function makeAndUpdateTetros() {
    if (activeTetro === null) addRandomTetronimo(); 

    activeTetro.step();
    activeTetro.make();
     
    if (!activeTetro.isActive) activeTetro = null; 

    for (let i = 0; i < diassociatedTiles.length; i++) 
        diassociatedTiles[i].make(); 

}

function clearLines() {
    let lineCounter = new Map();
    let clearedRows = [];

    for (let tile of diassociatedTiles) {
        let row = tile.y / TILESIZE;
        lineCounter.set(row, (lineCounter.get(row) || 0) + 1);

        if (lineCounter.get(row) === COLS - 2) {
            clearedRows.push(row);
        }
    }

    if (clearedRows.length === 0) return;
    
    clearedRows.sort(); 

    for (let tile of diassociatedTiles) {
        let row = tile.y / TILESIZE;
        if (clearedRows.includes(row)) {
            tile.setInactive();
        }
    }

    diassociatedTiles = diassociatedTiles.filter(t => t.size !== 0);

    for (let tile of diassociatedTiles) {
        let row = tile.y / TILESIZE;
        let shift = clearedRows.filter(v => v > row).length;
        occupiedGrids.delete(`${tile.x / TILESIZE},${tile.y / TILESIZE}`);

        tile.y = tile.y + TILESIZE * shift; 
        occupiedGrids.add(`${tile.x / TILESIZE},${tile.y / TILESIZE}`)
    }

    occupiedGrids.clear();
    gridMap.clear();

    for (let tile of diassociatedTiles) {
        let gx = tile.x / TILESIZE;
        let gy = tile.y / TILESIZE;
        let id = `${gx},${gy}`;
        occupiedGrids.add(id);
        gridMap.set(id, tile);
    }

    for (let tile of diassociatedTiles) {
        if (tile.y < TILESIZE * 2) {
            gameOver = true;
            drawGameOver(); 
            break;
        }
    }   

    const pointsTable = [0, 100, 300, 500, 800];
    score += pointsTable[clearedRows.length] * level;
    linesCleared += clearedRows.length;

    level = Math.floor(linesCleared / 10) + 1;
    updateMod = Math.max(2, 32 - level);

    scoreEl.classList.add("flash");
    setTimeout(() => scoreEl.classList.remove("flash"), 150);

    updateUI();
    
}

const bagEl = document.getElementById("bag");

function renderBag() {
    bagEl.innerHTML = "";

    for (const shape of SHAPES) {
        const div = document.createElement("div");
        div.classList.add("bag-item");

        const used = shapesUsedInCycle.has(shape);
        div.classList.add(used ? "used" : "available");

        div.textContent = shape;
        div.style.color = used ? "#444" : SHAPE_COLORS[shape];
        div.style.textShadow = used ? "none" : `0 0 6px ${SHAPE_COLORS[shape]}`;

        bagEl.appendChild(div);
    }
}

function drawGameOver() {
    if (!gameOver) return;

    context.fillStyle = "rgba(0, 0, 0, 0.75)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.textAlign = "center";

    context.font = "48px 'Press Start 2P'";
    context.fillStyle = "red";
    context.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);

    context.font = "18px 'Press Start 2P'";
    context.fillStyle = "white";
    context.fillText(`SCORE ${score}`, canvas.width / 2, canvas.height / 2 + 20);

    context.textAlign = "left";
}

function animate() {
    frameStep += 1;
    context.clearRect(0, 0, canvas.width, canvas.height);

    makeFrame();
    if (gameOver) {
        console.log('we got here'); 
        drawGameOver();
    } else {        
        makeAndUpdateTetros();
        clearLines();
    }

    
    requestAnimationFrame(animate);
}

window.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") {
        for (const tetro of allTetros) {
            if (tetro.isActive) {
                tetro.shift(1);
                break;
            }
        }
    }
});

window.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") {
        for (const tetro of allTetros) {
            if (tetro.isActive) {
                tetro.shift(-1);
                break;
            }
        }
    }
});

window.addEventListener("keydown", e => {
    if (e.key === "d") {
        for (const tetro of allTetros) {
            if (tetro.isActive) {
                tetro.rotate(1);
                break;
            }
        }
    }
});


window.addEventListener("keydown", e => {
    if (e.key === "D") {
        for (const tetro of allTetros) {
            if (tetro.isActive) {
                tetro.rotate(1);
                break;
            }
        }
    }
});


window.addEventListener("keydown", e => {
    // lol didnt think to use .lowercase earlier
    if (e.key.toLowerCase() === "r" && gameOver) {
        restartGame();
    }
});

function restartGame() {
    gameOver = false;
    score = 0;
    linesCleared = 0;
    level = 1;
    updateMod = 10;

    occupiedGrids.clear();
    gridMap.clear();
    allTetros = [];
    diassociatedTiles = [];
    shapesUsedInCycle = new Set();
    activeTetro = null;

    updateUI();
    renderBag();
}

renderBag();
animate();
