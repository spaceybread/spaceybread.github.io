// https://www.schemecolor.com/soft-tones.php
// const colors = ["#ECC1D1", "#BEAFE1", "#D9B4E2", "#EEE7D3", "#EAD7C3", "#C8D3B8"];
// https://www.schemecolor.com/dull-autumn-color-palette.php + https://www.schemecolor.com/summer-before-fall.php
const colors = ["#A9C28C", "#87A766", "#DED8BB", "#CEB38C", "#BB8C68", "#975450", "#994B26", "#F46C06", "#F49E2D", "#F6B914", "#AE9618", "#757943"];

const tileContent = {
    "papers": `
      <h1>papers</h1>
      <p>I don't have any publications at the moment, however I am actively working with Prof. Rahul Chatterjee and soon with Prof. Eric Bach to change that. If, for whatever reason, you're interested in my Directed Reading Program presentation or my submission for the Mathematical Contest in Modeling, please send me an email. </p>
      <img src="https://cdn-useast1.kapwing.com/static/templates/this-is-where-id-put-my-trophy-if-i-had-one-meme-template-full-79af6e4e.webp" alt="publication record" style="width: 15vw; min-width: 330px;">
    `,
    "projects": `
      <h1 style="margin-bottom: 20px; font-size: 24px;">Projects</h1>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus sit amet velit vel elit sodales feugiat.</p>
    `,
    "tiles?": `
      <h1 style="margin-bottom: 20px; font-size: 24px;">what's with the tiles?</h1>
      <p>In preparation for grad school applications, I've visited a lot of academic homepages and frankly, a lot of them are pretty boring. As such, unique websites stick out way more than they usually would and one such website was Prof. Eddie Kohler's old landing page with its random tiles. I really liked the aesthetic and used it as inspiration for this site.</p>
    `
  };
  

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
    expandedBlock.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    expandedBlock.style.color = "white";
    expandedBlock.style.height = "631px";
    expandedBlock.style.width = "790px";
    expandedBlock.style.fontSize = "20px";
    expandedBlock.style.cursor = "pointer";
  
    expandedBlock.innerHTML = `
        <style>
            h1 {
                font-size: 20px;
                font-family: monospace;
                margin: 10 0 10px;
                margin-bottom: 10px; 
                justify-content: left;
                padding-left: 20px; 
            }

            p {
                font-size: 16px;
                font-family: monospace;
                margin: 10 10 10px;
                margin-bottom: 20px; 
                justify-content: left;
                padding-left: 20px; 
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
  
    shuffleGrid();
    assignRandomColors();
    isExpanded = false;
  }
  
  window.onload = () => {
    shuffleGrid();
    assignRandomColors();
  
    const expandableTiles = Array.from(document.querySelectorAll(".expandable"));
    expandableTiles.forEach(tile => {
      tile.addEventListener("click", expandGrid);
    });
  };