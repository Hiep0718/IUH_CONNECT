/**
 * =============================================
 * IUH CONNECT — Load Test Script (Node.js)
 * =============================================
 * 
 * Mô phỏng hàng nghìn request đồng thời gửi đến API Gateway
 * để kiểm tra cơ chế Rate Limiter hoạt động đúng.
 * 
 * Cách chạy:
 *   node load_test.js
 * 
 * Yêu cầu:
 *   - API Gateway đang chạy tại localhost:8080
 *   - Redis đang chạy (cho Rate Limiter)
 */

// =============================================
// CẤU HÌNH TEST - Chỉnh sửa tại đây
// =============================================
const CONFIG = {
    // URL của API Gateway
    GATEWAY_URL: 'http://localhost:8080',

    // Số lượng request đồng thời muốn gửi
    TOTAL_REQUESTS: 10000,          // Bắt đầu với 100, tăng dần lên 1000, 5000, 10000

    // Số request gửi song song cùng lúc (batch size)
    CONCURRENCY: 500,              // Gửi 50 request cùng lúc mỗi đợt

    // API endpoint muốn test (chọn 1 trong các option bên dưới)
    // Option 1: Test Login (IP-based rate limiter, giới hạn 3 req/s)
    // Option 2: Test Chat API (User-based rate limiter, giới hạn 30 req/s)  
    // Option 3: Test AI API (User-based rate limiter, giới hạn 2 req/s)
    TEST_MODE: 'LOGIN',           // Đổi thành 'CHAT' hoặc 'AI' để test các API khác

    // JWT Token (chỉ cần khi test CHAT hoặc AI)
    // Lấy token bằng cách login trước, rồi paste vào đây
    JWT_TOKEN: 'PASTE_YOUR_TOKEN_HERE',
};

// =============================================
// LOGIC TEST - Không cần chỉnh sửa
// =============================================
const http = require('http');
const url = require('url');

function getTestConfig() {
    switch (CONFIG.TEST_MODE) {
        case 'LOGIN':
            return {
                method: 'POST',
                path: '/api/v1/auth/login',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'loadtest_user', password: 'test123' }),
                description: 'Login API (IP-based Rate Limiter — 3 req/s, burst 5)',
            };
        case 'CHAT':
            return {
                method: 'GET',
                path: '/api/v1/chat/conversations',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.JWT_TOKEN}`,
                },
                body: null,
                description: 'Chat API (User-based Rate Limiter — 30 req/s, burst 50)',
            };
        case 'AI':
            return {
                method: 'POST',
                path: '/api/v1/ai/chat',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.JWT_TOKEN}`,
                },
                body: JSON.stringify({ message: 'Hello from load test' }),
                description: 'AI API (User-based Rate Limiter — 2 req/s, burst 5)',
            };
        default:
            throw new Error(`Unknown TEST_MODE: ${CONFIG.TEST_MODE}`);
    }
}

function sendRequest(testConfig, requestId) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const parsedUrl = url.parse(CONFIG.GATEWAY_URL);

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 8080,
            path: testConfig.path,
            method: testConfig.method,
            headers: testConfig.headers,
            timeout: 10000,
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const duration = Date.now() - startTime;
                resolve({
                    id: requestId,
                    status: res.statusCode,
                    duration: duration,
                    rateLimitRemaining: res.headers['x-ratelimit-remaining'] || 'N/A',
                });
            });
        });

        req.on('error', (err) => {
            const duration = Date.now() - startTime;
            resolve({
                id: requestId,
                status: 'ERROR',
                duration: duration,
                error: err.message,
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                id: requestId,
                status: 'TIMEOUT',
                duration: 10000,
            });
        });

        if (testConfig.body) {
            req.write(testConfig.body);
        }
        req.end();
    });
}

async function runBatch(testConfig, startId, batchSize) {
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
        promises.push(sendRequest(testConfig, startId + i));
    }
    return Promise.all(promises);
}

