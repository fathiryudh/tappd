const { verifyAccessToken } = require('../utils/jwt')

module.exports = function authenticate(req, res, next) {
  const token = req.cookies.access_token
  if (!token) {
    const err = new Error('Unauthorized')
    err.status = 401
    return next(err)
  }
  const decoded = verifyAccessToken(token)
  req.user = decoded
  next()
}
