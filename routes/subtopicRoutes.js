const express = require('express');
const router = express.Router();
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


const subtopicUpload = upload.fields([
    { name: 'subtopicImage', maxCount: 1 },
    { name: 'subtopicPdf', maxCount: 20 }
]);

const createPdfUrls = (subtopicPdfs) => {
    if (!subtopicPdfs || subtopicPdfs.length === 0) return [];

    return subtopicPdfs.map(file => file.location);
};


const deleteOldS3Files = async (fileUrls) => {
    if (!fileUrls || fileUrls.length === 0) return;

    const urls = Array.isArray(fileUrls) ? fileUrls : [fileUrls];

    for (const fileUrl of urls) {
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

router.post('/', subtopicUpload, async (req, res) => {
    try {
        const imageUrl = req.files['subtopicImage'] ? req.files['subtopicImage'][0].location : null;
        const pdfUrls = createPdfUrls(req.files['subtopicPdf']);

        const newSubtopic = new Subtopic({
            activity: req.body.activityId,
            subTitle: req.body.subTitle,
            content: req.body.content || null, 
            imageUrl: imageUrl,
            pdfUrls: pdfUrls,
            order: req.body.order,
        });

        await newSubtopic.save();
        res.status(201).json(newSubtopic);
    } catch (error) {
        console.error("Alt Konu oluşturma hatası:", error);
        if (req.files) {
            const files = [...(req.files['subtopicImage'] || []), ...(req.files['subtopicPdf'] || [])];
            const urlsToDelete = files.map(file => file.location);
            await deleteOldS3Files(urlsToDelete);
        }
        res.status(400).json({ message: 'Alt Konu oluşturulamadı.', error: error.message });
    }
});


router.put('/:id', subtopicUpload, async (req, res) => {
    try {
        const subtopicId = req.params.id;
        const updates = req.body;
        const oldSubtopic = await Subtopic.findById(subtopicId);

        if (!oldSubtopic) {
            if (req.files) {
                const files = [...(req.files['subtopicImage'] || []), ...(req.files['subtopicPdf'] || [])];
                const urlsToDelete = files.map(file => file.location);
                await deleteOldS3Files(urlsToDelete);
            }
            return res.status(404).json({ message: 'Alt Konu bulunamadı.' });
        }

        // --- GÖRSEL YÖNETİMİ ---
        if (req.files['subtopicImage']) {
            // Eski görseli S3'ten sil
            if (oldSubtopic.imageUrl) {
                await deleteOldS3Files(oldSubtopic.imageUrl);
            }
            // Yeni S3 URL'sini kaydet
            updates.imageUrl = req.files['subtopicImage'][0].location;
        }
        
        // --- PDF YÖNETİMİ ---
        if (req.files['subtopicPdf']) {
            if (oldSubtopic.pdfUrls && oldSubtopic.pdfUrls.length > 0) {
                await deleteOldS3Files(oldSubtopic.pdfUrls); 
            }
            updates.pdfUrls = createPdfUrls(req.files['subtopicPdf']);
        }
        
        if (updates.deleteImage === 'true' && oldSubtopic.imageUrl) {
            await deleteOldS3Files(oldSubtopic.imageUrl);
            updates.imageUrl = null;
            delete updates.deleteImage; 
        }

        if (updates.deletePdf === 'true' && oldSubtopic.pdfUrls && oldSubtopic.pdfUrls.length > 0) {
            await deleteOldS3Files(oldSubtopic.pdfUrls);
            updates.pdfUrls = [];
            delete updates.deletePdf;
        }

        if (updates.activityId) {
            updates.activity = updates.activityId;
            delete updates.activityId;
        }

        const updatedSubtopic = await Subtopic.findByIdAndUpdate(
            subtopicId,
            { $set: updates },
            { new: true, runValidators: true }
        );

        res.json(updatedSubtopic);

    } catch (error) {
        console.error('Alt Konu düzenleme KRİTİK HATA:', error);

        if (req.files) {
            const files = [...(req.files['subtopicImage'] || []), ...(req.files['subtopicPdf'] || [])];
            const urlsToDelete = files.map(file => file.location);
            await deleteOldS3Files(urlsToDelete);
        }
        
        res.status(400).json({ message: 'Alt Konu güncellenemedi.', error: error.message });
    }
});


router.delete('/:id', protect, async (req, res) => {
    try {
        const subtopicToDelete = await Subtopic.findByIdAndDelete(req.params.id);

        if (!subtopicToDelete) {
            return res.status(404).json({ message: 'Alt Konu bulunamadı.' });
        }
        
        const filesToUnlink = [subtopicToDelete.imageUrl].filter(Boolean);
        
        if (subtopicToDelete.pdfUrls && subtopicToDelete.pdfUrls.length > 0) {
            filesToUnlink.push(...subtopicToDelete.pdfUrls);
        }

        await deleteOldS3Files(filesToUnlink);
        
        res.json({ message: 'Alt Konu başarıyla silindi.' });

    } catch (error) {
        console.error("Alt Konu silme işlemi başarısız oldu:", error);
        res.status(500).json({ message: 'Alt Konu silinemedi.', error: error.message });
    }
});


router.get('/:activityId', async (req, res) => {
    try {
        const subtopics = await Subtopic.find({ activity: req.params.activityId }).sort('order');
        res.json(subtopics);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

