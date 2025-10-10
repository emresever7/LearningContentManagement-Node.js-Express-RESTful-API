const express = require('express');
const router = express.Router();
const Subtopic = require('../models/Subtopic'); 

router.get('/:activityId', async (req, res) => {
    try {
        const subtopics = await Subtopic.find({ activity: req.params.activityId })
                                        .select('subTitle content imageUrl pdfUrls')
                                        .sort('order');
        res.json(subtopics);
    } catch (error) {
        res.status(500).json({ message: 'Alt konular yüklenirken hata oluştu.' });
    }
});

router.get('/detail/:id', async (req, res) => {
    try {
        const id = req.params.id;
        
        const subtopic = await Subtopic.findById(id)
                                        .populate('activity', 'title') 
                                        .select('subTitle content imageUrl pdfUrls activity')
                                        .sort('order');

        if (!subtopic) {
            return res.status(404).json({ message: 'Alt konu bulunamadı.' });
        }
        
        res.json(subtopic);
        
    } catch (error) {
        console.error("Alt konu detay çekme hatası:", error);
        res.status(400).json({ message: 'Geçersiz alt konu ID formatı.' }); 
    }
});

module.exports = router;










