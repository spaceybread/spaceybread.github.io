function calculateElo() {
  var player1Rating = parseFloat(document.getElementById('r1').value);
  var player2Rating = parseFloat(document.getElementById('r2').value);
  var kValue = parseFloat(document.getElementById('k').value);


  var expecA = (1 + 10**((player2Rating - player1Rating)/400))**(-1);
  var expecB = (1 + 10**((player1Rating - player2Rating)/400))**(-1);

  // new rating = rating + k * (score - expected score) 
  // win = 1, draw = 0.5, loss = 0
  
  var winAratA = player1Rating + kValue * (1 - expecA);  
  var winAratB = player2Rating + kValue * (0 - expecB);  

  var winDratA = player1Rating + kValue * (0.5 - expecA);  
  var winDratB = player2Rating + kValue * (0.5 - expecB);

  var winBratA = player1Rating + kValue * (0 - expecA);  
  var winBratB = player2Rating + kValue * (1 - expecB);

  document.getElementById('expecA').textContent = expecA;
  document.getElementById('expecB').textContent = expecB;
  document.getElementById('winAratA').textContent = winAratA;
  document.getElementById('winAratB').textContent = winAratB;
  document.getElementById('winDratA').textContent = winDratA;
  document.getElementById('winDratB').textContent = winDratB;
  document.getElementById('winBratA').textContent = winBratA;
  document.getElementById('winBratB').textContent = winBratB;
}
