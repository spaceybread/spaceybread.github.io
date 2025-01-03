const outputDiv = document.getElementById("output");
const inputField = document.getElementById("command-input");

const commands = {
  "help": (args) => {
    return "========================================================================\nhelp - shows available commands\nhello - prints a hello message\ndate - shows current date\necho <message> - echos the given message\nmath add <num1> <num2> - adds two numbers\nmath mult <num1> <num2> - multiply two numbers\nopenl <url> - creates a new tab to the url\nstructure - directory structure\nclear - reloads this page\nexit - return to home page\n========================================================================";
  },
  "hello": () => "Hello, user!",
  "date": () => new Date().toString(),
  "echo": (args) => args ? args.join(" ") : "No message provided",
  "math": (args) => {
    if (args[0] === "add" && args.length === 3) {
      const num1 = parseFloat(args[1]);
      const num2 = parseFloat(args[2]);
      if (!isNaN(num1) && !isNaN(num2)) {
        return `${num1 + num2}`;
      }
      return "Invalid numbers for addition.";
    }
    if (args[0] === "mult" && args.length === 3) {
        const num1 = parseFloat(args[1]);
        const num2 = parseFloat(args[2]);
        if (!isNaN(num1) && !isNaN(num2)) {
            return `${num1 * num2}`;
        }
        return "Invalid numbers for multiplication.";
      }
    return "Usage: math <operation> <num1> <num2>";
  },
    "openl": (args) => {
        if (args.length == 1) {
            let url = args[0];
            if (!/^https?:\/\//i.test(url)) {
                url = `https://${url}`;
            }
            window.open(url, "_blank");
            return "See ya!"
        }
        return "Usage: openl <link>";
    },
    "exit": () => {
        window.open("https://spaceybread.github.io/", "_self");
    },
    "clear": () => {
        location.reload();
    },
    "structure": () => {
        return `
├── elo.html
├── https:
├── index.html
├── mcv.html
├── md
│   ├── links.MD
│   └── todo.MD
├── media
│   ├── 8plot.gif
│   ├── IMG_2165.webp
│   ├── badApple.gif
│   ├── db6075.png
│   ├── enigma_machine.png
│   ├── icon.ico
│   ├── idkhowwegothere.jpg
│   ├── mail_swamp_cropped.png
│   ├── mand.jpg
│   ├── mcv
│   ├── oneko.gif
│   ├── orbits.gif
│   ├── sudoku_uncolored_dense.png
│   └── sudoku_uncolored_dense_square.png
├── new_bio.html
├── new_bio.html~
├── new_bio_2.html
├── nflelo.html
├── nfleloranked.html
├── old_landing.html
├── pi.html
├── primeGen.html
├── robots.txt
├── rot13.html
├── scripts
│   ├── elo.js
│   ├── landing.js
│   ├── oneko.js
│   └── rot13.js
├── stylesheets
│   ├── landing.css
│   ├── mcv.css
│   ├── new_landing.css
│   └── styles.css
└── terminal
    ├── script.js
    ├── style.css
    └── terminal.html
`
    }
};

inputField.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const input = inputField.value.trim();
    addOutputLine(`$ ${input}`);
    processCommand(input);
    inputField.value = "";
  }
});

function processCommand(input) {
  const [command, ...args] = input.split(" ");
  const commandFunc = commands[command.toLowerCase()];

  const response = commandFunc ? commandFunc(args) : `Unknown command: ${command}`;
  addOutputLine(response);
}

function addOutputLine(text) {
  const line = document.createElement("div");
  line.textContent = text;
  outputDiv.appendChild(line);
  outputDiv.scrollTop = outputDiv.scrollHeight;
}
