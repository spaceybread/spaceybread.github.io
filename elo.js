function calculateElo() {
  // Get values from the input text boxes
  var num1 = parseFloat(document.getElementById('r1').value);
  var num2 = parseFloat(document.getElementById('r2').value);

  // Calculate the sum
  var sum = num1 + num2;

  // Set the result as the value of the 'result' span element
  document.getElementById('result').textContent = sum;
}
