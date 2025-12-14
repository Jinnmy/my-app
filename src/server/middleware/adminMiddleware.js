const verifyAdmin = (req, res, next) => {
    // verifyToken middleware should have already populated req.user
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Require Admin Role' });
    }

    next();
};

module.exports = verifyAdmin;
