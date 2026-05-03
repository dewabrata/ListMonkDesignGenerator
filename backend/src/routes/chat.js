const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { revise } = require('../controllers/chatController');

router.post('/revise', requireAuth, revise);

module.exports = router;
