const express = require('express');
const cors = require('cors');
const logger = require('./src/middleware/logger');

// Import routes
const announcementRoutes = require('./src/routes/announcementRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const lecturerRoutes = require('./src/routes/lecturerRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use(logger);

// ─── Routes ───
app.use('/api/portal/announcements', announcementRoutes);
app.use('/api/portal/students', studentRoutes);
app.use('/api/portal/lecturers', lecturerRoutes);
app.use('/api/portal/notifications', notificationRoutes);

// ─── Health check ───
app.get('/api/portal/health', (req, res) => {
  res.json({
    service: 'IUH Portal Mock Service',
    status: 'UP',
    version: '2.0.0',
    description: 'Giả lập API cổng thông tin IUH - Thông báo, Lịch học/dạy, Lịch thi/coi thi',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET  /api/portal/announcements/school         — Thông báo toàn trường',
      'GET  /api/portal/announcements/faculty?faculty=CNTT — Thông báo theo khoa',
      'GET  /api/portal/students/:mssv/schedule?view=day|week — Lịch học sinh viên',
      'GET  /api/portal/students/:mssv/exams          — Lịch thi sinh viên',
      'GET  /api/portal/lecturers/:maGV/schedule?view=day|week — Lịch dạy giảng viên',
      'GET  /api/portal/lecturers/:maGV/proctoring    — Lịch coi thi giảng viên',
      'POST /api/portal/notifications/send-email       — Gửi email thông báo cho SV',
    ],
  });
});

// ─── 404 handler ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} không tồn tại`,
    hint: 'Truy cập GET /api/portal/health để xem danh sách API',
  });
});

// ─── Start server ───
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║                                                      ║');
  console.log('║   🏫  IUH PORTAL MOCK SERVICE  v2.0                  ║');
  console.log('║   Giả lập API cổng thông tin trường IUH              ║');
  console.log('║                                                      ║');
  console.log(`║   🚀  http://localhost:${PORT}/api/portal/health       ║`);
  console.log('║                                                      ║');
  console.log('║   📢 Thông báo:  /announcements/school               ║');
  console.log('║   📅 Lịch học:   /students/:mssv/schedule             ║');
  console.log('║   📝 Lịch thi:   /students/:mssv/exams               ║');
  console.log('║   🎓 Lịch dạy:   /lecturers/:maGV/schedule           ║');
  console.log('║   👁️  Coi thi:    /lecturers/:maGV/proctoring         ║');
  console.log('║   📧 Email:      /notifications/send-email            ║');
  console.log('║                                                      ║');
  console.log('║   Dữ liệu mẫu:                                      ║');
  console.log('║   • SV: 22641211, 20001234                           ║');
  console.log('║   • GV: GV001, GV002, GV003                          ║');
  console.log('║                                                      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});
