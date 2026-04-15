const { Router } = require('express')
const authRoutes = require('./auth.routes')
const healthRoutes = require('./health.routes')
const botRoutes = require('./bot.routes')
const officersRoutes = require('./officers.routes')
const notificationsRoutes = require('./notifications.routes')

const router = Router()

router.use('/auth', authRoutes)
router.use('/health', healthRoutes)
router.use('/bot', botRoutes)
router.use('/officers', officersRoutes)
router.use('/notifications', notificationsRoutes)

module.exports = router
