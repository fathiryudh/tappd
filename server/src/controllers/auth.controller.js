const bcrypt = require('bcrypt')
const prisma = require('../config/prisma')
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt')
const { serializeAuthUser, serializeLogoutResponse } = require('../../../shared/contracts/api')

const SALT_ROUNDS = 12

const cookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: maxAgeMs,
})

const ACCESS_TTL = 15 * 60 * 1000
const REFRESH_TTL = 7 * 24 * 60 * 60 * 1000

const register = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    const err = new Error('Email and password are required')
    err.status = 400
    throw err
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    const err = new Error('Email already in use')
    err.status = 409
    throw err
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const user = await prisma.user.create({ data: { email, passwordHash } })

  const payload = { sub: user.id, email: user.email }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  })

  res.cookie('access_token', accessToken, cookieOptions(ACCESS_TTL))
  res.cookie('refresh_token', refreshToken, cookieOptions(REFRESH_TTL))

  res.status(201).json(serializeAuthUser(user))
}

const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    const err = new Error('Email and password are required')
    err.status = 400
    throw err
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const err = new Error('Invalid credentials')
    err.status = 401
    throw err
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    const err = new Error('Invalid credentials')
    err.status = 401
    throw err
  }

  const payload = { sub: user.id, email: user.email }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  })

  res.cookie('access_token', accessToken, cookieOptions(ACCESS_TTL))
  res.cookie('refresh_token', refreshToken, cookieOptions(REFRESH_TTL))

  res.status(200).json(serializeAuthUser(user))
}

const refresh = async (req, res) => {
  const token = req.cookies.refresh_token
  if (!token) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }

  const decoded = verifyRefreshToken(token)

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } })
  if (!user || user.refreshToken !== token) {
    const err = new Error('Forbidden')
    err.status = 403
    throw err
  }

  const payload = { sub: user.id, email: user.email }
  const accessToken = signAccessToken(payload)

  res.cookie('access_token', accessToken, cookieOptions(ACCESS_TTL))

  res.status(200).json(serializeAuthUser(user))
}

const logout = async (req, res) => {
  const token = req.cookies.refresh_token
  let decoded = null

  if (token) {
    try {
      decoded = verifyRefreshToken(token)
    } catch {
      decoded = null
    }
  }

  if (decoded) {
    await prisma.user.updateMany({
      where: {
        id: decoded.sub,
        refreshToken: token,
      },
      data: { refreshToken: null },
    })
  }

  res.clearCookie('access_token')
  res.clearCookie('refresh_token')

  res.status(200).json(serializeLogoutResponse())
}

module.exports = { register, login, refresh, logout }
