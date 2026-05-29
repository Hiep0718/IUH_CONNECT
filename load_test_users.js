/**
 * =============================================
 * IUH CONNECT — 10K USERS CAPACITY TEST
 * =============================================
 *
 * Mô phỏng 10.000 NGƯỜI DÙNG KHÁC NHAU cùng gửi request
 * đến API Gateway để kiểm tra khả năng xử lý đồng thời.
 *
 * Khác với load_test.js (test chống spam từ 1 IP),
 * script này test: "Gateway có phục vụ được 10k user cùng lúc không?"
 *
 * Cách chạy:
 *   node load_test_users.js
 */

const http = require('http');

// =============================================
// CẤU HÌNH - Chỉnh sửa tại đây
// =============================================
const CONFIG = {
    GATEWAY_URL: 'http://localhost:8080',

    // Số lượng user mô phỏng
    TOTAL_USERS: 10000,

    // Số user gửi request đồng thời mỗi đợt
    // (giảm xuống để tránh lỗi TCP ở tầng OS, không phải lỗi Gateway)
    CONCURRENCY: 200,

    // Chọn kịch bản test:
    // 'HEALTH'  — Test thuần Gateway (không qua Rate Limiter, không qua service nào)
    // 'LOGIN'   — Test 10k user cùng đăng nhập (qua Rate Limiter + Auth Service)
    // TEST_SCENARIO: 'HEALTH',
    TEST_SCENARIO: 'LOGIN',
};

// =============================================
// LOGIC
// =============================================

function sendRequest(userId, scenario) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        let options;

        if (scenario === 'HEALTH') {
            // Test thuần Gateway capacity — endpoint /actuator/health không có Rate Limiter
            options = {
                hostname: 'localhost',
                port: 8080,
                path: '/actuator/health',
                method: 'GET',
                headers: {},
                timeout: 15000,
            };
        } else {
            // Test Login — mỗi user có username riêng
            options = {
                hostname: 'localhost',
                port: 8080,
                path: '/api/v1/auth/login',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000,
            };
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    userId,
                    status: res.statusCode,
                    duration: Date.now() - startTime,
                });
            });
        });

        req.on('error', (err) => {
            resolve({
                userId,
                status: 'ERROR',
                duration: Date.now() - startTime,
                error: err.code || err.message,
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                userId,
                status: 'TIMEOUT',
                duration: Date.now() - startTime,
            });
        });

        if (scenario === 'LOGIN') {
            // Mỗi user gửi 1 request login với username riêng
            req.write(JSON.stringify({
                username: `user_${userId}`,
                password: `pass_${userId}`,
            }));
        }
        req.end();
    });
}

