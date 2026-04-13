const router = require('express').Router()
const authenticate = require('../middleware/authenticate')
const {
  getOfficers,
  addOfficer,
  updateOfficer,
  deleteOfficer,
  getRoster,
} = require('../controllers/officers.controller')

router.use(authenticate)

router.get('/roster', getRoster)   // must be before /:id
router.get('/', getOfficers)
router.post('/', addOfficer)
router.patch('/:id', updateOfficer)
router.delete('/:id', deleteOfficer)

module.exports = router
