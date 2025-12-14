const TransferModel = require('../models/transferModel');
const TransferService = require('../services/transferService');

class TransferController {
    static list(req, res) {
        const userId = req.user.id;
        TransferModel.findAllByUser(userId, (err, transfers) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(transfers);
        });
    }

    // In a real system, we might want cancel/retry logic here
    static cancel(req, res) {
        // TODO: Implement cancel logic (stop stream, delete temp file, etc)
        res.status(501).json({ error: 'Not implemented' });
    }
}

module.exports = TransferController;
