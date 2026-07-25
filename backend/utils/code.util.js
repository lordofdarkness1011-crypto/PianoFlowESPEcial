const crypto = require("crypto");

function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

module.exports = {
  generateVerificationCode
};