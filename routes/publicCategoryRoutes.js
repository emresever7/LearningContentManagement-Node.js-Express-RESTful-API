const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

router.get('/', async (req, res) => {
    try {
        const categories = await Category.find().select('name description imageUrl');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Kategoriler yüklenirken hata oluştu.' });
    }
});

router.get('/detail/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).select('name description imageUrl');
        if (!category) {
            return res.status(404).json({ message: 'Kategori bulunamadı.' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: 'Kategori detayları yüklenirken hata oluştu.' });
    }
});

module.exports = router;