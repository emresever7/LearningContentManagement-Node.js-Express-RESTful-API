const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const Subtopic = require('../models/Subtopic');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../config/multer');

const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3'); 

const s3 = new S3Client({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    region: process.env.AWS_REGION
});


const activityUpload = upload.fields([
    { name: 'activityImage', maxCount: 5 }, 
    { name: 'pdfFile', maxCount: 20 }      
]);

const createPdfPaths = (pdfFiles) => {
    if (!pdfFiles || pdfFiles.length === 0) return [];
    
    return pdfFiles.map(file => file.location); 
};

const deleteOldS3Files = async (fileUrls) => {
    if (!fileUrls || fileUrls.length === 0) return;

    for (const fileUrl of fileUrls) {
        if (fileUrl && fileUrl.startsWith('http')) {
            try {
                const url = new URL(fileUrl);
                const Key = url.pathname.substring(1); 
                
                const command = new DeleteObjectCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: Key
                });
                
                await s3.send(command);
                console.log("S3'ten dosya başarıyla silindi:", Key);
            } catch (s3Error) {
                console.warn(`S3 dosyası silinirken hata oluştu (${fileUrl}): ${s3Error.message}`);
            }
        }
    }
};


router.use(protect);

// 1. Etkinlik Oluşturma (POST)
router.post('/', activityUpload, async (req, res) => {
    try {
        const pdfPaths = createPdfPaths(req.files['pdfFile']);
        const activityImageUrl = req.files['activityImage'] ? req.files['activityImage'][0].location : null; 
        
        const newActivity = new Activity({
            ...req.body,
            title: req.body.title, 
            description: req.body.description,
            category: req.body.categoryId,
            activityImageUrl: activityImageUrl, // S3 URL'si
            pdfPaths: pdfPaths, // S3 URL'leri dizisi
        });

        await newActivity.save();
        res.status(201).json(newActivity);
    } catch (error) {
        console.error("Etkinlik oluşturma hatası:", error);
        
        if (req.files) {
            const files = [...(req.files['pdfFile'] || []), ...(req.files['activityImage'] || [])];
            const urlsToDelete = files.map(file => file.location);
            await deleteOldS3Files(urlsToDelete);
        }
        res.status(400).json({ message: 'Etkinlik oluşturulamadı.', error: error.message });
    }
});


// 2. Etkinlik Düzenleme (PUT)
router.put('/:id', activityUpload, async (req, res) => {
    try {
        const activityId = req.params.id;
        const updates = req.body;
        const oldActivity = await Activity.findById(activityId);

        if (!oldActivity) {
            if (req.files) {
                const files = [...(req.files['pdfFile'] || []), ...(req.files['activityImage'] || [])];
                const urlsToDelete = files.map(file => file.location);
                await deleteOldS3Files(urlsToDelete);
            }
            return res.status(404).json({ message: 'Etkinlik bulunamadı.' });
        }

        if (req.files['activityImage']) {
            if (oldActivity.activityImageUrl) {
                await deleteOldS3Files([oldActivity.activityImageUrl]);
            }
            updates.activityImageUrl = req.files['activityImage'][0].location;
        }

        if (req.files['pdfFile']) {
            if (oldActivity.pdfPaths && oldActivity.pdfPaths.length > 0) {
                await deleteOldS3Files(oldActivity.pdfPaths); 
            }
            updates.pdfPaths = createPdfPaths(req.files['pdfFile']);
        }
        
        if (updates.categoryId) {
            updates.category = updates.categoryId; 
            delete updates.categoryId; 
        }

        const updatedActivity = await Activity.findByIdAndUpdate(
            activityId,
            { $set: updates }, 
            { new: true, runValidators: true }
        ).populate('category', 'name');

        res.json(updatedActivity);

    } catch (error) {
        console.error('Etkinlik düzenleme KRİTİK HATA:', error);
        if (req.files) {
            const files = [...(req.files['pdfFile'] || []), ...(req.files['activityImage'] || [])];
            const urlsToDelete = files.map(file => file.location);
            await deleteOldS3Files(urlsToDelete);
        }
        
        res.status(400).json({ message: 'Etkinlik güncellenemedi.', error: error.message });
    }
});


router.delete('/:id', async (req, res) => {
    try {
        const activityId = req.params.id;

        const relatedSubtopics = await Subtopic.find({ activity: activityId });

        const activityToDelete = await Activity.findByIdAndDelete(activityId);

        if (!activityToDelete) {
            return res.status(404).json({ message: 'Etkinlik bulunamadı.' });
        }
        
        /* --- DOSYA SİLME İŞLEMİ (S3) --- */

        const filesToUnlink = [activityToDelete.activityImageUrl].filter(Boolean);
        
        if (activityToDelete.pdfPaths && activityToDelete.pdfPaths.length > 0) {
            filesToUnlink.push(...activityToDelete.pdfPaths);
        }

        relatedSubtopics.forEach(subtopic => {
            if (subtopic.imageUrl) {
                filesToUnlink.push(subtopic.imageUrl);
            }
            if (subtopic.pdfUrls && subtopic.pdfUrls.length > 0) {
                filesToUnlink.push(...subtopic.pdfUrls);
            }
        });
        
        await deleteOldS3Files(filesToUnlink);


        /* --- CASCADE DELETE: BAĞIMLI ALT KONULARI SİLME --- */
        const subtopicDeleteResult = await Subtopic.deleteMany({ activity: activityId });
        console.log(`${subtopicDeleteResult.deletedCount} alt konu silindi.`);
        
        res.json({ message: 'Etkinlik ve bağlı tüm veriler (dosyalar dahil) başarıyla silindi.' });

    } catch (error) {
        console.error("Etkinlik silme işlemi başarısız oldu:", error);
        res.status(500).json({ message: 'Etkinlik silinemedi.', error: error.message });
    }
});


router.get('/', async (req, res) => {
    try {
        const activities = await Activity.find().populate('category', 'name');
        res.json(activities);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

