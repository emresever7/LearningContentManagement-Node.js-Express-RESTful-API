const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, admin } = require('../middleware/authMiddleware');

// ****************************************
// Sadece Admin'lerin Erişebileceği Rotalar
// ****************************************

// @route   POST /api/admin/users/register
router.post('/register', protect, admin, async (req, res) => {
    const { username, password, role } = req.body;
    
    try {
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'Bu kullanıcı adı zaten mevcut.' });
        }
        
        const user = await User.create({ username, password, role: role || 'editor' });

        res.status(201).json({
            _id: user._id,
            username: user.username,
            role: user.role,
        });

    } catch (error) {
        res.status(500).json({ message: 'Kullanıcı oluşturma hatası.', error: error.message });
    }
});


// @route   GET /api/admin/users
router.get('/', protect, admin, async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Kullanıcılar listelenemedi.', error: error.message });
    }
});

// @route   DELETE /api/admin/users/:id
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            const adminCount = await User.countDocuments({ role: 'admin' });

            if (user.role === 'admin' && adminCount <= 1) {
                return res.status(403).json({ 
                    message: 'Sistemde en az bir Admin kalmalıdır. Son Admin kullanıcısını silemezsiniz.' 
                });
            }
            
            if (user._id.toString() === req.user._id.toString()) {
                return res.status(403).json({ 
                    message: 'Kendi hesabınızı bu arayüz üzerinden silemezsiniz.' 
                });
            }

            await user.deleteOne();
            res.json({ message: 'Kullanıcı başarıyla silindi.' });

        } else {
            res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Kullanıcı silinirken bir hata oluştu.', error: error.message });
    }
});



// ****************************************
// Oturum Açmış Kullanıcının Kendisine Ait Rotalar
// ****************************************

// @route   PUT /api/admin/users/profile
// @desc    Oturum Açmış Kullanıcının Kendi Profilini/Şifresini Güncelleme
router.put('/profile', protect, async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        if (req.body.username) {
             user.username = req.body.username;
        }

        if (req.body.newPassword) {
            user.password = req.body.newPassword; 
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            role: updatedUser.role,
            message: 'Profil başarıyla güncellendi.',
        });
    } else {
        res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }
});


module.exports = router;