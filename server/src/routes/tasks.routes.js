const { Router } = require('express')
const authenticate = require('../middleware/authenticate')
const {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
} = require('../controllers/tasks.controller')

const router = Router()

router.use(authenticate)

router.get('/', getTasks)
router.post('/', createTask)
router.patch('/reorder', reorderTasks)  // must be before /:id
router.patch('/:id', updateTask)
router.delete('/:id', deleteTask)

module.exports = router
