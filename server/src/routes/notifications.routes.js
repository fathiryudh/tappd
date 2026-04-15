const router = require('express').Router()
const authenticate = require('../middleware/authenticate')
const {
  getNotifications,
  markAllNotificationsRead,
} = require('../controllers/notifications.controller')

router.use(authenticate)

router.get('/', getNotifications)
router.post('/read-all', markAllNotificationsRead)

module.exports = router
