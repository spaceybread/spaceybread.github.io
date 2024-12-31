// https://www.schemecolor.com/soft-tones.php
// const colors = ["#ECC1D1", "#BEAFE1", "#D9B4E2", "#EEE7D3", "#EAD7C3", "#C8D3B8"];
// https://www.schemecolor.com/dull-autumn-color-palette.php + https://www.schemecolor.com/summer-before-fall.php
// const colors = ["#A9C28C", "#87A766", "#DED8BB", "#CEB38C", "#BB8C68", "#975450", "#994B26", "#F46C06", "#F49E2D", "#F6B914", "#AE9618", "#757943"];
// filtered colors
const colors = ["#975450", "#994B26", "#F46C06", "#F49E2D", "#F6B914"];
const colors_exp = ["#975450", "#994B26", "#F46C06"];

const tileContent = {
    "papers": `
      <h1 class="header">papers</h1>
      <p class="para">I don't have any publications at the moment, however I am actively working with <a href="https://pages.cs.wisc.edu/~chatterjee/">Prof. Rahul Chatterjee</a> and soon with <a href="https://pages.cs.wisc.edu/~bach/">Prof. Eric Bach</a> to change that. If, for whatever reason, you're interested in my <a href="https://wiki.math.wisc.edu/index.php/Directed_Reading_Program">Directed Reading Program</a> presentation or my submission for the <a href="https://www.comap.com/contests/mcm-icm">Mathematical Contest in Modeling</a>, please send me an email. </p>
      <a href="https://www.youtube.com/watch?v=_Tc0C3fhjt0"><img src="https://cdn-useast1.kapwing.com/static/templates/this-is-where-id-put-my-trophy-if-i-had-one-meme-template-full-79af6e4e.webp" alt="publication record" style="width: 15vw; min-width: 330px;"></a>
    `,
    "projects": `
      <h1 class="header">projects</h1>
      <p class="para">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus sit amet velit vel elit sodales feugiat.</p>
    `,
    "tiles?": `
      <h1 class="header">what's with the tiles?</h1>
      <p class="para">In preparation for grad school applications, I've visited a lot of academic homepages and frankly, most of them are pretty boring. As such, unique websites stick out way more than they usually would and one such website was <a href="https://www.lcdf.org/~eddietwo/">Prof. Eddie Kohler's old landing page</a> with its random tiles. I really liked the aesthetic and used it as inspiration for this site.</p>
      <p class="para">While the entire stretch from September to December is often called 'fall,' Midwesterners will attest that the true magic lies in a fleeting three-week window. During this time, trees burst into vibrant shades of orange emerging from the green that dominates the summer, and the ground remains blissfully free of fallen leaves. In an attempt to capture this period, the tiles seek to evoke the warmth and colors of a Midwest autumn.</p>
      `,
    "research": `
      <h1 class="header">research</h1>
      <p class="para">My research interests lie broadly in cryptography and algorithms though I love exploring new fields and would hate to box myself in before I start a graduate program. Despite my hesitancy to commit entirely, I have thoroughly enjoyed my time working on the following lines of inquiry:
      
      > Multi-party Computation: How can multiple parties collaboratively compute a function over their private inputs without revealing those inputs to each other?

      > Random Numbers: How can we generate a long sequence of numbers, from a short deterministic input, that appears random and passes statistical tests for randomness even though it is not truly random?
      
      > Error-Correcting Codes: How can we encode data so it can be accurately reconstructed even after errors during transmission or storage?

      > Data Compression: How can we represent data more efficiently while preserving its original information?

      > Online Algorithms: How can we make decisions or process input sequentially without knowing future data?

      As stated earlier, this is not an exhaustive list and I am always open to exploring new topics. 
      </p>
    `,
    "about me": `
      <h1 class="header">about me :)</h1>
      <p class="para">Hi! I'm an undergraduate student majoring in mathematics and computer Science at UW-Madison and I'm interested in theoretical computer science which I hope to pursue at a graduate school starting in Fall 2026. I am currently employed as a programmer at Space Science and Engineering Center where I work on products that talk to satellites and process their data! I am also involved with research in secure multi-party computation and soon random number generation. I have undertaken graduate coursework in algorithms and, soon, in cryptography. If you'd like to learn more about my work, please reach out to my by mail. I try to respond quickly!</p>
    `,
    "contact": `
      <h1 class="header">contact</h1>
      <p class="para">Email: {initial} {last name} {thirty five in decimal} ampersand wisc dot edu
      Github: <a href="https://github.com/spaceybread">/spaceybread</a>
      LinkedIn: <a href="https://www.linkedin.com/in/spaceyloaf/">/spaceyloaf</a>
      Bluesky: <a href="https://bsky.app/profile/spaceybread.bsky.social">@spaceybread.bsky.social</a>
      Instagram: <a href="https://www.instagram.com/spaceybread0/">/spaceybread0</a>
      
      ...</p>
    `,
    "misc.": `
      <h1 class="header">misc.</h1>
      <p class="para">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus sit amet velit vel elit sodales feugiat.</p>
    `,
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