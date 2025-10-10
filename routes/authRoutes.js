const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '2h',
    });
};

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userExists = await User.findOne({ username });

        if (userExists) {
            return res.status(400).json({ message: 'Bu kullanıcı adı zaten kullanılıyor.' });
        }

        const user = await User.create({
            username,
            password,
            role: 'admin',
        });

        res.status(201).json({
            _id: user._id,
            username: user.username,
            token: generateToken(user._id),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Kullanıcı kaydı başarısız.', error: error.message });
    }
});


router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });

        // Kullanıcı varsa ve şifre eşleşiyorsa
        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Geçersiz kullanıcı adı veya şifre.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Giriş işlemi başarısız.' });
    }
});


module.exports = router;