const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const Category = require('../models/Category');

router.get('/all', async (req, res) => {
    try {
        const activities = await Activity.find()
                                         .populate({ 
                                            path: 'category', 
                                            select: 'name',
                                            options: { strictPopulate: false } 
                                         }) 
                                         .select('title activityImageUrl category') 
                                         .sort({ createdAt: -1 });

        res.json(activities);
    } catch (error) {
        console.error("'/api/public/activities/all' rotasında KRİTİK HATA:", error); 
        
        res.status(500).json({ 
            message: 'Etkinlikler yüklenirken sunucu hatası oluştu.',
            details: error.message || 'Bilinmeyen Mongoose hatası' 
        });
    }
});

router.get('/:categoryId', async (req, res) => {
    try {
        const activities = await Activity.find({ category: req.params.categoryId })
                                         .select('title description activityImageUrl pdfPaths')
                                         .sort('createdAt');
        res.json(activities);
    } catch (error) {
        res.status(500).json({ message: 'Etkinlikler yüklenirken hata oluştu.' });
    }
});

router.get('/detail/:id', async (req, res) => {
    try {
        const activity = await Activity.findById(req.params.id)
                                        .populate('category', 'name') 
                                        .select('title description activityImageUrl pdfPaths category');
        
        if (!activity) {
            return res.status(404).json({ message: 'Etkinlik bulunamadı.' });
        }
        res.json(activity);
    } catch (error) {
        res.status(404).json({ message: 'Geçersiz etkinlik kimliği veya etkinlik bulunamadı.' });
    }
});

module.exports = router;
