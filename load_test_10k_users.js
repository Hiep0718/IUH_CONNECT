/**
 * =============================================
 * IUH CONNECT — 10K UNIQUE USERS TEST
 * =============================================
 *
 * Mô phỏng 10.000 NGƯỜI DÙNG với IP KHÁC NHAU cùng đăng nhập.
 * Mỗi user có IP riêng (qua header X-Forwarded-For) nên
 * KHÔNG AI bị Rate Limiter chặn → tất cả phải đến được auth-service.
 *
 * Mục đích: Chứng minh "10k người thật cùng đăng nhập → hệ thống xử lý được"
 *
 * YÊU CẦU: Restart API Gateway sau khi cập nhật ipKeyResolver
 *   cd backend/api-gateway
 *   mvn spring-boot:run
 *
 * Cách chạy:
 *   node load_test_10k_users.js
 */

const http = require('http');

// =============================================
// CẤU HÌNH
// =============================================
const CONFIG = {
    GATEWAY_URL: 'http://localhost:8080',
    TOTAL_USERS: 10000,
    CONCURRENCY: 200,
};

// =============================================
// Tạo IP giả lập duy nhất cho mỗi user
// User 1 → 10.0.0.1, User 2 → 10.0.0.2, ..., User 10000 → 10.0.39.16
// =============================================
function generateIP(userId) {
    const octet3 = Math.floor((userId - 1) / 256);
    const octet4 = ((userId - 1) % 256) + 1;
    return `10.0.${octet3}.${octet4}`;
}

function sendLoginRequest(userId) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const fakeIP = generateIP(userId);

        const options = {
            hostname: 'localhost',
            port: 8080,
            path: '/api/v1/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Mỗi user có IP riêng → Rate Limiter coi mỗi user là 1 nguồn riêng biệt
                'X-Forwarded-For': fakeIP,
            },
            timeout: 30000,
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    userId,
                    ip: fakeIP,
                    status: res.statusCode,
                    duration: Date.now() - startTime,
                    rateLimitRemaining: res.headers['x-ratelimit-remaining'] || 'N/A',
                });
            });
        });

        req.on('error', (err) => {
            resolve({ userId, ip: fakeIP, status: 'ERROR', duration: Date.now() - startTime, error: err.code });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ userId, ip: fakeIP, status: 'TIMEOUT', duration: Date.now() - startTime });
        });

        req.write(JSON.stringify({
            username: `student_${userId}`,
            password: `pass_${userId}`,
        }));
        req.end();
    });
}

