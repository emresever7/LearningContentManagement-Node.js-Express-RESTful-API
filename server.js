require('dotenv').config(); 

const path = require('path');
const express = require('express');
const app = express();

const mongoose = require('mongoose');
const cors = require('cors');

const { protect } = require('./middleware/authMiddleware');

const PORT = process.env.PORT || 5000;

const authRoutes = require('./routes/authRoutes');

const userRoutes = require('./routes/userRoutes'); 

// 3. ROUTES (API Uç Noktaları)

const categoryRoutes = require('./routes/categoryRoutes');
const activityRoutes = require('./routes/activityRoutes'); 
const subtopicRoutes = require('./routes/subtopicRoutes'); 


const searchRoutes = require('./routes/searchRoutes');


if (!process.env.JWT_SECRET) {
  console.warn("UYARI: JWT_SECRET ortam değişkeni ayarlanmadı. 'gizli_anahtar' varsayılan olarak kullanılacak.");
}

// ***********************
// 1. MIDDLEWARES
// ***********************

const corsOptions = {
  origin: process.env.FRONTEND_URL, 
  credentials: true, 
};

app.use(cors(corsOptions));
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// ***********************
// 2. MONGODB BAĞLANTISI
// ***********************
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB bağlantısı başarılı!'))
  .catch(err => console.error('MongoDB bağlantı hatası:', err));

// ***********************
// 3. ROUTES (API Uç Noktaları)
// ***********************

app.use(express.static(path.join(__dirname, '..', 'public')));

// --- PUBLIC/GENEL ROTLAR ---

console.log('Search Router Yüklendi:', typeof searchRouter);

app.use('/api/search', searchRoutes); 

app.use('/api/auth', authRoutes);

app.use('/api/public/categories', require('./routes/publicCategoryRoutes')); 
app.use('/api/public/activities', require('./routes/publicActivityRoutes'));
app.use('/api/public/subtopics', require('./routes/publicSubtopicRoutes'));

// --- ADMIN ROTLARI (PROTECT) ---

app.use('/api/admin/users', protect, userRoutes);
app.use('/api/admin/categories', protect, categoryRoutes); 
app.use('/api/admin/activities', protect, activityRoutes); 
app.use('/api/admin/subtopics', protect, subtopicRoutes); 

app.get('/', (req, res) => {
  res.send('Admin API is running!');
});


// ***********************
// 4. SUNUCUYU BAŞLAT
// ***********************
app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});
