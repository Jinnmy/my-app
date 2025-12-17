const express = require('express');
const router = express.Router();
const { systemController } = require('../controllers/systemController');

router.get('/disks', systemController.getDisks);
router.post('/startup', systemController.setStartup);
router.post('/storage', systemController.saveStorageConfig);
router.get('/stats', systemController.getStorageStats);

module.exports = router;
