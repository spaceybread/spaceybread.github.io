// https://www.schemecolor.com/soft-tones.php
// const colors = ["#ECC1D1", "#BEAFE1", "#D9B4E2", "#EEE7D3", "#EAD7C3", "#C8D3B8"];
// https://www.schemecolor.com/dull-autumn-color-palette.php + https://www.schemecolor.com/summer-before-fall.php
// const colors = ["#A9C28C", "#87A766", "#DED8BB", "#CEB38C", "#BB8C68", "#975450", "#994B26", "#F46C06", "#F49E2D", "#F6B914", "#AE9618", "#757943"];
// filtered colors
const colors = ["#975450", "#994B26", "#F46C06", "#F49E2D"];
const colors_exp = ["#975450", "#994B26"];

const tileFiles = {
  "papers": "tiles/papers.html",
  "rayleigh": "tiles/projects.html",
  "tiles?": "tiles/tiles.html",
  "research": "tiles/research.html",
  "about me": "tiles/about_new.html",
  "contact": "tiles/contact.html",
  "misc.": "tiles/misc.html",
};

const tileContent = {};

async function loadTiles() {
  for (const [key, path] of Object.entries(tileFiles)) {
    const response = await fetch(path);
    if (!response.ok) {
      console.error(`Failed to load ${path}`);
      tileContent[key] = `<p>Could not load ${path}</p>`;
    } else {
      tileContent[key] = await response.text();
    }
  }
  console.log("Tiles loaded:", tileContent);
}

loadTiles();

function shuffleGrid() {
  const grid = document.getElementById("grid");
  const items = Array.from(grid.children);
  const shuffled = items.sort(() => Math.random() - 0.5);
  grid.innerHTML = "";
  shuffled.forEach(item => grid.appendChild(item));
}

function assignRandomColors() {
  const grid = document.getElementById("grid");
  const items = Array.from(grid.children);

  items.forEach(item => {
    if (!item.querySelector("img") && !item.querySelector("p")) {
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      item.style.backgroundColor = randomColor;
    }
  });
}

const grid = document.getElementById("grid");
let isExpanded = false;

function expandGrid(event) {
    if (isExpanded) return;
  
    const clickedTile = event.target;
    const tileText = clickedTile.innerText;
  
    const content = tileContent[tileText] || `
      <h1 style="margin-bottom: 20px; font-size: 24px;">Default Content</h1>
      <p>No specific content found for this tile.</p>
    `;
  
    const gridItems = Array.from(grid.children);
  
    gridItems.forEach(item => {
      item.style.display = "none";
    });
  
    const expandedBlock = document.createElement("div");
    expandedBlock.id = "expandedBlock";
    expandedBlock.style.gridColumn = "1 / -1";
    expandedBlock.style.gridRow = "1 / -1";
    expandedBlock.style.display = "flex";
    expandedBlock.style.flexDirection = "column";
    expandedBlock.style.overflow = "auto";
    // expandedBlock.style.alignItems = "center";
    // expandedBlock.style.justifyContent = "center";
    expandedBlock.style.backgroundColor = colors_exp[Math.floor(Math.random() * colors_exp.length)];
    expandedBlock.style.color = "white";
    expandedBlock.style.height = "631px";
    expandedBlock.style.width = "790px";
    expandedBlock.style.fontSize = "20px";
    expandedBlock.style.cursor = "pointer";
  
    expandedBlock.innerHTML = `
        <style>
            .header {
                font-size: 20px;
                font-family: monospace;
                margin: 10 0 10px;
                margin-bottom: 10px; 
                justify-content: left;
                padding-left: 20px; 
            }

            .para {
                font-size: 16px;
                font-family: monospace;
                margin: 10 10 10px;
                margin-bottom: 20px; 
                justify-content: left;
                padding-left: 20px; 
                white-space: pre-line;
            }

            .abs {
              font-size: 14px;
              font-family: monospace;
              margin: 10 10 10px;
              margin-bottom: 20px; 
              justify-content: left;
              padding-left: 40px; 
              max-width: 700px;
              white-space: pre-line;
          }

            img {
                margin: 10 10 10px;
                margin-bottom: 20px; 
                justify-content: left;
                padding-left: 20px; 
            }
        </style>
        ${content}
        <button style="padding: 10px 20px; background-color: #555; color: white; border: none; cursor: pointer; font-family: monospace">collapse tile</button>
    `;
  
    grid.appendChild(expandedBlock);
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([expandedBlock]).catch(err => console.error(err));
    }
  
    expandedBlock.querySelector("button").addEventListener("click", collapseGrid);
    isExpanded = true;
  }
  
  function collapseGrid() {
    if (!isExpanded) return;
  
    const expandedBlock = document.getElementById("expandedBlock");
    if (expandedBlock) {
      expandedBlock.remove();
    }
  
    const gridItems = Array.from(grid.children);
    gridItems.forEach(item => {
      item.style.display = "";
    });
  
    // shuffleGrid();
    // assignRandomColors();
    isExpanded = false;
  }

  function showMobileWarning() {
    const mobileWarning = document.getElementById('mobile-warning');
    if (window.innerWidth < 768) {
        mobileWarning.style.display = 'block';
    }
  }
  
  window.onload = () => {
    shuffleGrid();
    assignRandomColors();
    showMobileWarning();

    const expandableTiles = Array.from(document.querySelectorAll(".expandable"));
    expandableTiles.forEach(tile => {
      tile.addEventListener("click", expandGrid);
    });
  };

  window.onresize = showMobileWarning;
