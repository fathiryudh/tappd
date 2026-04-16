const prisma = require('../config/prisma')
const {
  DEFAULT_NOTIFICATION_LIMIT,
  MAX_NOTIFICATION_LIMIT,
  OFFICER_RELATION_INCLUDE,
  serializeNotificationsPayload,
  serializeSuccessResponse,
} = require('../../../shared/contracts/api')

const getNotifications = async (req, res) => {
  const take = Math.min(
    Math.max(Number(req.query.limit) || DEFAULT_NOTIFICATION_LIMIT, 1),
    MAX_NOTIFICATION_LIMIT,
  )

  const [items, unreadCount] = await Promise.all([
    prisma.notificationEvent.findMany({
      where: { adminId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        officer: {
          include: OFFICER_RELATION_INCLUDE,
        },
      },
    }),
    prisma.notificationEvent.count({
      where: { adminId: req.user.sub, readAt: null },
    }),
  ])

  res.json(serializeNotificationsPayload({ items, unreadCount }))
}

const markAllNotificationsRead = async (req, res) => {
  await prisma.notificationEvent.updateMany({
    where: { adminId: req.user.sub, readAt: null },
    data: { readAt: new Date() },
  })

  res.json(serializeSuccessResponse())
}

module.exports = { getNotifications, markAllNotificationsRead }
