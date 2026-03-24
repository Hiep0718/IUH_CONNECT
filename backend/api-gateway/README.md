# 🚀 API Gateway — IUH Connect

## 📋 Service Description

**API Gateway** là điểm truy cập duy nhất (Single Entry Point) của toàn bộ hệ thống **IUH Connect**. Service này chịu trách nhiệm:

- **Định tuyến (Routing):** Tiếp nhận mọi request từ client (Mobile/Web) và chuyển tiếp đến đúng microservice phía sau.
- **HTTP Routing:** Proxy các REST API request đến `auth-service`.
- **WebSocket Routing:** Proxy kết nối WebSocket đến `chat-service` cho chức năng chat real-time.
- **Health Monitoring:** Cung cấp các endpoint Actuator để kiểm tra trạng thái hoạt động của gateway.

> Gateway **không** chứa business logic. Nó hoạt động như một reverse proxy thông minh dựa trên path-based routing.

---

## 🛠️ Tech Stack & Libraries

| Thư viện / Framework              | Phiên bản   | Mô tả                                                        |
| --------------------------------- | ----------- | ------------------------------------------------------------- |
| **Java**                          | 17          | Ngôn ngữ chính                                               |
| **Spring Boot**                   | 3.2.0       | Framework nền tảng                                            |
| **Spring Cloud Gateway**          | 2023.0.0    | Reactive API Gateway (dựa trên Netty, **không** dùng Servlet) |
| **Spring Boot Actuator**          | 3.2.0       | Health checks & monitoring endpoints                          |
| **Spring Boot Starter Test**      | 3.2.0       | Testing framework (JUnit 5, Mockito)                          |
| **Maven**                         | 3.9+        | Build tool & dependency management                            |
| **Docker** (eclipse-temurin:17)   | —           | Containerization với multi-stage build                        |

---

## 🔐 Environment Variables

Service này sử dụng cấu hình mặc định trong `application.yml`. Khi chạy qua Docker Compose, các biến môi trường sau có thể được override:

| Biến môi trường                                      | Giá trị mặc định                   | Mô tả                                                    |
| ---------------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| `SERVER_PORT`                                        | `8080`                              | Port mà gateway lắng nghe                                 |
| `SPRING_CLOUD_GATEWAY_ROUTES[0]_URI`                 | `http://auth-service:8081`          | URL đến Auth Service (HTTP)                               |
| `SPRING_CLOUD_GATEWAY_ROUTES[1]_URI`                 | `ws://chat-service:8082`            | URL đến Chat Service (WebSocket)                          |
| `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE`          | `health,info,gateway`              | Các Actuator endpoint được expose                         |
| `LOGGING_LEVEL_ORG_SPRINGFRAMEWORK_CLOUD_GATEWAY`    | `DEBUG`                             | Log level cho Spring Cloud Gateway                        |

> **Lưu ý:** Service này **không** yêu cầu biến `.env` bắt buộc. Tất cả cấu hình đã có sẵn trong `application.yml` và có thể override qua environment variables khi deploy.

---

## 💾 Database & Caching

| Thành phần  | Sử dụng? | Chi tiết                                                                 |
| ----------- | -------- | ------------------------------------------------------------------------ |
| **MariaDB** | ❌ Không  | Gateway không kết nối trực tiếp database — chỉ proxy request             |
| **MongoDB** | ❌ Không  | Tương tự, không truy cập MongoDB                                         |
| **Redis**   | ❌ Không  | Không sử dụng Redis cho caching hay session                              |

> API Gateway là **stateless** — không lưu trữ bất kỳ dữ liệu nào. Mọi dữ liệu đều nằm ở downstream services.

---

## 🌐 API Endpoints

### Gateway Routes (Proxy)

Gateway không tự cung cấp REST API mà **proxy** request đến các downstream services dựa trên path:

| Method   | Path               | Downstream Service     | Mô tả                                               |
| -------- | ------------------ | ---------------------- | ---------------------------------------------------- |
| `ANY`    | `/api/v1/auth/**`  | `auth-service:8081`    | Mọi request authentication (login, register, token…) |
| `WS`     | `/ws/chat/**`      | `chat-service:8082`    | WebSocket connection cho real-time chat               |

### Actuator Endpoints (Gateway tự cung cấp)

| Method | Path                          | Mô tả                                                    |
| ------ | ----------------------------- | --------------------------------------------------------- |
| `GET`  | `/actuator/health`            | Kiểm tra trạng thái sức khỏe gateway                     |
| `GET`  | `/actuator/info`              | Thông tin metadata của service                            |
| `GET`  | `/actuator/gateway/routes`    | Liệt kê tất cả routes đã cấu hình                       |

---

## 📨 Event Streams (Kafka)

| Hướng         | Topic | Chi tiết |
| ------------- | ----- | -------- |
| **Produces**  | —     | Không    |
| **Consumes**  | —     | Không    |

> API Gateway **không** tương tác với Kafka. Kafka được sử dụng bởi các downstream services (`auth-service`, `chat-service`) để giao tiếp event-driven với nhau.

---

## 🔗 Dependencies (Downstream Services)

API Gateway gọi trực tiếp đến các service sau qua **HTTP / WebSocket proxy**:

| Service            | Giao thức     | URL (Docker network)           | Mô tả                          |
| ------------------ | ------------- | ------------------------------ | ------------------------------- |
| **auth-service**   | HTTP          | `http://auth-service:8081`     | Xử lý đăng ký, đăng nhập, JWT  |
| **chat-service**   | WebSocket     | `ws://chat-service:8082`       | Xử lý tin nhắn real-time        |

### Sơ đồ luồng request

```
Client (Mobile/Web)
        │
        ▼
  ┌─────────────┐
  │ API Gateway  │  :8080
  │ (this svc)   │
  └──────┬───────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│  Auth  │ │  Chat  │
│Service │ │Service │
│ :8081  │ │ :8082  │
└────────┘ └────────┘
```

---

## 🐳 Docker

### Build & Run (standalone)

```bash
# Build image
docker build -t iuh-api-gateway ./backend/api-gateway

# Run container
docker run -p 8080:8080 iuh-api-gateway
```

### Run với Docker Compose (khuyến nghị)

```bash
# Từ thư mục root project
docker-compose up api-gateway
```

### Dockerfile

Service sử dụng **multi-stage build** để tối ưu kích thước image:

1. **Build stage:** `maven:3.9-eclipse-temurin-17` — biên dịch source code thành JAR.
2. **Runtime stage:** `eclipse-temurin:17-jre` — chỉ chứa JRE và file JAR.

---

## 📁 Project Structure

```
api-gateway/
├── Dockerfile                          # Multi-stage Docker build
├── pom.xml                             # Maven dependencies & build config
├── README.md                           # Tài liệu này
└── src/
    └── main/
        ├── java/com/iuhconnect/gateway/
        │   └── ApiGatewayApplication.java   # Spring Boot entry point
        └── resources/
            └── application.yml              # Route & Actuator configuration
```
