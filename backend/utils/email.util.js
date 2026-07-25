function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return basicEmailPattern.test(email);
}

module.exports = {
  normalizeEmail,
  isValidEmail
};