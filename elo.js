function calculateElo() {
  // Get values from the input text boxes
  var player1Rating = parseFloat(document.getElementById('r1').value);
  var player2Rating = parseFloat(document.getElementById('r2').value);
  var kValue = parseFloat(document.getElementById('k').value);


  var expecA = (1 + 10**((player2Rating - player1Rating)/400))**(-1);
  var expecB = (1 + 10**((player1Rating - player2Rating)/400))**(-1);

  document.getElementById('expecA').textContent = expecA;
  document.getElementById('expecB').textContent = expecB;
}
