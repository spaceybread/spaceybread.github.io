function rotate() {

  var inputText = str=document.getElementById("in").value;
  const splitText = inputText.split();
  const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];   

  //look for letter in the alphabet and write that index in the list

  var textLength = splitText.length;
  const textAsNumber = [];

  for (let i = 0; i < textLength; i++) {
    var a = alphabet.indexOf(splitText[i]);
    textAsNumber[i] = a;
  }
  
  document.getElementById('out').textContent = textAsNumber;
}