async function runLoadTest() {
    const testConfig = getTestConfig();

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           IUH CONNECT — LOAD TEST REPORT                   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  🎯 Target:        ${CONFIG.GATEWAY_URL}${testConfig.path}`);
    console.log(`  📋 Description:   ${testConfig.description}`);
    console.log(`  📊 Total:         ${CONFIG.TOTAL_REQUESTS} requests`);
    console.log(`  ⚡ Concurrency:   ${CONFIG.CONCURRENCY} requests/batch`);
    console.log(`  🕐 Started at:    ${new Date().toLocaleTimeString()}`);
    console.log('');
    console.log('  Đang gửi requests...');
    console.log('');

    const allResults = [];
    const globalStart = Date.now();
    let sent = 0;

    while (sent < CONFIG.TOTAL_REQUESTS) {
        const batchSize = Math.min(CONFIG.CONCURRENCY, CONFIG.TOTAL_REQUESTS - sent);
        const results = await runBatch(testConfig, sent + 1, batchSize);
        allResults.push(...results);
        sent += batchSize;

        // Progress bar
        const progress = Math.round((sent / CONFIG.TOTAL_REQUESTS) * 100);
        const bar = '█'.repeat(Math.round(progress / 2)) + '░'.repeat(50 - Math.round(progress / 2));
        process.stdout.write(`\r  [${bar}] ${progress}% (${sent}/${CONFIG.TOTAL_REQUESTS})`);
    }

    const totalDuration = Date.now() - globalStart;

    // =============================================
    // PHÂN TÍCH KẾT QUẢ
    // =============================================
    const statusCounts = {};
    let totalResponseTime = 0;
    let minResponseTime = Infinity;
    let maxResponseTime = 0;

    allResults.forEach(r => {
        const key = r.status;
        statusCounts[key] = (statusCounts[key] || 0) + 1;
        if (typeof r.duration === 'number') {
            totalResponseTime += r.duration;
            minResponseTime = Math.min(minResponseTime, r.duration);
            maxResponseTime = Math.max(maxResponseTime, r.duration);
        }
    });

    const avgResponseTime = Math.round(totalResponseTime / allResults.length);
    const requestsPerSecond = Math.round((CONFIG.TOTAL_REQUESTS / totalDuration) * 1000);

    console.log('\n');
    console.log('  ┌─────────────────────────────────────────────────────────┐');
    console.log('  │                    📊 KẾT QUẢ TEST                     │');
    console.log('  ├─────────────────────────────────────────────────────────┤');
    console.log(`  │  ⏱  Tổng thời gian:          ${totalDuration} ms`);
    console.log(`  │  🚀 Throughput:               ${requestsPerSecond} req/s`);
    console.log(`  │  📈 Avg Response Time:        ${avgResponseTime} ms`);
    console.log(`  │  ⬇  Min Response Time:        ${minResponseTime} ms`);
    console.log(`  │  ⬆  Max Response Time:        ${maxResponseTime} ms`);
    console.log('  ├─────────────────────────────────────────────────────────┤');
    console.log('  │  📦 Phân bố Status Code:                               │');

    Object.entries(statusCounts).sort().forEach(([status, count]) => {
        const pct = Math.round((count / CONFIG.TOTAL_REQUESTS) * 100);
        let icon = '  ';
        if (status === '200' || status === '201') icon = '✅';
        else if (status === '401' || status === '403') icon = '🔐';
        else if (status === '429') icon = '🛑';
        else if (status === '503') icon = '⚠️';
        else if (status === 'ERROR' || status === 'TIMEOUT') icon = '❌';
        else icon = '📌';
        console.log(`  │     ${icon}  HTTP ${status}: ${count} requests (${pct}%)`);
    });

    console.log('  └─────────────────────────────────────────────────────────┘');
    console.log('');

    // =============================================
    // ĐÁNH GIÁ TỰ ĐỘNG
    // =============================================
    const rateLimited = statusCounts['429'] || 0;
    const successful = (statusCounts['200'] || 0) + (statusCounts['201'] || 0) + (statusCounts['401'] || 0);
    const errors = (statusCounts['ERROR'] || 0) + (statusCounts['TIMEOUT'] || 0);

    console.log('  🏆 ĐÁNH GIÁ:');
    if (rateLimited > 0 && errors === 0) {
        console.log('     ✅ Rate Limiter hoạt động CHÍNH XÁC!');
        console.log(`     → ${successful} requests được xử lý bình thường`);
        console.log(`     → ${rateLimited} requests bị chặn bởi Rate Limiter (HTTP 429)`);
        console.log('     → Không có lỗi hệ thống (0 errors/timeouts)');
        console.log('     → Gateway bảo vệ tốt các service phía sau');
    } else if (rateLimited === 0 && errors === 0) {
        console.log('     ⚠️  Tất cả requests đều thành công — Rate Limiter có thể chưa hoạt động');
        console.log('     → Kiểm tra lại Redis đã chạy chưa');
        console.log('     → Hoặc tăng TOTAL_REQUESTS / giảm CONCURRENCY delay');
    } else if (errors > 0) {
        console.log('     ❌ Có lỗi kết nối — Kiểm tra Gateway và các service có đang chạy không');
        console.log(`     → ${errors} requests bị lỗi/timeout`);
    }
    console.log('');
}

// Chạy test
runLoadTest().catch(console.error);
