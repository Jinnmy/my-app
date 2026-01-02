const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { systemController } = require('../controllers/systemController');

router.get('/disks', systemController.getDisks);
router.post('/startup', systemController.setStartup);
router.post('/storage', systemController.saveStorageConfig);
router.get('/stats', systemController.getStorageStats);
router.get('/status', systemController.getSystemStatus);
router.get('/ai-stats', verifyToken, systemController.getAiStats);
router.post('/factory-reset', verifyToken, systemController.factoryReset);

module.exports = router;
