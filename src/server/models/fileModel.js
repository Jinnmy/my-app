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

    // Create Shared Files Table
    const shareSql = `
        CREATE TABLE IF NOT EXISTS shared_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL, -- User who receives access
            permission TEXT DEFAULT 'view', -- 'view' or 'edit'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(file_id, user_id)
        )
    `;
    db.run(shareSql, (err) => {
        if (err) console.error('Error creating shared_files table:', err.message);
        else console.log('Shared files table ready.');
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
        // If parentId is NULL (root), we want own files AND shared files
        // But files shared with me should probably appear in a specific "Shared with me" section or mixed in root?
        // Let's mix them in root for now, or strict separate folder.
        // User request: "right click ... share ... user to share with".
        // Usually these appear in root or "Shared" folder.
        // Let's simply include them in the root listing if parentId is null.

        let sql = ``;
        let params = [];

        if (parentId) {
            // Inside a folder: Strict ownership or if the user has access to this parent folder?
            // Simplification: If you have access to parent, you see its children.
            // But checking parent permission recursively is complex in SQL.
            // For now: Only show owned files in subfolders. 
            // Ideally we check if parent is shared with user. 

            // 1. Check if parent folder is shared with user
            const checkShare = `SELECT 1 FROM shared_files WHERE file_id = ? AND user_id = ?`;
            db.get(checkShare, [parentId, userId], (err, row) => {
                if (row) {
                    // Parent is shared, so list its children
                    sql = `SELECT * FROM files WHERE parent_id = ?`;
                    db.all(sql, [parentId], (err, rows) => callback(err, rows));
                } else {
                    // Parent not shared explicitly, check ownership.
                    // If user owns parent, they see files.
                    sql = `SELECT * FROM files WHERE user_id = ? AND parent_id = ?`;
                    db.all(sql, [userId, parentId], (err, rows) => callback(err, rows));
                }
            });
            return; // Async handled above
        } else {
            // Root: Own files (parent is null) OR Shared files (files shared with me)
            // Note: Shared files might be deep inside structure but if shared explicitly, they appear.
            // Assumption: We only show items shared at root or items moved to root? 
            // Better: Show all files where I am owner AND parent is NULL
            // PLUS all files where I am in shared_files.

            sql = `
                SELECT f.*, 'owner' as role FROM files f 
                WHERE f.user_id = ? AND f.parent_id IS NULL
                
                UNION
                
                SELECT f.*, sf.permission as role FROM files f
                JOIN shared_files sf ON f.id = sf.file_id
                WHERE sf.user_id = ?
            `;
            params = [userId, userId];

            db.all(sql, params, (err, rows) => {
                callback(err, rows);
            });
        }
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

    // Share Methods
    static share(fileId, targetUserId, permission, callback) {
        const sql = `INSERT OR REPLACE INTO shared_files (file_id, user_id, permission) VALUES (?, ?, ?)`;
        db.run(sql, [fileId, targetUserId, permission], function (err) {
            callback(err);
        });
    }

    static unshare(fileId, targetUserId, callback) {
        const sql = `DELETE FROM shared_files WHERE file_id = ? AND user_id = ?`;
        db.run(sql, [fileId, targetUserId], function (err) {
            callback(err);
        });
    }

    static getSharedUsers(fileId, callback) {
        const sql = `
            SELECT u.id, u.username, u.email, sf.permission
            FROM users u
            JOIN shared_files sf ON u.id = sf.user_id
            WHERE sf.file_id = ?
        `;
        db.all(sql, [fileId], (err, rows) => callback(err, rows));
    }
}

module.exports = FileModel;
