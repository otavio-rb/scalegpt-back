function sanitizeInput(input) {
    Object.keys(input).forEach(key => {
      if (input[key] === 'null') {
        input[key] = "";
      }
    });
    return input;
}


module.exports = {
    sanitizeInput
}