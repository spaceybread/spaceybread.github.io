// https://www.schemecolor.com/soft-tones.php
// const colors = ["#ECC1D1", "#BEAFE1", "#D9B4E2", "#EEE7D3", "#EAD7C3", "#C8D3B8"];
// https://www.schemecolor.com/dull-autumn-color-palette.php + https://www.schemecolor.com/summer-before-fall.php
// const colors = ["#A9C28C", "#87A766", "#DED8BB", "#CEB38C", "#BB8C68", "#975450", "#994B26", "#F46C06", "#F49E2D", "#F6B914", "#AE9618", "#757943"];
// filtered colors
const colors = ["#975450", "#994B26", "#F46C06", "#F49E2D", "#F6B914"];
const colors_exp = ["#975450", "#994B26", "#F46C06"];

const tileContent = {
    "papers": `
      <b><h1 class="header">papers</h1></b>
      <p class="para">I don't have any publications at the moment, however I am actively working with <a href="https://pages.cs.wisc.edu/~chatterjee/">Prof. Rahul Chatterjee [/]</a> and soon with <a href="https://pages.cs.wisc.edu/~bach/">Prof. Eric Bach [/]</a> to change that. If, for whatever reason, you're interested in my <a href="https://wiki.math.wisc.edu/index.php/Directed_Reading_Program">Directed Reading Program [/]</a> presentation or my submission for the <a href="https://www.comap.com/contests/mcm-icm">Mathematical Contest in Modeling [/]</a>, please send me an email. </p>
      <a href="https://www.youtube.com/watch?v=_Tc0C3fhjt0"><img src="https://cdn-useast1.kapwing.com/static/templates/this-is-where-id-put-my-trophy-if-i-had-one-meme-template-full-79af6e4e.webp" alt="publication record" style="width: 15vw; min-width: 330px;"></a>
    `,
    "projects": `
      <b><h1 class="header">projects</h1></b>
      <p class="para">I enjoy programming and I have been doing it for a long time, here are some of the projects I have worked on: 
      
      <b><a href="https://github.com/mcidasv/mcidasv">McIDAS-V [/]</a></b>: McIDAS-V is a free, open source, visualization and data analysis software package.
      
      <b><a href="https://github.com/spaceybread/refactored-spork">Busy Beavers [/]</a></b>: I wrote busy beaver simulations to explore computability. 

      <b><a href="https://github.com/spaceybread/solid-funicular">Three-Body Problem [/]</a></b>: I wrote a three body simulation after reading Liu Cixin's <a href="https://www.goodreads.com/book/show/20518872-the-three-body-problem">novel [/]</a>

      <b><a href="https://github.com/spaceybread/fluffy-system">Conway's Game of Life [/]</a></b>: Cellular automata are fun; also check out <a href="https://github.com/spaceybread/stunning-tribble">Langton's Ant [/]</a>

      <b><a href="https://github.com/spaceybread/sturdy-octo-guide">Sudoku Solver [/]</a></b>: Uses graph coloring to solve basic 9x9 sudoku puzzles.

      <b>Calculating Pi</b>: This is a fun one, I love trying new ways to compute Pi with progressively better precision, some of them are <a href="https://github.com/spaceybread/pi-am-doing-this">Chudnovsky algorithm [/]</a>, <a href="https://github.com/spaceybread/pi-stress-test">Madhava-Leibniz series [/]</a>, and a good old <a href="https://github.com/spaceybread/congenial-spoon">Monte Carlo computation [/]</a>

      This list is not complete and you can find some of my other projects on my <a href="https://github.com/spaceybread?tab=repositories">Github page [/]</a>
      </p>
    `,
    "tiles?": `
      <b><h1 class="header">what's with the tiles?</h1></b>
      <p class="para">In preparation for grad school applications, I've visited a lot of academic homepages and frankly, most of them are pretty boring. As such, unique websites stick out way more than they usually would and one such website was <a href="https://www.lcdf.org/~eddietwo/">Prof. Eddie Kohler's old landing page [/]</a> with its random tiles. I really liked the aesthetic and used it as inspiration for this site.</p>
      <p class="para">While the entire stretch from September to December is often called 'fall,' Midwesterners will attest that the true magic lies in a fleeting three-week window. During this time, trees burst into vibrant shades of orange emerging from the green that dominates the summer, and the ground remains blissfully free of fallen leaves. In an attempt to capture this period, the tiles seek to evoke the warmth and colors of a Midwest autumn.</p>
      `,
    "research": `
      <b><h1 class="header">research</h1></b>
      <p class="para">My research interests lie broadly in cryptography and algorithms though I love exploring new fields and would hate to box myself in before I start a graduate program. Despite my hesitancy to commit entirely, I have thoroughly enjoyed my time working on the following lines of inquiry:
      
      <b>Multi-party Computation</b>: How can multiple parties collaboratively compute a function over their private inputs without revealing those inputs to each other?

      <b>Random Numbers</b>: How can we generate a long sequence of numbers, from a short deterministic input, that appears random and passes statistical tests for randomness even though it is not truly random?
      
      <b>Error-Correcting Codes</b>: How can we encode data so it can be accurately reconstructed even after errors during transmission or storage?

      <b>Data Compression</b>: How can we represent data more efficiently while preserving its original information?

      <b>Online Algorithms</b>: How can we make decisions or process input sequentially without knowing future data?

      As stated earlier, this is not an exhaustive list and I am always open to exploring new topics. 
      </p>
    `,
    "about me": `
      <b><h1 class="header">about me :)</h1></b>
      <p class="para">Hi! I'm an undergraduate student majoring in mathematics and computer Science at UW-Madison and I'm interested in theoretical computer science which I hope to pursue at a graduate school starting in Fall 2026. I am currently employed as a programmer at the Space Science and Engineering Center where I work on products that talk to satellites and process their data! I am also involved with research in secure multi-party computation and soon random number generation. I have taken graduate coursework in algorithms and, soon, in cryptography. If you'd like to learn more about my work, please reach out to me by mail. I try to respond quickly!</p>
    `,
    "contact": `
      <b><h1 class="header">contact</h1></b>
      <p class="para">Email: {first initial} {last name} {thirty five in decimal} ampersand wisc dot edu
      Github: <a href="https://github.com/spaceybread">/spaceybread</a>
      Bluesky: <a href="https://bsky.app/profile/spaceybread.bsky.social">@spaceybread.bsky.social</a>
      Instagram: <a href="https://www.instagram.com/spaceybread0/">/spaceybread0</a>
      
      ...</p>
    `,
    "misc.": `
      <b><h1 class="header">miscellaneous</h1></b>
      <p class="para">I help run the <a href="https://csec.cs.wisc.edu/">Cybersecurity Club [/]</a> at UW-Madison and I'm also a part of UW-Madison's CTF team, 0xbad9e125! 
      
      I also enjoy science communication and write about things in mathematics, computer science, and occasionally physics over at <a href="https://kleinbottlebar.wordpress.com/">kleinbottlebar [/]</a>. My inspirations for science writing and communication include <a href="https://simonsingh.net/">Dr. Simon Singh [/]</a>, <a href="https://www.youtube.com/@BobbyBroccoli/featured">BobbyBroccoli [/]</a>, <a href="https://www.youtube.com/@numberphile">Numberphile [/]</a>, and <a href="https://www.youtube.com/@acollierastro">Dr. Angela Collier [/].</a> Check them out! 

      I try to help edit Wikipedia articles, though not as much as I'd like to! 
      
      ---

      “I wish it need not have happened in my time," said Frodo. "So do I," said Gandalf, "and so do all who live to see such times. But that is not for them to decide. All we have to decide is what to do with the time that is given us.” ― J.R.R. Tolkien</p>
    
    <iframe id="bucket-webring" style="width: 100%; height: 3rem; border: none;" src="https://webring.bucketfish.me/embed.html?name=Spacey!"></iframe>


    `,
  };
  
// LinkedIn: <a href="https://www.linkedin.com/in/spaceyloaf/">/spaceyloaf</a>
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