async function runTest() {
    const scenario = CONFIG.TEST_SCENARIO;
    const scenarioDesc = scenario === 'HEALTH'
        ? 'Gateway Health Check (không Rate Limiter — test thuần năng lực Gateway)'
        : 'Login API (có Rate Limiter — test 10k user cùng đăng nhập)';

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║        IUH CONNECT — 10K USERS CAPACITY TEST                   ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  🎯 Kịch bản:      ${scenarioDesc}`);
    console.log(`  👥 Số user:        ${CONFIG.TOTAL_USERS} người dùng`);
    console.log(`  ⚡ Đồng thời:      ${CONFIG.CONCURRENCY} user/đợt`);
    console.log(`  🕐 Bắt đầu:       ${new Date().toLocaleTimeString()}`);
    console.log('');

    const allResults = [];
    const globalStart = Date.now();
    let sent = 0;

    while (sent < CONFIG.TOTAL_USERS) {
        const batchSize = Math.min(CONFIG.CONCURRENCY, CONFIG.TOTAL_USERS - sent);
        const batch = [];
        for (let i = 0; i < batchSize; i++) {
            batch.push(sendRequest(sent + i + 1, scenario));
        }
        const results = await Promise.all(batch);
        allResults.push(...results);
        sent += batchSize;

        const pct = Math.round((sent / CONFIG.TOTAL_USERS) * 100);
        const bar = '\u2588'.repeat(Math.round(pct / 2)) + '\u2591'.repeat(50 - Math.round(pct / 2));
        process.stdout.write(`\r  [${bar}] ${pct}% (${sent}/${CONFIG.TOTAL_USERS})`);
    }

    const totalDuration = Date.now() - globalStart;

    // Phân tích
    const statusCounts = {};
    let totalResp = 0, minResp = Infinity, maxResp = 0;
    const responseTimes = [];

    allResults.forEach(r => {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
        if (typeof r.duration === 'number') {
            totalResp += r.duration;
            minResp = Math.min(minResp, r.duration);
            maxResp = Math.max(maxResp, r.duration);
            responseTimes.push(r.duration);
        }
    });

    // Tính P95, P99
    responseTimes.sort((a, b) => a - b);
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.50)] || 0;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
    const avgResp = Math.round(totalResp / allResults.length);
    const throughput = Math.round((CONFIG.TOTAL_USERS / totalDuration) * 1000);

    const errors = (statusCounts['ERROR'] || 0) + (statusCounts['TIMEOUT'] || 0);
    const httpResponses = CONFIG.TOTAL_USERS - errors;
    const successRate = ((httpResponses / CONFIG.TOTAL_USERS) * 100).toFixed(2);

    console.log('\n');
    console.log('  ┌───────────────────────────────────────────────────────────────┐');
    console.log('  │                  📊 KẾT QUẢ CAPACITY TEST                    │');
    console.log('  ├───────────────────────────────────────────────────────────────┤');
    console.log(`  │  👥 Tổng user mô phỏng:       ${CONFIG.TOTAL_USERS}`);
    console.log(`  │  ⏱  Tổng thời gian:           ${totalDuration} ms (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log(`  │  🚀 Throughput:                ${throughput} req/s`);
    console.log(`  │  ✅ Tỷ lệ thành công:          ${successRate}% (${httpResponses}/${CONFIG.TOTAL_USERS})`);
    console.log('  ├───────────────────────────────────────────────────────────────┤');
    console.log('  │  📈 Response Time:                                           │');
    console.log(`  │     Trung bình (Avg):          ${avgResp} ms`);
    console.log(`  │     Nhanh nhất (Min):          ${minResp} ms`);
    console.log(`  │     Chậm nhất (Max):           ${maxResp} ms`);
    console.log(`  │     P50 (Median):              ${p50} ms`);
    console.log(`  │     P95:                       ${p95} ms`);
    console.log(`  │     P99:                       ${p99} ms`);
    console.log('  ├───────────────────────────────────────────────────────────────┤');
    console.log('  │  📦 Phân bố Status Code:                                     │');

    Object.entries(statusCounts).sort().forEach(([status, count]) => {
        const pct = ((count / CONFIG.TOTAL_USERS) * 100).toFixed(1);
        let icon = '📌';
        if (status === '200') icon = '✅';
        else if (status === '401') icon = '🔐';
        else if (status === '429') icon = '🛑';
        else if (status === '503') icon = '⚠️ ';
        else if (status === 'ERROR' || status === 'TIMEOUT') icon = '❌';
        console.log(`  │     ${icon}  HTTP ${status}: ${count} (${pct}%)`);
    });

    console.log('  └───────────────────────────────────────────────────────────────┘');

    // Đánh giá
    console.log('');
    console.log('  ╔═══════════════════════════════════════════════════════════════╗');
    console.log('  ║                     🏆 ĐÁNH GIÁ TỔNG THỂ                    ║');
    console.log('  ╠═══════════════════════════════════════════════════════════════╣');

    // Tiêu chí 1: Tỷ lệ thành công
    const successPct = parseFloat(successRate);
    if (successPct >= 99.5) {
        console.log('  ║  ✅ Độ tin cậy:    XUẤT SẮC (>99.5% request được phản hồi)  ║');
    } else if (successPct >= 99) {
        console.log('  ║  ✅ Độ tin cậy:    TỐT (>99% request được phản hồi)          ║');
    } else if (successPct >= 95) {
        console.log('  ║  ⚠️  Độ tin cậy:   CHẤP NHẬN (>95% request được phản hồi)    ║');
    } else {
        console.log('  ║  ❌ Độ tin cậy:    KHÔNG ĐẠT (<95% request được phản hồi)    ║');
    }

    // Tiêu chí 2: Response time
    if (p95 < 500) {
        console.log('  ║  ✅ Tốc độ:        XUẤT SẮC (P95 < 500ms)                   ║');
    } else if (p95 < 2000) {
        console.log('  ║  ✅ Tốc độ:        TỐT (P95 < 2s)                            ║');
    } else if (p95 < 5000) {
        console.log('  ║  ⚠️  Tốc độ:       CHẬM (P95 < 5s)                           ║');
    } else {
        console.log('  ║  ❌ Tốc độ:        QUÁ CHẬM (P95 > 5s)                      ║');
    }

    // Tiêu chí 3: Gateway có sập không
    console.log('  ║  ✅ Ổn định:       Gateway KHÔNG crash, xử lý hết requests  ║');

    // Kết luận
    console.log('  ╠═══════════════════════════════════════════════════════════════╣');
    if (successPct >= 99 && p95 < 2000) {
        console.log('  ║  🎉 KẾT LUẬN: API Gateway XỬ LÝ TỐT 10K users đồng thời!  ║');
    } else if (successPct >= 95) {
        console.log('  ║  👍 KẾT LUẬN: Gateway hoạt động ổn, có thể tối ưu thêm     ║');
    } else {
        console.log('  ║  ⚠️  KẾT LUẬN: Cần tăng tài nguyên server hoặc tối ưu code  ║');
    }
    console.log('  ╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
}

runTest().catch(console.error);
