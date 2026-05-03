const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { startProcess, getStatus } = require('../controllers/uploadController');

router.post('/', requireAuth, startProcess);
router.get('/:jobId/status', requireAuth, getStatus);

module.exports = router;
