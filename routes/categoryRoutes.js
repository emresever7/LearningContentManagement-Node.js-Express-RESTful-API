const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
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

// 1. Yeni Kategori Oluşturma (POST)
router.post('/',
     upload.single('categoryImage'), 
     async (req, res) => {

    try {


        const imageUrl = req.file ? req.file.location : null;

        const { name, description } = req.body;

        const slugify = (text) => {
            return text.toString().toLowerCase()
              .replace(/\s+/g, '-') 
              .replace(/[^\w\-]+/g, '')      
              .replace(/\-\-+/g, '-')        
              .trim();                        
        };

        const slug = slugify(name); 

        if (!req.body.name) {
            return res.status(400).json({ message: 'Kategori adı zorunludur.' });
        }

        const newCategory = new Category({
            name: name,
            description: description, 
            imageUrl: imageUrl, 
            slug: slug, 
        });

        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (error) {
        console.error("Kategori oluşturma KRİTİK HATA:", error); 
        
        let errorMessage = 'Kategori oluşturulamadı.';
        if (error.code === 11000) {
            errorMessage = 'Bu kategori adı zaten mevcut. Lütfen farklı bir ad kullanın.';
        } else if (error.name === 'ValidationError') {
            errorMessage = error.message; 
        }
    
        res.status(400).json({ message: errorMessage, error: error.message });
    }
});


router.put('/:id', upload.single('categoryImage'), async (req, res) => {
    try {
        const categoryId = req.params.id;
        const updates = req.body;
        const oldCategory = await Category.findById(categoryId);

        if (!oldCategory) {

            if (req.file) {
                try {
                    const newFileUrl = req.file.location;
                    const url = new URL(newFileUrl);
                    const Key = url.pathname.substring(1); 
                    
                    const command = new DeleteObjectCommand({
                        Bucket: process.env.AWS_BUCKET_NAME,
                        Key: Key
                    });
                    await s3.send(command);
                    console.log("Yeni yüklenip kullanılmayan dosya S3'ten silindi:", Key);
                } catch (s3CleanupError) {
                    console.warn(`Yeni S3 dosyası silinirken hata oluştu (Devam ediliyor): ${s3CleanupError.message}`);
                }
            }
            return res.status(404).json({ message: 'Kategori bulunamadı.' });
        }

        if (req.file) {
            if (oldCategory.imageUrl) {
                if (oldCategory.imageUrl && oldCategory.imageUrl.startsWith('http')) {
                    try {
                        const url = new URL(oldCategory.imageUrl);
                        const Key = url.pathname.substring(1); 
                        
                        const command = new DeleteObjectCommand({
                            Bucket: process.env.AWS_BUCKET_NAME,
                            Key: Key
                        });
                        
                        await s3.send(command);
                        console.log("Eski dosya S3'ten silindi:", Key);
                    } catch (s3Error) {
                        console.warn(`S3 silme hatası (URL ayrıştırma dahil): ${s3Error.message}`);
                    }
                } else {
                    console.warn(`Eski kayıt geçersiz/yerel URL içeriyor: ${oldCategory.imageUrl}`);
                }
                
            }
            
            updates.imageUrl = req.file.location;
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { 
                name: updates.name, 
                description: updates.description, 
                imageUrl: updates.imageUrl || oldCategory.imageUrl 
            },
            { new: true, runValidators: true }
        );

        res.json(updatedCategory);

    } catch (error) {
        console.error('Kategori düzenleme KRİTİK HATA:', error);
        
         if (req.file) {
            try {
                const url = new URL(req.file.location);
                const Key = url.pathname.substring(1); 
                const command = new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: Key });
                await s3.send(command);
            } catch (cleanupError) {
                console.warn(`Hata sonrası yüklenen dosya S3'ten silinirken hata oluştu: ${cleanupError.message}`);
            }
        }
        
        res.status(400).json({ 
            message: 'Kategori güncellenemedi.', 
            error: error.message 
        });
    }
});


router.delete('/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        const filesToUnlink = [];

      
        const relatedActivities = await Activity.find({ category: categoryId }).select('activityImageUrl pdfPaths');
        const activityIds = relatedActivities.map(a => a._id);
        
        const relatedSubtopics = await Subtopic.find({ activity: { $in: activityIds } }).select('imageUrl pdfUrls');

        relatedActivities.forEach(activity => {

            if (activity.activityImageUrl) {
                filesToUnlink.push(activity.activityImageUrl);
            }

            if (activity.pdfPaths && activity.pdfPaths.length > 0) {
                filesToUnlink.push(...activity.pdfPaths);
            }
        });

  
        relatedSubtopics.forEach(subtopic => {
       
            if (subtopic.imageUrl) {
                filesToUnlink.push(subtopic.imageUrl);
            }
   
            if (subtopic.pdfUrls && subtopic.pdfUrls.length > 0) {
                filesToUnlink.push(...subtopic.pdfUrls);
            }
        });


        /* --- VERİTABANI SİLME İŞLEMİ (CASCADE DELETE) --- */

        const subtopicDeleteResult = await Subtopic.deleteMany({ activity: { $in: activityIds } });
        console.log(`${subtopicDeleteResult.deletedCount} alt konu silindi.`);

        const activityDeleteResult = await Activity.deleteMany({ _id: { $in: activityIds } });
        console.log(`${activityDeleteResult.deletedCount} etkinlik silindi.`);


        /* --- ANA KAYIT SİLME VE GÖRSEL SİLME --- */
        
        const categoryToDelete = await Category.findByIdAndDelete(categoryId);

        if (!categoryToDelete) {
            return res.status(404).json({ message: 'Kategori bulunamadı.' });
        }

        if (categoryToDelete.imageUrl) {
            filesToUnlink.push(categoryToDelete.imageUrl);
        }
        
        if (filesToUnlink.length > 0) {
            await deleteOldS3Files(filesToUnlink);
        }

        res.json({ message: 'Kategori ve bağlı tüm veriler başarıyla silindi.' });

    } catch (error) {
        console.error("Kategori silme işlemi başarısız oldu:", error);
        res.status(500).json({ 
            message: 'Kategori silinirken kritik bir hata oluştu.', 
            error: error.message 
        });
    }
});


router.get('/', async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;