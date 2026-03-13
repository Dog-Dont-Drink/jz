function generate6DigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))
}

module.exports = {
  generate6DigitCode,
  isValidEmail,
}

