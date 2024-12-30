// https://www.schemecolor.com/soft-tones.php
// const colors = ["#ECC1D1", "#BEAFE1", "#D9B4E2", "#EEE7D3", "#EAD7C3", "#C8D3B8"];
// https://www.schemecolor.com/dull-autumn-color-palette.php + https://www.schemecolor.com/summer-before-fall.php
const colors = ["#A9C28C", "#87A766", "#DED8BB", "#CEB38C", "#BB8C68", "#975450", "#994B26", "#F46C06", "#F49E2D", "#F6B914", "#AE9618", "#757943"];

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

function expandGrid() {
  if (isExpanded) return;

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
  expandedBlock.style.alignItems = "center";
  expandedBlock.style.justifyContent = "center";
  expandedBlock.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
  expandedBlock.style.color = "white";
  expandedBlock.style.height = "631px";
  expandedBlock.style.width = "790px";
  expandedBlock.style.fontSize = "20px";
  expandedBlock.style.cursor = "pointer";
  expandedBlock.innerHTML = `
          <h1 style="margin-bottom: 20px; font-size: 24px;">Papers</h1>
          <p>This is some rich content with images and text. Add anything you want here!</p>
          <img src="https://cdn-useast1.kapwing.com/static/templates/this-is-where-id-put-my-trophy-if-i-had-one-meme-template-full-79af6e4e.webp" alt="publication record" style="width: 15vw; min-width: 330px;">
          <button style="padding: 10px 20px; background-color: #555; color: white; border: none; cursor: pointer;">Click to Collapse</button>
        `;

  grid.appendChild(expandedBlock);

  expandedBlock.addEventListener("click", collapseGrid);
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

  const expandableTile = document.querySelector(".expandable");
  if (expandableTile) {
    expandableTile.addEventListener("click", expandGrid);
  }
};
