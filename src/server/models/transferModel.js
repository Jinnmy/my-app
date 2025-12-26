const db = require('../config/database');

const initTransferTable = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT NOT NULL CHECK(type IN ('upload', 'download')),
            source TEXT NOT NULL,
            destination TEXT,
            metadata TEXT, 
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `;
    db.run(sql, (err) => {
        if (err) {
            console.error('Error creating transfers table:', err.message);
        } else {
            console.log('Transfers table ready.');
        }
    });
};

initTransferTable();

class TransferModel {
    static create(transfer, callback) {
        const { user_id, type, source, destination, metadata } = transfer;
        const sql = `INSERT INTO transfers (user_id, type, source, destination, metadata, status) VALUES (?, ?, ?, ?, ?, 'pending')`;
        db.run(sql, [user_id, type, source, destination, JSON.stringify(metadata)], function (err) {
            callback(err, { id: this.lastID, ...transfer, status: 'pending' });
        });
    }

    static findById(id, callback) {
        const sql = `SELECT * FROM transfers WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            if (row && row.metadata) {
                try {
                    row.metadata = JSON.parse(row.metadata);
                } catch (e) {
                    row.metadata = {};
                }
            }
            callback(err, row);
        });
    }

    static findAllByUser(userId, callback) {
        const sql = `SELECT * FROM transfers WHERE user_id = ? ORDER BY created_at DESC`;
        db.all(sql, [userId], (err, rows) => {
            if (rows) {
                rows.forEach(row => {
                    if (row.metadata) {
                        try {
                            row.metadata = JSON.parse(row.metadata);
                        } catch (e) {
                            row.metadata = {};
                        }
                    }
                });
            }
            callback(err, rows);
        });
    }

    static findPending(callback) {
        const sql = `SELECT * FROM transfers WHERE status = 'pending' ORDER BY created_at ASC`;
        db.all(sql, [], (err, rows) => {
            if (rows) {
                rows.forEach(row => {
                    if (row.metadata) {
                        try {
                            row.metadata = JSON.parse(row.metadata);
                        } catch (e) {
                            row.metadata = {};
                        }
                    }
                });
            }
            callback(err, rows);
        });
    }

    static updateStatus(id, status, errorMessage = null, callback) {
        let sql = `UPDATE transfers SET status = ?, updated_at = CURRENT_TIMESTAMP`;
        const params = [status];

        if (errorMessage) {
            sql += `, error_message = ?`;
            params.push(errorMessage);
        }

        sql += ` WHERE id = ?`;
        params.push(id);

        db.run(sql, params, function (err) {
            if (callback) callback(err);
        });
    }

    // For processing queue, we might want to lock/check count
    static countProcessing(callback) {
        const sql = `SELECT COUNT(*) as count FROM transfers WHERE status = 'processing'`;
        db.get(sql, [], (err, row) => {
            callback(err, row ? row.count : 0);
        });
    }

    static resetProcessing(callback) {
        const sql = `UPDATE transfers SET status = 'pending' WHERE status = 'processing'`;
        db.run(sql, [], function (err) {
            callback(err, (this && this.changes) ? this.changes : 0);
        });
    }
    static findLastBackup(userId, callback) {
        // We look for transfers that are uploads and have the isBackup flag in metadata
        // We use LIKE as a heuristic since JSON parsing in WHERE clauses depends on sqlite compile options
        const sql = `SELECT * FROM transfers WHERE user_id = ? AND type = 'upload' AND metadata LIKE '%"isBackup":true%' ORDER BY created_at DESC LIMIT 1`;

        db.get(sql, [userId], (err, row) => {
            if (row && row.metadata) {
                try {
                    row.metadata = JSON.parse(row.metadata);
                } catch (e) {
                    row.metadata = {};
                }
            }
            callback(err, row);
        });
    }
}

module.exports = TransferModel;
