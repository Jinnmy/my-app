const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let dbPath = path.resolve(__dirname, '../../database.sqlite');

try {
    const { app } = require('electron');
    // If we are in the main process of Electron (or capable of accessing it via remote/helper)
    // Note: server.js is often spawned as a separate process or runs in main. 
    // If spawned as child_process of main, we might need to pass the path via env var or arg.
    // However, looking at main.js, server is started FROM main.js in the SAME process.
    if (app) {
        dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    }
} catch (e) {
    // Not running in Electron or app not available immediately
    // If server is imported in main.js, 'electron' is available.
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

module.exports = db;
