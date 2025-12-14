const express = require('express');
const router = express.Router();
const TransferController = require('../controllers/transferController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/', verifyToken, TransferController.list);

module.exports = router;
