const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
require('express-async-errors')

const app = require('./app')

const PORT = process.env.PORT || 8000

app.listen(PORT, () => {
  console.log(`Tappd server running on port ${PORT}`)
})
