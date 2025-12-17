const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settingsController');
const verifyToken = require('../middleware/authMiddleware');

// Middleware to check if user is admin
const verifyAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ error: 'Require Admin Role' });
    }
};

router.get('/', verifyToken, verifyAdmin, SettingsController.getSettings);
router.post('/', verifyToken, verifyAdmin, SettingsController.updateSettings);

module.exports = router;
