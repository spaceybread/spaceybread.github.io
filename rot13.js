function rotate() {

  var inputText = str=document.getElementById("in").value;
  const splitText = inputText.split();
  const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];   

  //look for letter in the alphabet and write that index in the list

  let textLength = splitText.length;
  const textAsNumber = [];

  for (let i = 0; i < textLength; i++) {
    textAsNumber.push(alphabet.indexOf(splitText[i]));
  }

  document.getElementById('out').textContent = textAsNumber;
}

