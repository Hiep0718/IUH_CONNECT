const express = require('express');
const router = express.Router();

// In-memory lưu lịch sử email đã gửi (giả lập)
const emailHistory = [];

// ─── POST /api/portal/notifications/send-email ───
// Giả lập trường gửi email thông báo cho sinh viên
// Body: { to, subject, content }
router.post('/send-email', (req, res) => {
  const { to, subject, content } = req.body;

  if (!to || !subject || !content) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin: to, subject, content là bắt buộc',
    });
  }

  const emailRecord = {
    id: `EMAIL_${Date.now()}`,
    to,
    subject,
    content,
    sentAt: new Date().toISOString(),
    status: 'sent',
  };

  emailHistory.push(emailRecord);

  // Log giả lập gửi email
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     📧 GỬI EMAIL THÔNG BÁO (giả lập)   ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║ To:      ${to}`);
  console.log(`║ Subject: ${subject}`);
  console.log(`║ Time:    ${emailRecord.sentAt}`);
  console.log('╚══════════════════════════════════════════╝\n');

  res.status(201).json({
    success: true,
    message: 'Email đã được gửi thành công (giả lập)',
    data: emailRecord,
  });
});

module.exports = router;
