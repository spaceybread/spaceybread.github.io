const outputDiv = document.getElementById("output");
const inputField = document.getElementById("command-input");

const commands = {
  "help": (args) => {
    return "help - shows available commands\nhello - prints a hello message\ndate - shows current date\necho <message> - echos the given message\nmath add <num1> <num2> - adds two numbers\nmath mult <num1> <num2> - multiply two numbers\nopenl <url> - creates a new tab to the url\nclear - reloads this page";
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
    "clear": () => {
        location.reload();
    },
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
