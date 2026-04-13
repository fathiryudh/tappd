const prisma = require('../config/prisma')

const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'YAPPD']
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

const getTasks = async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { userId: req.user.sub },
    orderBy: { position: 'asc' },
  })
  res.json({ tasks })
}

const createTask = async (req, res) => {
  const { title, description, status, priority, tag, dueDate } = req.body

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    const err = new Error('Title is required')
    err.status = 400
    throw err
  }

  const resolvedStatus = status && VALID_STATUSES.includes(status) ? status : 'TODO'
  const resolvedPriority = priority && VALID_PRIORITIES.includes(priority) ? priority : 'MEDIUM'

  const aggregate = await prisma.task.aggregate({
    where: { userId: req.user.sub, status: resolvedStatus },
    _max: { position: true },
  })
  const nextPosition = (aggregate._max.position ?? -1) + 1

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      status: resolvedStatus,
      priority: resolvedPriority,
      tag: tag?.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      position: nextPosition,
      userId: req.user.sub,
    },
  })

  res.status(201).json(task)
}

const updateTask = async (req, res) => {
  const { id } = req.params

  const existing = await prisma.task.findFirst({
    where: { id, userId: req.user.sub },
  })
  if (!existing) {
    const err = new Error('Task not found')
    err.status = 404
    throw err
  }

  const { title, description, status, priority, tag, dueDate, position } = req.body
  const updateData = {}

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      const err = new Error('Title cannot be empty')
      err.status = 400
      throw err
    }
    updateData.title = title.trim()
  }
  if (description !== undefined) updateData.description = description?.trim() || null
  if (tag !== undefined) updateData.tag = tag?.trim() || null
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
  if (position !== undefined) updateData.position = position

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`)
      err.status = 400
      throw err
    }
    updateData.status = status
    if (status === 'YAPPD' && existing.status !== 'YAPPD') {
      updateData.completedAt = new Date()
    } else if (status !== 'YAPPD' && existing.status === 'YAPPD') {
      updateData.completedAt = null
    }
  }

  if (priority !== undefined) {
    if (!VALID_PRIORITIES.includes(priority)) {
      const err = new Error(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`)
      err.status = 400
      throw err
    }
    updateData.priority = priority
  }

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
  })

  res.json(task)
}

const deleteTask = async (req, res) => {
  const { id } = req.params

  const existing = await prisma.task.findFirst({
    where: { id, userId: req.user.sub },
  })
  if (!existing) {
    const err = new Error('Task not found')
    err.status = 404
    throw err
  }

  await prisma.task.delete({ where: { id } })
  res.json({ message: 'Task deleted' })
}

const reorderTasks = async (req, res) => {
  const { updates } = req.body

  if (!Array.isArray(updates) || updates.length === 0) {
    const err = new Error('updates must be a non-empty array')
    err.status = 400
    throw err
  }

  const ids = updates.map(u => u.id)
  const ownedTasks = await prisma.task.findMany({
    where: { id: { in: ids }, userId: req.user.sub },
    select: { id: true },
  })
  const ownedIds = new Set(ownedTasks.map(t => t.id))

  for (const u of updates) {
    if (!ownedIds.has(u.id)) {
      const err = new Error('Forbidden')
      err.status = 403
      throw err
    }
  }

  await prisma.$transaction(
    updates.map(u =>
      prisma.task.update({
        where: { id: u.id },
        data: {
          position: u.position,
          ...(u.status ? { status: u.status } : {}),
        },
      })
    )
  )

  res.json({ message: 'Reordered' })
}

module.exports = { getTasks, createTask, updateTask, deleteTask, reorderTasks }
