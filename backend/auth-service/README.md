# 🔐 Auth Service

## Service Description

**Auth Service** là service xác thực và quản lý người dùng trong hệ thống IUH Connect. Đây là service đầu tiên mà mọi client tương tác — chịu trách nhiệm:

- **Đăng ký (Register)**: Tạo tài khoản mới, hash password bằng BCrypt, lưu vào MariaDB, phát sự kiện `user-events` qua Kafka để các service khác đồng bộ.
- **Đăng nhập (Login)**: Xác thực credentials, trả về cặp JWT tokens (access + refresh).
- **JWT Stateless Auth**: Sinh và validate JSON Web Tokens — không lưu session trên server.

Auth Service đóng vai trò **Write Model** trong pattern CQRS: dữ liệu user được ghi tại đây (MariaDB) và đồng bộ bất đồng bộ sang Chat Service (MongoDB) thông qua Kafka.

---

## Tech Stack & Libraries

| Library | Version | Mục đích |
|---------|---------|----------|
| **Spring Boot** | 3.2.0 | Framework chính |
| **Spring Web** | — | REST API (`@RestController`) |
| **Spring Data JPA** | — | ORM cho MariaDB |
| **Spring Security** | — | Security filter chain, `PasswordEncoder` |
| **Spring Kafka** | — | Kafka Producer cho event publishing |
| **Spring Validation** | — | Bean Validation (`@NotBlank`, `@Size`) |
| **MariaDB JDBC Driver** | (managed) | Kết nối MariaDB |
| **jjwt (io.jsonwebtoken)** | 0.12.3 | Sinh & validate JWT tokens (HMAC-SHA256) |
| **Lombok** | (managed) | Reduce boilerplate (`@Builder`, `@Getter`...) |
| **JDK** | 17 | Java version |

---

## Environment Variables

Các biến cấu hình trong `application.yml` — có thể override bằng environment variables:

| Variable | Default | Mô tả |
|----------|---------|-------|
| `SERVER_PORT` | `8081` | Port HTTP của service |
| `SPRING_DATASOURCE_URL` | `jdbc:mariadb://mariadb:3306/auth_db` | JDBC URL kết nối MariaDB |
| `SPRING_DATASOURCE_USERNAME` | `iuh_user` | Username MariaDB |
| `SPRING_DATASOURCE_PASSWORD` | `iuh_pass` | Password MariaDB |
| `SPRING_DATASOURCE_DRIVER_CLASS_NAME` | `org.mariadb.jdbc.Driver` | JDBC driver |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | `update` | Hibernate schema strategy |
| `SPRING_JPA_SHOW_SQL` | `true` | Log SQL queries |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:29092` | Kafka broker address (nội bộ Docker) |
| `JWT_SECRET` | `IUHConnectSuperSecretKey...` | HMAC-SHA secret key (≥256 bits) |
| `JWT_ACCESS_EXPIRATION_MS` | `900000` | Access token TTL (15 phút) |
| `JWT_REFRESH_EXPIRATION_MS` | `604800000` | Refresh token TTL (7 ngày) |

> ⚠️ Khi chạy ngoài Docker, đổi `mariadb` → `localhost` và Kafka `kafka:29092` → `localhost:9092`.

---

## Database & Caching

### MariaDB — Database `auth_db`

**Không sử dụng Redis.** Auth Service chỉ tương tác với MariaDB.

#### Table: `users`

Được tạo tự động bởi Hibernate (`ddl-auto: update`) từ entity `User.java`:

| Column | Type | Constraints | Mô tả |
|--------|------|-------------|-------|
| `id` | `BIGINT` (auto-increment) | `PRIMARY KEY` | ID người dùng |
| `username` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | Tên đăng nhập |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | BCrypt hash của password |
| `avatar_url` | `VARCHAR(255)` | nullable | URL ảnh đại diện |

**JPA Entity mapping:**
```java
@Entity
@Table(name = "users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "avatar_url")
    private String avatarUrl;
}
```

**Repository:** `UserRepository` extends `JpaRepository<User, Long>` — custom method:
- `Optional<User> findByUsername(String username)`

---

## API Endpoints

Base path: `/api/v1/auth` — tất cả endpoints đều **public** (không cần JWT).

### `POST /api/v1/auth/register`

Đăng ký user mới, publish Kafka event, trả về JWT tokens.

| Field | Type | Validation | Required |
|-------|------|-----------|----------|
| `username` | `String` | `@NotBlank`, `@Size(min=3, max=50)` | ✅ |
| `password` | `String` | `@NotBlank`, `@Size(min=6)` | ✅ |
| `avatarUrl` | `String` | — | ❌ |

**Request:**
```json
{
  "username": "john_doe",
  "password": "secret123",
  "avatarUrl": "https://example.com/avatar.png"
}
```

**Response `201 Created`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "tokenType": "Bearer"
}
```

**Error cases:**
- `400` — Validation failed (username quá ngắn, password quá ngắn)
- `500` — Username đã tồn tại (`IllegalArgumentException`)

