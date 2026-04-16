function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 10 && digits.startsWith('65')) return digits.slice(2)
  if (digits.length === 8) return digits
  return digits
}

module.exports = {
  normalizePhone,
}
