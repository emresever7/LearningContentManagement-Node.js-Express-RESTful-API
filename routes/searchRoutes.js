const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity'); 
const Category = require('../models/Category'); 
const Subtopic = require('../models/Subtopic');

router.get('/', async (req, res) => {
    const keyword = req.query.q;

    if (!keyword || keyword.trim() === '') {
        return res.json({ activities: [], categories: [], subtopics: [] });
    }

    const searchCondition = {
        $or: [
            { title: { $regex: keyword, $options: 'i' } },
            { description: { $regex: keyword, $options: 'i' } },
        ]
    };

    try {
        const activities = await Activity.find(searchCondition).limit(20);

        const categories = await Category.find({
             name: { $regex: keyword, $options: 'i' }
        }).limit(10);

        const subtopics = await Subtopic.find({
            subTitle: { $regex: keyword, $options: 'i' }
       }).limit(10);

        res.json({
            activities: activities,
            categories: categories,
            subtopics: subtopics,
        });

    } catch (error) {
        console.error('Arama hatası:', error.message);
        res.status(500).json({ message: 'Arama sırasında bir hata oluştu.' });
    }
});

module.exports = router;