**Flow nội bộ:**
1. Kiểm tra username chưa tồn tại
2. BCrypt encode password → lưu `User` vào MariaDB
3. Publish `UserEventDto` lên Kafka topic `user-events`
4. Sinh access + refresh token → trả về client

---

### `POST /api/v1/auth/login`

Xác thực credentials, trả về JWT tokens.

| Field | Type | Validation | Required |
|-------|------|-----------|----------|
| `username` | `String` | `@NotBlank` | ✅ |
| `password` | `String` | `@NotBlank` | ✅ |

**Request:**
```json
{
  "username": "john_doe",
  "password": "secret123"
}
```

**Response `200 OK`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "tokenType": "Bearer"
}
```

**Error cases:**
- `401` — Invalid username or password (`BadCredentialsException`)

---

## Security Configuration

```
SecurityFilterChain:
  ├── CSRF: disabled (stateless API)
  ├── Session: STATELESS
  ├── Permit All: /api/v1/auth/**
  ├── Authenticated: everything else
  └── Filter: JwtAuthenticationFilter (before UsernamePasswordAuthenticationFilter)
```

### JWT Token Structure

- **Algorithm**: HMAC-SHA (derived from secret key ≥ 256 bits)
- **Subject** (`sub`): username
- **Issued At** (`iat`): current timestamp
- **Expiration** (`exp`): `iat` + expiration ms

**`JwtTokenProvider`** cung cấp:
- `generateAccessToken(username)` → 15 min TTL
- `generateRefreshToken(username)` → 7 days TTL
- `getUsernameFromToken(token)` → extract subject
- `validateToken(token)` → `true`/`false`

**`JwtAuthenticationFilter`** (`OncePerRequestFilter`):
- Extract `Authorization: Bearer <token>` header
- Validate token → set `SecurityContext`
- Nếu không có token hoặc invalid → bỏ qua (filter chain tiếp tục)

---

## Event Streams (Kafka)

### ✅ Produces

| Topic | Key | Payload | Trigger |
|-------|-----|---------|---------|
| `user-events` | `userId` (String) | `UserEventDto` | Sau khi `register` thành công |

**`UserEventDto` payload:**
```json
{
  "userId": 1,
  "username": "john_doe",
  "avatarUrl": "https://example.com/avatar.png"
}
```

**Producer implementation** (`UserEventProducer.java`):
- Sử dụng `KafkaTemplate<String, UserEventDto>`
- Async send với `CompletableFuture` callback logging
- Kafka config: `StringSerializer` (key) + `JsonSerializer` (value)

**Kafka Producer Config** (`KafkaProducerConfig.java`):
- Tạo topic `user-events` với 3 partitions, replication factor = 1
- Custom `ProducerFactory` và `KafkaTemplate` beans

### ❌ Consumes

Auth Service **không consume** bất kỳ Kafka topic nào.

---

## Dependencies (Inter-Service Communication)

Auth Service **không gọi trực tiếp** (HTTP/gRPC) tới bất kỳ service nào khác.

Giao tiếp duy nhất là **bất đồng bộ qua Kafka** — publish events để Chat Service consume.

```
Auth Service ──(Kafka: user-events)──▶ Chat Service
```

---

## Source Code Structure

```
auth-service/
├── Dockerfile                 # Multi-stage build (Maven → JRE 17)
├── pom.xml                    # Dependencies & build config
├── mvnw.cmd                   # Maven wrapper (Windows)
├── .mvn/                      # Maven wrapper config
└── src/main/java/com/iuhconnect/authservice/
    ├── AuthServiceApplication.java          # @SpringBootApplication entry point
    ├── config/
    │   ├── SecurityConfig.java              # SecurityFilterChain, BCrypt, AuthManager
    │   └── KafkaProducerConfig.java         # ProducerFactory, KafkaTemplate, Topic
    ├── controller/
    │   └── AuthController.java              # POST /register, POST /login
    ├── dto/
    │   ├── RegisterRequest.java             # username, password, avatarUrl
    │   ├── LoginRequest.java                # username, password
    │   ├── AuthResponse.java                # accessToken, refreshToken, tokenType
    │   └── UserEventDto.java                # userId, username, avatarUrl (Kafka payload)
    ├── model/
    │   └── User.java                        # JPA Entity → MariaDB table "users"
    ├── repository/
    │   └── UserRepository.java              # JpaRepository + findByUsername()
    ├── security/
    │   ├── JwtTokenProvider.java            # Generate & validate JWT tokens
    │   └── JwtAuthenticationFilter.java     # Extract Bearer token → SecurityContext
    └── service/
        ├── AuthService.java                 # Business logic: register(), login()
        └── UserEventProducer.java           # Kafka producer: publish user-events
```

---

## Quick Start (Standalone)

```bash
# Yêu cầu: MariaDB chạy trên localhost:3307, Kafka trên localhost:9092

# Override env cho local development
set SPRING_DATASOURCE_URL=jdbc:mariadb://localhost:3307/auth_db
set SPRING_KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# Build & Run
./mvnw.cmd spring-boot:run
```

Hoặc chạy qua Docker Compose (khuyến nghị):
```bash
cd ../../
docker-compose up --build auth-service
```
