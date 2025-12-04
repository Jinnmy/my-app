const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the public client directory
app.use(express.static(path.join(__dirname, '../ui/public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../ui/public/index.html'));
});

// Example API endpoint
app.get('/api/status', (req, res) => {
    res.json({ status: 'running', message: 'NAS Server is active' });
});

function startServer() {
    app.listen(port, () => {
        console.log(`NAS Server running at http://localhost:${port}`);
    });
}

module.exports = { startServer };
