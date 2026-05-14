const express = require('express');
const router = express.Router();

const schedules = require('../data/schedules.json');
const exams = require('../data/exams.json');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ─── GET /api/portal/lecturers/:maGV/schedule ───
// Lấy lịch dạy của giảng viên
// Query: ?view=day|week  (mặc định: week)
router.get('/:maGV/schedule', (req, res) => {
  const { maGV } = req.params;
  const view = req.query.view || 'week';

  const schedule = schedules.lecturerSchedules[maGV];
  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: `Không tìm thấy lịch dạy cho mã GV: ${maGV}`,
    });
  }

  const now = new Date();
  const currentDay = DAY_NAMES[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (view === 'day') {
    const todayClasses = (schedule[currentDay] || []).map(item => {
      let status = 'upcoming';
      if (currentTime >= item.startTime && currentTime <= item.endTime) status = 'ongoing';
      else if (currentTime > item.endTime) status = 'completed';
      return { ...item, status };
    });

    return res.json({
      success: true,
      data: {
        semester: schedule.semester,
        date: now.toISOString().split('T')[0],
        dayOfWeek: currentDay,
        classes: todayClasses,
        totalClasses: todayClasses.length,
      },
    });
  }

  // view === 'week'
  const weekData = {};
  let totalClasses = 0;
  for (const day of DAY_NAMES) {
    weekData[day] = schedule[day] || [];
    totalClasses += weekData[day].length;
  }

  res.json({
    success: true,
    data: {
      semester: schedule.semester,
      week: weekData,
      totalClasses,
      currentDay,
    },
  });
});

// ─── GET /api/portal/lecturers/:maGV/proctoring ───
// Lấy lịch coi thi của giảng viên
router.get('/:maGV/proctoring', (req, res) => {
  const { maGV } = req.params;
  const proctoring = exams.lecturerProctoring[maGV];

  if (!proctoring) {
    return res.status(404).json({
      success: false,
      message: `Không tìm thấy lịch coi thi cho mã GV: ${maGV}`,
    });
  }

  const now = new Date();
  const data = proctoring
    .map(item => {
      const examDate = new Date(item.date);
      const daysLeft = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
      return { ...item, daysLeft };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  res.json({
    success: true,
    data,
    total: data.length,
    nearestProctoring: data.find(e => e.daysLeft >= 0) || null,
  });
});

module.exports = router;
