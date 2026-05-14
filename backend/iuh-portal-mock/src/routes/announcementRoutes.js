const express = require('express');
const router = express.Router();

const announcements = require('../data/announcements.json');

// ─── Helper: tính "thời gian trước" ───
function getTimeAgo(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Vừa xong';
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${Math.floor(diffHours / 24)} ngày trước`;
}

// ─── GET /api/portal/announcements/school ───
// Lấy thông báo chung toàn trường
router.get('/school', (req, res) => {
  const data = announcements.school.map(a => ({
    ...a,
    time: getTimeAgo(a.createdAt),
    isNew: (new Date() - new Date(a.createdAt)) < 12 * 60 * 60 * 1000,
  }));

  res.json({ success: true, data, total: data.length });
});

// ─── GET /api/portal/announcements/faculty?faculty=CNTT ───
// Lấy thông báo theo khoa
router.get('/faculty', (req, res) => {
  const faculty = req.query.faculty || 'CNTT';
  const facultyData = announcements.faculty[faculty];

  if (!facultyData) {
    return res.status(404).json({
      success: false,
      message: `Không tìm thấy thông báo cho khoa: ${faculty}`,
    });
  }

  const data = facultyData.map(a => ({
    ...a,
    time: getTimeAgo(a.createdAt),
    isNew: (new Date() - new Date(a.createdAt)) < 12 * 60 * 60 * 1000,
  }));

  res.json({ success: true, data, faculty, total: data.length });
});

module.exports = router;
