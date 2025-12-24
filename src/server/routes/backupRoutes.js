const express = require('express');
const router = express.Router();
const TransferModel = require('../models/transferModel');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/backup/config
// Returns the destination folder of the last successful backup.
// If no backup exists, returns { parentId: null } (Root) or indicates no previous backup.
router.get('/config', verifyToken, (req, res) => {
    const userId = req.user.id;

    TransferModel.findLastBackup(userId, (err, transfer) => {
        if (err) {
            console.error('Error finding last backup:', err);
            return res.status(500).json({ error: 'Failed to retrieve backup config' });
        }

        if (!transfer) {
            // No previous backup found. 
            // We return null to indicate "Let user pick" or "Default to Root" depending on client logic.
            // But client asked for "store the folder path". 
            // If never backed up, user must have done it once? 
            // User req: "user must at least have backedup their photos once so we need to store the folder path"
            // So if generic upload happened, we ignore it. 
            // If NO backup happened, we return null, and app should probably prompt user or use root.
            return res.json({
                parentId: null,
                path: null,
                message: 'No previous backup found'
            });
        }

        const metadata = transfer.metadata || {};

        // We return the parentId where the file resulted. 
        // Note: Transfer metadata stores 'parentId'.
        res.json({
            parentId: metadata.parentId || null,
            // We can also return the full path if needed, but parentId is what the API needs for next upload.
            destination: transfer.destination
        });
    });
});

module.exports = router;
