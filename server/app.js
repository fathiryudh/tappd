const express = require('express')
const fs = require('fs')
const path = require('path')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const routes = require('./src/routes/index')
const publicRoutes = require('./src/routes/public.routes')
const errorHandler = require('./src/middleware/errorHandler')

const app = express()
const clientDistDir = path.join(__dirname, '../client/dist')
const clientIndexFile = path.join(clientDistDir, 'index.html')
const hasClientBuild = fs.existsSync(clientIndexFile)
const spaRoutes = ['/', '/login', '/register', '/dashboard', '/attendance']

app.set('trust proxy', 1)

if (process.env.CLIENT_ORIGIN) {
  app.use(cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  }))
}

app.use(express.json())
app.use(cookieParser())

if (hasClientBuild) {
  app.use(express.static(clientDistDir))
}

app.use('/', publicRoutes)
app.use('/api/v1', routes)

if (hasClientBuild) {
  app.get(spaRoutes, (req, res) => {
    res.sendFile(clientIndexFile)
  })
}

app.use(errorHandler)

module.exports = app
