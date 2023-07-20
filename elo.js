function calculateElo() {
  // Get values from the input text boxes
  var player1Rating = parseFloat(document.getElementById('r1').value);
  var player2Rating = parseFloat(document.getElementById('r2').value);
  var kValue = parseFloat(document.getElementById('k').value);

  // Calculate the sum of player1Rating and player2Rating
  var result = player1Rating + player2Rating;

  // Update the 'result' span element with the calculated sum
  document.getElementById('result').textContent = result;
}
