const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const routes = require('./src/routes/index')
const errorHandler = require('./src/middleware/errorHandler')

const app = express()

app.use(cors({
  origin: process.env.CLIENT_ORIGIN,
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

app.use('/api/v1', routes)

app.use(errorHandler)

module.exports = app
