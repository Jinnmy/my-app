const db = require('../config/database');

// Initialize User table
const initUserTable = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            storage_limit INTEGER DEFAULT 10737418240, -- 10GB default
            used_storage INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.run(sql, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table ready.');
            // Migration: Add role column if it doesn't exist (for existing databases)
            const migrationSql = `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`;
            db.run(migrationSql, (err) => {
                // Ignore error if column already exists
                if (!err) {
                    console.log('Added role column to users table.');
                }
            });

            // Migration: Add storage columns
            const migrationStorage = `ALTER TABLE users ADD COLUMN storage_limit INTEGER DEFAULT 10737418240`;
            db.run(migrationStorage, (err) => {
                if (!err) console.log('Added storage_limit column.');
            });
            const migrationUsed = `ALTER TABLE users ADD COLUMN used_storage INTEGER DEFAULT 0`;
            db.run(migrationUsed, (err) => {
                if (!err) console.log('Added used_storage column.');
            });
        }
    });
};

initUserTable();

class UserModel {
    static create(user, callback) {
        const { username, email, password, role } = user;
        const userRole = role || 'user';
        const sql = `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`;
        db.run(sql, [username, email, password, userRole], function (err) {
            callback(err, { id: this.lastID, ...user, role: userRole });
        });
    }

    static findByEmail(email, callback) {
        const sql = `SELECT * FROM users WHERE email = ?`;
        db.get(sql, [email], (err, row) => {
            callback(err, row);
        });
    }

    static findById(id, callback) {
        const sql = `SELECT * FROM users WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            callback(err, row);
        });
    }

    static findAll(callback) {
        const sql = `SELECT * FROM users`;
        db.all(sql, [], (err, rows) => {
            callback(err, rows);
        });
    }

    // Storage Management Methods
    static updateStorage(userId, delta, callback) {
        const sql = `UPDATE users SET used_storage = used_storage + ? WHERE id = ?`;
        db.run(sql, [delta, userId], function (err) {
            if (callback) callback(err, this.changes);
        });
    }

    static recalculateStorage(userId, callback) {
        // Sum size of all files owned by user
        const sql = `
            SELECT SUM(size) as total_size 
            FROM files 
            WHERE user_id = ?
        `;
        db.get(sql, [userId], (err, row) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            const totalSize = row.total_size || 0;
            const updateSql = `UPDATE users SET used_storage = ? WHERE id = ?`;
            db.run(updateSql, [totalSize, userId], (err) => {
                if (callback) callback(err, totalSize);
            });
        });
    }

    static update(id, user, callback) {
        const { username, email, role, storage_limit } = user;
        // Construct SQL dynamically based on provided fields? 
        // For now, let's assume full update or handling partials carefully.
        // Actually simplest is to update specific fields. 
        // If password is provided, it should be updated separately or here.
        // Let's stick to updating main info. Password change usually separate flow but can be here.

        let sql = `UPDATE users SET username = ?, email = ?, role = ?, storage_limit = ? WHERE id = ?`;
        let params = [username, email, role, storage_limit, id];

        if (user.password) {
            sql = `UPDATE users SET username = ?, email = ?, role = ?, storage_limit = ?, password = ? WHERE id = ?`;
            params = [username, email, role, storage_limit, user.password, id];
        }

        db.run(sql, params, function (err) {
            callback(err, this.changes);
        });
    }

    static delete(id, callback) {
        const sql = `DELETE FROM users WHERE id = ?`;
        db.run(sql, [id], function (err) {
            callback(err, this.changes);
        });
    }

    static getTotalAllocation(callback) {
        const sql = `SELECT SUM(storage_limit) as total FROM users`;
        db.get(sql, [], (err, row) => {
            callback(err, row ? row.total : 0);
        });
    }
}

module.exports = UserModel;
