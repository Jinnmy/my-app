const express = require('express');
const router = express.Router();
const VaultController = require('../controllers/vaultController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/enable', verifyToken, VaultController.enableVault);
router.post('/disable', verifyToken, VaultController.disableVault);
router.post('/verify', verifyToken, VaultController.verifyPassword);
router.get('/status', verifyToken, VaultController.getStatus);

module.exports = router;