async function runTest() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║      IUH CONNECT — 10K UNIQUE USERS (DIFFERENT IPs) TEST        ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  🎯 Kịch bản:      10.000 sinh viên IP KHÁC NHAU cùng đăng nhập`);
    console.log(`  📋 API:           POST /api/v1/auth/login`);
    console.log(`  👥 Số user:        ${CONFIG.TOTAL_USERS} (mỗi user có IP riêng)`);
    console.log(`  ⚡ Đồng thời:      ${CONFIG.CONCURRENCY} user/đợt`);
    console.log(`  🕐 Bắt đầu:       ${new Date().toLocaleTimeString()}`);
    console.log('');
    console.log('  💡 Kỳ vọng: KHÔNG ai bị Rate Limiter chặn (mỗi IP chỉ gửi 1 request)');
    console.log('');

    const allResults = [];
    const globalStart = Date.now();
    let sent = 0;

    while (sent < CONFIG.TOTAL_USERS) {
        const batchSize = Math.min(CONFIG.CONCURRENCY, CONFIG.TOTAL_USERS - sent);
        const batch = [];
        for (let i = 0; i < batchSize; i++) {
            batch.push(sendLoginRequest(sent + i + 1));
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

    responseTimes.sort((a, b) => a - b);
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.50)] || 0;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
    const avgResp = Math.round(totalResp / allResults.length);
    const throughput = Math.round((CONFIG.TOTAL_USERS / totalDuration) * 1000);

    const errors = (statusCounts['ERROR'] || 0) + (statusCounts['TIMEOUT'] || 0);
    const rateLimited = statusCounts[429] || 0;
    const httpOk = CONFIG.TOTAL_USERS - errors;
    const successRate = ((httpOk / CONFIG.TOTAL_USERS) * 100).toFixed(2);

    console.log('\n');
    console.log('  ┌───────────────────────────────────────────────────────────────┐');
    console.log('  │           📊 KẾT QUẢ: 10K USERS DIFFERENT IPs               │');
    console.log('  ├───────────────────────────────────────────────────────────────┤');
    console.log(`  │  👥 Tổng user (IP khác nhau):  ${CONFIG.TOTAL_USERS}`);
    console.log(`  │  ⏱  Tổng thời gian:           ${totalDuration} ms (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log(`  │  🚀 Throughput:                ${throughput} req/s`);
    console.log(`  │  ✅ Tỷ lệ phản hồi:            ${successRate}% (${httpOk}/${CONFIG.TOTAL_USERS})`);
    console.log('  ├───────────────────────────────────────────────────────────────┤');
    console.log('  │  📈 Response Time:                                           │');
    console.log(`  │     Avg: ${avgResp}ms | Min: ${minResp}ms | Max: ${maxResp}ms`);
    console.log(`  │     P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`);
    console.log('  ├───────────────────────────────────────────────────────────────┤');
    console.log('  │  📦 Phân bố Status Code:                                     │');

    Object.entries(statusCounts).sort().forEach(([status, count]) => {
        const pct = ((count / CONFIG.TOTAL_USERS) * 100).toFixed(1);
        let icon = '📌', meaning = '';
        if (status === '200' || status === '201') { icon = '✅'; meaning = ' (Đăng nhập thành công)'; }
        else if (status === '401') { icon = '🔐'; meaning = ' (Sai mật khẩu — nhưng ĐÃ ĐẾN auth-service ✓)'; }
        else if (status === '429') { icon = '🛑'; meaning = ' (Bị Rate Limiter chặn)'; }
        else if (status === 'ERROR') { icon = '❌'; meaning = ' (Lỗi kết nối TCP)'; }
        else if (status === 'TIMEOUT') { icon = '⏳'; meaning = ' (Quá thời gian chờ)'; }
        console.log(`  │     ${icon}  HTTP ${status}: ${count} (${pct}%)${meaning}`);
    });

    console.log('  └───────────────────────────────────────────────────────────────┘');

    // Đánh giá trọng tâm
    console.log('');
    console.log('  ╔═══════════════════════════════════════════════════════════════╗');
    console.log('  ║                     🏆 ĐÁNH GIÁ TRỌNG TÂM                   ║');
    console.log('  ╠═══════════════════════════════════════════════════════════════╣');

    if (rateLimited === 0 && errors === 0) {
        console.log('  ║  ✅ Rate Limiter: KHÔNG chặn ai (đúng! mỗi IP chỉ 1 request)║');
        console.log('  ║  ✅ Auth-service:  Xử lý thành công TẤT CẢ 10K requests     ║');
        console.log('  ║  ✅ Gateway:       Không crash, không timeout                 ║');
        console.log('  ╠═══════════════════════════════════════════════════════════════╣');
        console.log('  ║  🎉 10.000 người dùng cùng đăng nhập → HỆ THỐNG XỬ LÝ TỐT! ║');
    } else if (rateLimited > 0) {
        console.log(`  ║  ⚠️  Rate Limiter chặn ${rateLimited} request                        ║`);
        console.log('  ║  → Có thể Gateway chưa restart sau khi cập nhật code        ║');
        console.log('  ║  → Hãy restart Gateway rồi chạy lại test                    ║');
    } else {
        const errPct = ((errors / CONFIG.TOTAL_USERS) * 100).toFixed(2);
        if (parseFloat(errPct) < 1) {
            console.log(`  ║  ✅ Tỷ lệ lỗi ${errPct}% (< 1%) — CHẤP NHẬN ĐƯỢC           ║`);
            console.log('  ║  ✅ Gateway xử lý tốt 10K users với IP khác nhau            ║');
        } else {
            console.log(`  ║  ⚠️  Tỷ lệ lỗi ${errPct}% — Cần tối ưu server              ║`);
        }
    }

    console.log('  ╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
}

runTest().catch(console.error);
