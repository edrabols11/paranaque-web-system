require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bookRoutes = require('./routes/bookRoutes');
const authRoutes = require('./routes/authRoutes');
const logRoutes = require('./routes/logRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const bookmarksRoutes = require('./routes/bookmarkRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 5050;

// Enhanced CORS configuration
const corsOptions = {
  origin: ['https://paranaledge-y7z1.onrender.com', 'http://localhost:3000', 'http://localhost:5050'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

app.use("/api/books", bookRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/bookmarks", bookmarksRoutes);
app.use("/api/ai", aiRoutes);

app.get('/test', (req, res) => {
  res.send('Backend is working!');
});

// Start the reservation expiration checker
const { startReservationExpirationCheck } = require('./utils/reservationManager');

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  startReservationExpirationCheck();
  console.log('📅 Reservation expiration checker started');
});
