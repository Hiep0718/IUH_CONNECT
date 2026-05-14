const express = require('express');
const router = express.Router();

const schedules = require('../data/schedules.json');
const exams = require('../data/exams.json');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ─── GET /api/portal/students/:mssv/schedule ───
// Lấy lịch học của sinh viên
// Query: ?view=day|week  (mặc định: week)
router.get('/:mssv/schedule', (req, res) => {
  const { mssv } = req.params;
  const view = req.query.view || 'week';

  const schedule = schedules.studentSchedules[mssv];
  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: `Không tìm thấy lịch học cho MSSV: ${mssv}`,
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

// ─── GET /api/portal/students/:mssv/exams ───
// Lấy lịch thi của sinh viên
router.get('/:mssv/exams', (req, res) => {
  const { mssv } = req.params;
  const studentExams = exams.studentExams[mssv];

  if (!studentExams) {
    return res.status(404).json({
      success: false,
      message: `Không tìm thấy lịch thi cho MSSV: ${mssv}`,
    });
  }

  const now = new Date();
  const data = studentExams
    .map(exam => {
      const examDate = new Date(exam.date);
      const daysLeft = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
      return { ...exam, daysLeft };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  res.json({
    success: true,
    data,
    total: data.length,
    nearestExam: data.find(e => e.daysLeft >= 0) || null,
  });
});

module.exports = router;
