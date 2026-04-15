const prisma = require('../config/prisma')

const getNotifications = async (req, res) => {
  const take = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50)

  const [items, unreadCount] = await Promise.all([
    prisma.notificationEvent.findMany({
      where: { adminId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        officer: {
          include: {
            division: true,
            branch: true,
          },
        },
      },
    }),
    prisma.notificationEvent.count({
      where: { adminId: req.user.sub, readAt: null },
    }),
  ])

  res.json({ items, unreadCount })
}

const markAllNotificationsRead = async (req, res) => {
  await prisma.notificationEvent.updateMany({
    where: { adminId: req.user.sub, readAt: null },
    data: { readAt: new Date() },
  })

  res.json({ ok: true })
}

module.exports = { getNotifications, markAllNotificationsRead }
