/**
 * Logger middleware - ghi log mỗi request đến service
 * Giả lập monitoring cho hệ thống cổng thông tin
 */
const logger = (req, res, next) => {
  const start = Date.now();

  // Lưu lại hàm end gốc
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    const logLine = `[IUH Portal] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`;

    if (res.statusCode >= 400) {
      console.log(`❌ ${logLine}`);
    } else {
      console.log(`✅ ${logLine}`);
    }

    originalEnd.apply(this, args);
  };

  next();
};

module.exports = logger;
