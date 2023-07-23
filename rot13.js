function rotate() {

  var inputText = str=document.getElementById("in").value;
  const splitText = inputText.split();
  const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];   

  //look for letter in the alphabet and write that index in the list

  var textLength = splitText.length;
  const textAsNumber = [];

  const rotArray = [];

  for (let i = 0; i < textLength; i++) {
    var aText = splitText[i];
    var a = alphabet.indexOf(aText);
    a = a + 1; 
    //nothing but for my sanity while doing mod functions
    a = a + 13;
    a = a % 26;
    a = a - 1; 

    rotArray[i] = alphabet[a];
  }
  
  let rotString = rotArray.join('');

  document.getElementById('out').textContent = rotString;
}

