function rotate() {

  var inputText = str=document.getElementById("in").value;
  inputText = inputText.toLowerCase();
  const splitText = inputText.split("");
  const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

  //look for letter in the alphabet and write that index in the list
  var rotString = "";

  for (let i = 0; i < splitText.length; i++) {
    if (alphabet.indexOf(splitText[i]) == -1) {
      rotString = rotString.concat(splitText[i]);
    } else {
      var aText = splitText[i];
      var a = alphabet.indexOf(aText);
      //nothing but for my sanity while doing mod functions
      a = a + 13;
      a = a % 26;
      rotString = rotString.concat(alphabet[a]);
    }

  }

  document.getElementById('out').textContent = rotString;
}
