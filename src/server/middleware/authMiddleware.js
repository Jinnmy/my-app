const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ error: 'No token provided' });
    }

    // Expecting "Bearer <token>"
    const bearer = token.split(' ');
    const bearerToken = bearer[1];

    if (!bearerToken) {
        return res.status(403).json({ error: 'Malformed token' });
    }

    jwt.verify(bearerToken, 'your-secret-key', (err, decoded) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to authenticate token' });
        }

        // Save to request for use in other routes
        req.user = decoded;
        next();
    });
};

module.exports = verifyToken;
