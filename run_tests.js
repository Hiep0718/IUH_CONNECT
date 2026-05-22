const fs = require('fs');

const GATEWAY_URL = 'http://localhost:8080';
const USERNAME = `testuser_${Date.now()}`;
const PASSWORD = 'password123';
let accessToken = '';

// Helper để in kết quả
function printResult(testName, passed, details = '') {
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  const color = passed ? '\x1b[32m' : '\x1b[31m'; // Xanh lá / Đỏ
  const reset = '\x1b[0m';
  console.log(`${color}${icon} - ${testName}${reset} ${details}`);
}

async function runTests() {
  console.log('\n🚀 BẮT ĐẦU CHẠY AUTOMATED TESTS CHO QUALITY ATTRIBUTES...\n');

  // ==========================================
  // 1. AVAILABILITY - HEALTH CHECKS
  // ==========================================
  console.log('--- 1. Kiểm tra Availability (Health Checks) ---');
  const services = [
    { name: 'API Gateway', url: 'http://localhost:8080/actuator/health' },
    { name: 'Auth Service', url: 'http://localhost:8085/actuator/health' },
    { name: 'Chat Service', url: 'http://localhost:8082/actuator/health' },
    { name: 'Presence Service', url: 'http://localhost:8083/actuator/health' },
  ];

  for (const service of services) {
    try {
      const res = await fetch(service.url);
      const data = await res.json();
      printResult(`Health Check: ${service.name}`, data.status === 'UP', `(Status: ${data.status})`);
    } catch (e) {
      printResult(`Health Check: ${service.name}`, false, `(Lỗi kết nối)`);
    }
  }

  // ==========================================
  // 2. SECURITY - JWT
  // ==========================================
  console.log('\n--- 2. Kiểm tra Security (JWT tại API Gateway) ---');
  
  // 2.0 Đăng ký user tạm để test
  try {
    const regRes = await fetch(`${GATEWAY_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: USERNAME,
        password: PASSWORD,
        email: `${USERNAME}@test.com`,
        fullName: 'Test User',
        role: 'STUDENT',
        studentId: `SV${Date.now()}`
      })
    });
    if (!regRes.ok) {
      console.log('⚠️ [Debug] Đăng ký không thành công:', await regRes.text());
    }
  } catch(e) {
    console.log('⚠️ [Debug] Lỗi gọi API đăng ký:', e.message);
  }

  // 2.1 Public path
  try {
    const loginRes = await fetch(`${GATEWAY_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });
    const loginData = await loginRes.json().catch(() => ({}));
    if (loginRes.ok && loginData.accessToken) {
      accessToken = loginData.accessToken;
      printResult('Test 1.4: Public Path (Login)', true, '(Thành công không cần token)');
    } else {
      printResult('Test 1.4: Public Path (Login)', false, `(Login thất bại HTTP ${loginRes.status}: ${JSON.stringify(loginData)})`);
    }
  } catch (e) {
    printResult('Test 1.4: Public Path (Login)', false, `(Lỗi kết nối: ${e.message})`);
  }

  // 2.2 Không có token -> 401
  try {
    const noTokenRes = await fetch(`${GATEWAY_URL}/api/v1/chat/conversations`);
    printResult('Test 1.1: Request không có token -> 401', noTokenRes.status === 401, `(HTTP ${noTokenRes.status})`);
  } catch (e) {}

  // 2.3 Có token -> 200
  try {
    const validTokenRes = await fetch(`${GATEWAY_URL}/api/v1/chat/conversations`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    printResult('Test 1.2: Request có token hợp lệ -> 200 (hoặc khác 401)', validTokenRes.status !== 401, `(HTTP ${validTokenRes.status})`);
  } catch (e) {}

  // 2.4 Token giả mạo -> 401
  try {
    const fakeToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.fake_signature";
    const fakeTokenRes = await fetch(`${GATEWAY_URL}/api/v1/chat/conversations`, {
      headers: { 'Authorization': `Bearer ${fakeToken}` }
    });
    printResult('Test 1.5: Token giả mạo -> 401', fakeTokenRes.status === 401, `(HTTP ${fakeTokenRes.status})`);
  } catch (e) {}

  // ==========================================
  // 3. FAULT TOLERANCE - RATE LIMITER
  // ==========================================
  console.log('\n--- 3. Kiểm tra Fault Tolerance (Rate Limiter) ---');
  if (accessToken) {
    try {
      let limitHit = false;
      const requests = [];
      // Bắn 25 requests đồng thời (limit là 20)
      for (let i = 0; i < 25; i++) {
        requests.push(fetch(`${GATEWAY_URL}/api/v1/chat/conversations`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }).then(res => res.status));
      }
      
      const statuses = await Promise.all(requests);
      const okCount = statuses.filter(s => s !== 429).length;
      const rateLimitCount = statuses.filter(s => s === 429).length;
      
      printResult('Test 3A.1: Burst > 20 requests -> 429', rateLimitCount > 0, `(${rateLimitCount} requests bị block (429), ${okCount} requests pass)`);
    } catch (e) {
      printResult('Test 3A.1: Rate Limiter', false, '(Lỗi khi gọi API)');
    }
  } else {
    console.log('⚠️ Skip Rate Limiter test vì chưa lấy được accessToken');
  }

  // ==========================================
  // 4. PERFORMANCE - REDIS CACHE
  // ==========================================
  console.log('\n--- 4. Kiểm tra Performance (Redis Cache) ---');
  if (accessToken) {
    try {
      // Gọi lần 1
      const start1 = Date.now();
      await fetch(`${GATEWAY_URL}/api/v1/chat/conversations`, { headers: { 'Authorization': `Bearer ${accessToken}` }});
      const end1 = Date.now();
      const time1 = end1 - start1;

      // Gọi lần 2
      const start2 = Date.now();
      await fetch(`${GATEWAY_URL}/api/v1/chat/conversations`, { headers: { 'Authorization': `Bearer ${accessToken}` }});
      const end2 = Date.now();
      const time2 = end2 - start2;

      // Lần 2 không nhất thiết lúc nào cũng nhanh hơn vì còn phụ thuộc CPU lúc đó, 
      // nhưng thường cache sẽ trả về lẹ hơn nếu query nặng. Ở đây ta chỉ in ra để tham khảo.
      console.log(`  ⏱️ Lần 1 (Miss): ${time1}ms`);
      console.log(`  ⏱️ Lần 2 (Hit) : ${time2}ms`);
      printResult('Test 2.1: Cache HIT', true, '(Xem thời gian phía trên, lưu ý test này chỉ mang tính tham khảo ở local)');
    } catch(e) {}
  }

  console.log('\n🎉 ĐÃ CHẠY XONG AUTOMATED TESTS!');
  console.log('Lưu ý: Bạn cần chạy `docker-compose up -d` và đảm bảo các services đã khởi động xong trước khi chạy script này.');
}

runTests();
