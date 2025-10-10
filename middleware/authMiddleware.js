const jwt = require('jsonwebtoken');
const User = require('../models/User');


const protect = async (req, res, next) => {
    let token;

    const secret = process.env.JWT_SECRET;

    if (req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, secret);

            req.user = await User.findById(decoded.id).select('-password');

            next();
        } catch (error) {

            res.status(401).json({ message: 'Yetkilendirme başarısız, token geçersiz.' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Yetkilendirme başarısız, token yok.' });
    }
};


const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Bu işlem için yetkiniz (Admin rolü) yoktur.' });
    }
};

module.exports = { protect, admin }; 