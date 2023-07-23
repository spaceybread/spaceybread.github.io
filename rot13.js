function rotate() {

  var inputText = str=document.getElementById("in").value;
  const splitText = inputText.split("");
  const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', ' '];

  //look for letter in the alphabet and write that index in the list
  var rotString = "";

  for (let i = 0; i < splitText.length; i++) {

    if (splitText[i] == " ") {
        a = 26;
    } else {
        var aText = splitText[i];
        var a = alphabet.indexOf(aText);
        a = a + 1;
        //nothing but for my sanity while doing mod functions
        a = a + 13;
        a = a % 26;
        a = a - 1;
    }

    rotString = rotString.concat(alphabet[a]);
  }


  document.getElementById('out').textContent = rotString;
}
