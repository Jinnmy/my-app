const db = require('../config/database');

// Initialize Files table
const initFileTable = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('file', 'folder')),
            size INTEGER DEFAULT 0,
            parent_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES files(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `;
    db.run(sql, (err) => {
        if (err) {
            console.error('Error creating files table:', err.message);
        } else {
            console.log('Files table ready.');
            // Migration: Add user_id column if it doesn't exist
            const migrationSql = `ALTER TABLE files ADD COLUMN user_id INTEGER REFERENCES users(id)`;
            db.run(migrationSql, (err) => {
                if (!err) {
                    console.log('Added user_id column to files table.');
                }
            });
        }
    });
};

initFileTable();

class FileModel {
    static create(file, callback) {
        const { name, path, type, size, parent_id, user_id } = file;
        const sql = `INSERT INTO files (name, path, type, size, parent_id, user_id) VALUES (?, ?, ?, ?, ?, ?)`;
        db.run(sql, [name, path, type, size, parent_id, user_id], function (err) {
            callback(err, { id: this.lastID, ...file });
        });
    }

    static findById(id, callback) {
        const sql = `SELECT * FROM files WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            callback(err, row);
        });
    }

    static findByPath(path, callback) {
        const sql = `SELECT * FROM files WHERE path = ?`;
        db.get(sql, [path], (err, row) => {
            callback(err, row);
        });
    }

    static findByParentId(userId, parentId, callback) {
        const sql = parentId
            ? `SELECT * FROM files WHERE user_id = ? AND parent_id = ?`
            : `SELECT * FROM files WHERE user_id = ? AND parent_id IS NULL`;

        const params = parentId ? [userId, parentId] : [userId];

        db.all(sql, params, (err, rows) => {
            callback(err, rows);
        });
    }

    static findAll(callback) {
        const sql = `SELECT * FROM files`;
        db.all(sql, [], (err, rows) => {
            callback(err, rows);
        });
    }

    static updateParent(id, parentId, callback) {
        const sql = `UPDATE files SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [parentId, id], function (err) {
            callback(err);
        });
    }

    static updateLocation(id, parentId, path, callback) {
        const sql = `UPDATE files SET parent_id = ?, path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [parentId, path, id], function (err) {
            callback(err);
        });
    }

    static search(userId, query, type, callback) {
        let sql = `SELECT * FROM files WHERE user_id = ? AND name LIKE ?`;
        const params = [userId, `%${query}%`];

        if (type) {
            sql += ` AND type = ?`;
            params.push(type);
        }

        db.all(sql, params, (err, rows) => {
            callback(err, rows);
        });
    }

    static delete(id, callback) {
        const sql = `DELETE FROM files WHERE id = ?`;
        db.run(sql, [id], function (err) {
            callback(err, this.changes);
        });
    }
}

module.exports = FileModel;
