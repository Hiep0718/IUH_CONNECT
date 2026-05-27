# PHÂN TÍCH KIẾN TRÚC IUHCONNECT - CÂU TRẢ LỜI CHI TIẾT

**Ngày tạo:** May 22, 2026  
**Dự án:** IUH Connect - Hệ thống liên lạc cho học viên Đại học Công nghiệp TP.HCM

---

## PHẦN 1: THÔNG TIN CHO 3 SƠ ĐỒ LỚP (CLASS DIAGRAMS)

### 1. Class Diagram 1: Chat Service (Trái tim của DepLao)

#### **WebSockets:**

**Q1.1: Lớp ChatWebSocketHandler kế thừa từ TextWebSocketHandler hay implement trực tiếp WebSocketHandler?**

**Trả lời:** `ChatWebSocketHandler` **kế thừa từ `TextWebSocketHandler`**

```java
// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/ChatWebSocketHandler.java
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {
    // Handler xử lý các loại message khác nhau
}
```

**Lý do:**
- `TextWebSocketHandler` là một tiện ích (convenience class) của Spring mà xử lý các pesan dạng text
- Nó cung cấp các method hook như `afterConnectionEstablished()`, `handleTextMessage()`, `afterConnectionClosed()`
- Thích hợp cho ứng dụng chat sử dụng JSON text messages

---

**Q1.2: Trong WebSocketSessionManager, bạn dùng cấu trúc dữ liệu gì để lưu danh sách người dùng đang online?**

**Trả lời:** Dùng **`ConcurrentHashMap<String, WebSocketSession>`**

```java
// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/WebSocketSessionManager.java
@Component
public class WebSocketSessionManager {
    // username → WebSocketSession (1 session per user per node)
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    
    public void registerSession(String username, WebSocketSession session) {
        WebSocketSession oldSession = sessions.put(username, session);
        // Logic xử lý session cũ...
    }
}
```

**Cấu trúc:**
- **Key:** `String` (username)
- **Value:** `WebSocketSession` (đối tượng session WebSocket)
- **Thread-safety:** `ConcurrentHashMap` đảm bảo an toàn khi có multiple threads truy cập đồng thời

**Tính năng bổ sung:**
- Khi user login mới, session cũ bị đóng và gửi signal `SESSION_REVOKED`
- Mỗi node chỉ lưu sessions của người dùng kết nối tới node đó
- Thông tin routing được lưu trong Redis với key `presence:user:{userId}`

---

#### **MongoDB Repository:**

**Q1.3: Trong MessageRepository, có định nghĩa các hàm truy vấn tùy chỉnh (Custom query methods) nào?**

**Trả lời:** Có **3 custom query methods chính:**

```java
// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/repository/MessageRepository.java
@Repository
public interface MessageRepository extends MongoRepository<MessageEntity, String> {

    /**
     * Truy vấn 1: Lấy tin nhắn theo conversationId, sắp xếp theo timestamp giảm dần (mới nhất trước)
     * Dùng cho: Load message history khi mở conversation
     */
    List<MessageEntity> findByConversationIdOrderByTimestampDesc(
        String conversationId, 
        org.springframework.data.domain.Pageable pageable
    );

    /**
     * Truy vấn 2: Cursor-based pagination - lấy tin nhắn TRƯỚC một mốc thời gian
     * Dùng cho: Tải thêm tin nhắn cũ khi scroll up (pagination)
     */
    List<MessageEntity> findByConversationIdAndTimestampLessThanOrderByTimestampDesc(
        String conversationId, 
        long timestamp, 
        org.springframework.data.domain.Pageable pageable
    );

    /**
     * Truy vấn 3: Aggregation pipeline phức tạp
     * Lấy recent conversations cho user với unread count
     * Dùng cho: Danh sách conversation summary
     */
    @org.springframework.data.mongodb.repository.Aggregation(pipeline = {
        "{ $match: { $or: [ { 'sender_id': ?0 }, { 'receiver_id': ?0 } ] } }",
        "{ $sort: { 'timestamp': -1 } }",
        "{ $group: { _id: '$conversation_id', doc: { $first: '$$ROOT' }, unreadCount: { $sum: { $cond: [ { $and: [ { $eq: ['$receiver_id', ?0] }, { $ne: ['$is_read', true] } ] }, 1, 0 ] } } } }",
        "{ $addFields: { 'doc.unread_count': '$unreadCount' } }",
        "{ $replaceRoot: { newRoot: '$doc' } }",
        "{ $sort: { 'timestamp': -1 } }"
    })
    List<com.iuhconnect.chatservice.dto.ConversationSummaryDto> findRecentConversationsForUser(String userId);
}
```

**Chi tiết từng truy vấn:**

| Tên Method | Tham số | Trả về | Mục đích |
|-----------|---------|--------|---------|
| `findByConversationIdOrderByTimestampDesc` | conversationId, Pageable | `List<MessageEntity>` | Load message history (20 tin nhắn mới nhất) |
| `findByConversationIdAndTimestampLessThanOrderByTimestampDesc` | conversationId, timestamp, Pageable | `List<MessageEntity>` | Pagination - load tin nhắn cũ hơn (trước mốc thời gian) |
| `findRecentConversationsForUser` (Aggregation) | userId | `List<ConversationSummaryDto>` | Danh sách conversation kèm unread count |

---

#### **Kafka & Auto-reply:**

**Q1.4: Lớp ChatMessageKafkaConsumer nhận DTO nào từ topic chat-messages?**

**Trả lời:** Nhận **`ChatMessageDto`** từ Kafka topic `chat-messages`

```java
// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/consumer/ChatMessageKafkaConsumer.java
@Component
public class ChatMessageKafkaConsumer {
    
    @KafkaListener(
        topics = "chat-messages",
        groupId = "#{T(java.util.UUID).randomUUID().toString()}"  // Mỗi instance có UUID khác
    )
    public void consumeChatMessage(ChatMessageDto message) {
        // Xử lý message
        // 1. Lưu vào MongoDB
        // 2. Gửi tới receiver qua WebSocket
    }
}
```

**Cấu trúc ChatMessageDto:**

```java
// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/dto/ChatMessageDto.java
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChatMessageDto {
    private String id;
    private String senderId;              // ID người gửi
    private String receiverId;            // ID người nhận
    private String content;               // Nội dung tin nhắn
    private String conversationId;        // ID conversation
    private long timestamp;               // Thời gian gửi (epoch millis)
    
    // Media fields
    private String messageType;           // TEXT, IMAGE, VIDEO, FILE, STICKER
    private String mediaUrl;              // URL file trên MinIO
    private String thumbnailUrl;          // Thumbnail (cho image/video)
    private String fileName;              // Tên file gốc
    private long fileSize;                // Kích thước (bytes)
    private String mimeType;              // MIME type (image/png, video/mp4)
    
    // Reply-to fields
    private String replyToId;             // ID tin nhắn được reply
    private String replyToText;           // Nội dung tin nhắn được reply
    private String replyToSender;         // Người gửi tin nhắn được reply
}
```

**Flow Kafka:**
1. Client gửi message qua WebSocket
2. Handler validate → publish vào Kafka topic `chat-messages`
3. Consumer lắng nghe và xử lý
4. Message được lưu vào MongoDB
5. Gửi tới receiver qua WebSocket (nếu online)

---

**Q1.5: Khi gọi AutoReplyService, nó có cần gọi sang Auth Service (qua FeignClient hoặc RestTemplate) để kiểm tra xem tài khoản có Role là LECTURER và Status là BUSY không, hay thông tin này được cache sẵn?**

**Trả lời:** **Hiện tại project CHƯA implement AutoReplyService**

Tuy nhiên dựa trên kiến trúc, nếu implement sẽ **cần gọi Auth Service** vì:

1. **Kiến trúc hiện tại không cache thông tin user status:**
   - Chat Service không có User entity
   - Thông tin `lecturerStatus` (AVAILABLE/BUSY) chỉ lưu trong Auth Service
   - Thông tin Role cũng lưu trong Auth Service

2. **Cách thực hiện (nếu cần implement):**

```java
// Tùy chọn 1: FeignClient
@FeignClient(name = "auth-service", url = "${auth-service.url:http://localhost:8081}")
public interface AuthServiceClient {
    @GetMapping("/api/v1/users/{username}")
    UserInfoDto getUserInfo(@PathVariable String username);
}

// Tùy chọn 2: RestTemplate (có sẵn trong project)
restTemplate.getForObject(
    "http://auth-service/api/v1/users/{username}",
    UserInfoDto.class,
    username
);

// AutoReplyService
@Service
public class AutoReplyService {
    private final AuthServiceClient authClient; // hoặc RestTemplate
    
    public boolean shouldAutoReply(String lecturerId) {
        UserInfoDto user = authClient.getUserInfo(lecturerId);
        return user.getRole() == Role.LECTURER 
            && user.getLecturerStatus() == LecturerStatus.BUSY;
    }
}
```

3. **Lưu ý về performance:**
   - Nên cache kết quả trong Redis với TTL (ví dụ 5 phút)
   - Hoặc subscribe tới Kafka topic `user-events` để update cache khi user thay đổi status

---

#### **Tích hợp Jitsi:**

**Q1.6: Bạn tạo luồng WebRTC thông qua Jitsi bằng cách có một JitsiService riêng để xử lý logic sinh link phòng họp, hay xử lý trực tiếp trong controller/service khác?**

**Trả lời:** Không dùng `JitsiService` riêng, thay vào đó sử dụng **3 service phối hợp:**

```
1. MeetingSessionService  → Quản lý vòng đời meeting (stored in Redis)
2. CallSignalService      → Xử lý WebRTC signaling
3. MeetingController      → REST API endpoints cho handoff token
```

**Cấu trúc chi tiết:**

```java
// 1. MeetingSessionService - Quản lý meeting lifecycle
@Service
public class MeetingSessionService {
    
    // Tạo meeting khi CALL_INVITE
    public MeetingSession createMeeting(String hostUserId, String roomName) {
        // Tạo meetingId + save vào Redis
        // TTL: 24 giờ
    }
    
    // Handoff token để desktop join
    public String createHandoffToken(String meetingId, String userId) {
        // Tạo UUID token
        // Lưu mapping: token → meetingId + userId
        // TTL: 5 phút
    }
}

// 2. CallSignalService - Xử lý WebRTC signaling qua WebSocket
@Service
public class CallSignalService {
    
    public void handleSignal(CallSignalDto signal) {
        switch(signal.getSignalType()) {
            case "CALL_INVITE":
                // Tạo meeting + room name
                MeetingSession meeting = meetingSessionService.createMeeting(...);
                signal.setMeetingId(meeting.getMeetingId());
                signal.setRoomName(meeting.getRoomName());
                relaySignal(signal);  // Gửi tới receiver
                break;
            case "CALL_ACCEPT":
                // Update meeting status → ACTIVE
                break;
        }
    }
}

// 3. MeetingController - REST API
@RestController
@RequestMapping("/api/v1/meetings")
public class MeetingController {
    
    private static final String JITSI_SERVER = "https://meet.ffmuc.net";
    
    // Mobile: tạo handoff token
    @PostMapping("/{meetingId}/handoff-token")
    public ResponseEntity<HandoffTokenResponse> createHandoffToken(
        @PathVariable String meetingId,
        HttpServletRequest request) {
        String token = meetingSessionService.createHandoffToken(meetingId, userId);
        return ResponseEntity.ok(HandoffTokenResponse.builder()
            .handoffToken(token)
            .meetingUrl("/meeting/join?token=" + token)
            .build());
    }
    
    // Desktop: resolve handoff token
    @GetMapping("/handoff/{token}")
    public ResponseEntity<MeetingJoinInfoResponse> resolveHandoff(@PathVariable String token) {
        MeetingSession session = meetingSessionService.resolveHandoffToken(token);
        String jitsiUrl = JITSI_SERVER + "/" + session.getRoomName();
        return ResponseEntity.ok(MeetingJoinInfoResponse.builder()
            .meetingId(session.getMeetingId())
            .roomName(session.getRoomName())
            .jitsiUrl(jitsiUrl)  // URL để embed Jitsi iframe
            .build());
    }
    
    // Desktop: thông báo đã join
    @PostMapping("/{meetingId}/device-joined")
    public ResponseEntity<Void> deviceJoined(@PathVariable String meetingId) {
        // Broadcast DEVICE_JOINED signal tới mobile participants
        for(String participant : session.getParticipantUserIds()) {
            callSignalService.handleSignal(signal);
        }
        return ResponseEntity.ok().build();
    }
}
```

**Flow cuộc gọi:**
```
1. Mobile caller → WebSocket "CALL_INVITE" signal
   ↓
2. Server tạo MeetingSession (meetingId + roomName)
   ↓
3. Server relay signal tới callee qua WebSocket
   ↓
4. Callee gửi "CALL_ACCEPT"
   ↓
5. Meeting status → ACTIVE
   ↓
6. Mobile: gọi REST API createHandoffToken → handoff token
   ↓
7. Desktop: gọi REST API resolveHandoff → Jitsi URL
   ↓
8. Desktop: embed Jitsi iframe tại URL
   ↓
9. Desktop gọi device-joined → broadcast tới mobile
```

**URL Jitsi sử dụng:** `https://meet.ffmuc.net/{roomName}`  
(Public Jitsi server, không cần API key)

---

### 2. Class Diagram 2: Auth Service (Bảo mật & Người dùng)

#### **Bảo mật Spring Security:**

**Q2.1: Bạn có implement interface UserDetails cho lớp UserEntity không?**

**Trả lời:** **KHÔNG implement UserDetails**

```java
// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/model/User.java
@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 50)
    private String username;
    
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    
    // ... các field khác
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private Role role = Role.STUDENT;
    
    // KHÔNG implement UserDetails
}
```

**Tại sao không implement UserDetails:**
- Project dùng **JWT token-based authentication**, không dùng session-based
- Spring Security chỉ cần extract username + role từ JWT claim
- UserDetails là tiện ích cho session-based auth

**Cách Spring Security lấy thông tin user:**
```java
// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/security/JwtAuthenticationFilter.java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractTokenFromRequest(request);
        
        if(token != null && jwtTokenProvider.validateToken(token)) {
            String username = jwtTokenProvider.getUsernameFromToken(token);
            String role = jwtTokenProvider.getRoleFromToken(token);
            
            // Tạo authentication từ JWT claim (KHÔNG gọi database)
            List<SimpleGrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_" + role)
            );
            
            UsernamePasswordAuthenticationToken authentication = 
                new UsernamePasswordAuthenticationToken(username, null, authorities);
            
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }
        filterChain.doFilter(request, response);
    }
}
```

---

**Q2.2: Lớp tiện ích xử lý JWT (ví dụ JwtUtils hoặc JwtService) chứa những phương thức cốt lõi nào?**

**Trả lời:** Có lớp **`JwtTokenProvider`** chứa 6 phương thức cốt lõi:

```java
// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/security/JwtTokenProvider.java
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.access-expiration-ms}")
    private long accessExpirationMs;        // Ví dụ: 3600000 (1 giờ)

    @Value("${jwt.refresh-expiration-ms}")
    private long refreshExpirationMs;       // Ví dụ: 604800000 (7 ngày)

    private SecretKey key;

    @PostConstruct
    public void init() {
        // Chuyển secret string thành SecretKey (256-bit HMAC key)
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    // ==================== 1. GENERATE ====================

    /**
     * Tạo access token (có role claim)
     * TTL: 1 giờ (mặc định)
     */
    public String generateAccessToken(String username, String role) {
        return buildToken(username, role, accessExpirationMs);
    }

    /**
     * Tạo refresh token (KHÔNG có role)
     * TTL: 7 ngày (mặc định)
     */
    public String generateRefreshToken(String username) {
        return buildToken(username, null, refreshExpirationMs);
    }

    private String buildToken(String subject, String role, long expirationMs) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        var builder = Jwts.builder()
                .subject(subject)           // "username"
                .issuedAt(now)              // "iat" claim
                .expiration(expiryDate);    // "exp" claim

        if (role != null) {
            builder.claim("role", role);    // Custom claim: "role"
        }

        return builder.signWith(key).compact();
    }

    // ==================== 2. EXTRACT ====================

    /**
     * Lấy username từ token (subject claim)
     * @return username hoặc throw exception nếu token không hợp lệ
     */
    public String getUsernameFromToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    /**
     * Lấy role từ token (custom claim)
     * @return role (STUDENT, LECTURER, ADMIN) hoặc null
     */
    public String getRoleFromToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get("role", String.class);
    }

    // ==================== 3. VALIDATE ====================

    /**
     * Kiểm tra token hợp lệ (signature + expiration)
     * @return true nếu valid, false nếu expired hoặc signature sai
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
```

**Configuration trong application.properties:**
```properties
jwt.secret=IUHConnectSuperSecretKeyForJWT2024MustBeAtLeast256BitsLong!!
jwt.access-expiration-ms=3600000      # 1 giờ
jwt.refresh-expiration-ms=604800000   # 7 ngày
```

**Payload JWT mẫu:**
```json
{
  "sub": "john_doe",
  "role": "LECTURER",
  "iat": 1716379200,
  "exp": 1716382800
}
```

---

**Q2.3: Bean dùng để mã hóa mật khẩu là gì?**

**Trả lời:** **`BCryptPasswordEncoder`**

```java
// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/config/SecurityConfig.java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();  // ← Bean chính
    }
}
```

**Cách sử dụng:**

```java
// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/service/AuthService.java
@Service
public class AuthService {
    
    private final PasswordEncoder passwordEncoder;
    
    // ========== Login ==========
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
            .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));

        // So sánh mật khẩu plain text với hash trong DB
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid username or password");
        }
        // ✅ Mật khẩu chính xác
        String accessToken = jwtTokenProvider.generateAccessToken(...);
        return AuthResponse.builder()
            .accessToken(accessToken)
            .refreshToken(refreshToken)
            .build();
    }

    // ========== Register ==========
    public AuthResponse register(RegisterRequest request) {
        // Hash mật khẩu trước khi lưu
        User user = User.builder()
            .username(request.getUsername())
            .passwordHash(passwordEncoder.encode(request.getPassword()))  // ← Encoding
            .email(request.getEmail())
            .role(userRole)
            .build();

        User savedUser = userRepository.save(user);
        // ...
        return AuthResponse.builder()
            .accessToken(accessToken)
            .refreshToken(refreshToken)
            .build();
    }
}
```

**BCrypt features:**
- **Salt tự động:** Mỗi lần encode cùng password → khác nhau
- **Work factor:** Default = 10 (tạo delay để chống brute force)
- **Deterministic comparison:** Dùng `matches()` để so sánh an toàn

---

#### **Cấu trúc Entity (MariaDB):**

**Q2.4: Khai báo quan hệ giữa UserEntity và FriendshipEntity trong code Java: Bạn dùng @OneToMany từ User sang Friendship, hay định nghĩa Friendship là một bảng trung gian độc lập chứa 2 khóa ngoại (user_id1, user_id2)?**

**Trả lời:** Friendship được **định nghĩa là bảng trung gian độc lập** với **@ManyToOne** relationships:

```java
// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/model/Friendship.java
@Entity
@Table(name = "friendships", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id1", "user_id2"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Friendship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ===== Quan hệ ManyToOne tới User (User 1) =====
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id1", nullable = false)
    private User user1;  // Người gửi lời kết bạn (Requester)

    // ===== Quan hệ ManyToOne tới User (User 2) =====
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id2", nullable = false)
    private User user2;  // Người nhận lời kết bạn (Receiver)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FriendshipStatus status;  // PENDING hoặc ACCEPTED

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

// FriendshipStatus enum
public enum FriendshipStatus {
    PENDING,   // Lời mời chưa được chấp nhận
    ACCEPTED   // Đã là bạn bè
}
```

**Repository:**

```java
// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/repository/FriendshipRepository.java
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    // Tìm mối quan hệ giữa hai user (không quan tâm thứ tự)
    @Query("SELECT f FROM Friendship f WHERE (f.user1 = :u1 AND f.user2 = :u2) 
                                         OR (f.user1 = :u2 AND f.user2 = :u1)")
    Optional<Friendship> findByUsers(@Param("u1") User u1, @Param("u2") User u2);

    // Lấy danh sách lời mời kết bạn PENDING của user2
    List<Friendship> findByUser2AndStatus(User user2, FriendshipStatus status);

    // Lấy tất cả friends (ACCEPTED) hoặc pending requests của user
    @Query("SELECT f FROM Friendship f WHERE (f.user1 = :user OR f.user2 = :user) 
                                         AND f.status = :status")
    List<Friendship> findAllUserFriendships(@Param("user") User user, 
                                             @Param("status") FriendshipStatus status);
}
```

**Schema MariaDB tương ứng:**
```sql
CREATE TABLE friendships (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id1 BIGINT NOT NULL,
    user_id2 BIGINT NOT NULL,
    status ENUM('PENDING', 'ACCEPTED') NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    UNIQUE KEY uk_users (user_id1, user_id2),
    FOREIGN KEY (user_id1) REFERENCES users(id),
    FOREIGN KEY (user_id2) REFERENCES users(id)
);
```

**Tại sao design này:**
- ✅ **Symmetric relationships:** Có thể query lời mời từ cả chiều
- ✅ **Bidirectional:** Không cần 2 records cho mỗi friendship
- ✅ **Separation of concerns:** User entity không cần biết about friendships
- ✅ **Flexible:** Có thể dễ dàng extend (thêm field như label, etc.)

---

### 3. Class Diagram 3: API Gateway & Presence Service

#### **API Gateway Filter:**

**Q3.1: Class đóng vai trò chặn request để kiểm tra token tên là gì? Nó kế thừa từ AbstractGatewayFilterFactory hay implement GlobalFilter?**

**Trả lời:** Class tên **`JwtAuthFilter`**, **implement `GlobalFilter`** (không inherit AbstractGatewayFilterFactory)

```java
// File: backend/api-gateway/src/main/java/com/iuhconnect/gateway/filter/JwtAuthFilter.java
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    /**
     * Danh sách đường dẫn công khai (không cần JWT)
     */
    private static final List<String> PUBLIC_PATHS = List.of(
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh"
    );

    /**
     * WebSocket paths (JWT được xử lý bởi downstream services)
     */
    private static final List<String> WS_PATHS = List.of(
        "/ws/chat",
        "/ws/presence"
    );

    @Value("${jwt.secret}")
    private String jwtSecret;

    private SecretKey key;

    @PostConstruct
    public void init() {
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        // 1. Skip public paths (login, register không cần token)
        if (isPublicPath(path)) {
            return chain.filter(exchange);
        }

        // 2. Skip WebSocket paths (jwt được verify bởi chat-service/presence-service)
        if (isWebSocketPath(path)) {
            return chain.filter(exchange);
        }

        // 3. Extract JWT từ Authorization header
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("🚫 [Gateway] Missing or invalid Authorization header for path: {}", path);
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        String token = authHeader.substring(7);  // Bỏ "Bearer "

        // 4. Validate JWT signature
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String username = claims.getSubject();
            String role = claims.get("role", String.class);

            // 5. Thêm user info vào request headers cho downstream services
            ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                    .header("X-Auth-User", username)
                    .header("X-Auth-Role", role != null ? role : "")
                    .build();

            log.debug("✅ [Gateway] JWT valid — user={}, role={}, path={}", username, role, path);
            return chain.filter(exchange.mutate().request(mutatedRequest).build());

        } catch (Exception e) {
            log.warn("🚫 [Gateway] Invalid JWT token for path {}: {}", path, e.getMessage());
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
    }

    @Override
    public int getOrder() {
        return -1;  // Execute BEFORE all other filters
    }

    private boolean isPublicPath(String path) {
        return PUBLIC_PATHS.stream().anyMatch(path::startsWith);
    }

    private boolean isWebSocketPath(String path) {
        return WS_PATHS.stream().anyMatch(path::startsWith);
    }
}
```

**Tại sao dùng GlobalFilter:**
- GlobalFilter được áp dụng cho **tất cả routes** mà không cần cấu hình cho từng route
- AbstractGatewayFilterFactory cần khai báo filter cho từng route (phức tạp hơn)
- GlobalFilter + `getOrder()` = -1 → chạy đầu tiên (ngoài cùng)

**Flow xác thực:**
```
HTTP Request
  ↓
JwtAuthFilter (GlobalFilter, Order=-1)
  ├─ Check public paths? → YES → Forward to service
  ├─ Check WS paths? → YES → Forward to service (ws handler sẽ verify)
  ├─ Extract token → Validate signature
  ├─ SUCCESS → Add headers (X-Auth-User, X-Auth-Role) → Forward
  └─ FAIL → Return 401 Unauthorized
```

---

**Q3.2: Gateway có tự kết nối vào MariaDB để lấy thông tin user xác thực token, hay chỉ đơn giản là giải mã chữ ký JWT bằng secret key?**

**Trả lời:** **Chỉ giải mã chữ ký JWT** - KHÔNG kết nối MariaDB

```java
// JwtAuthFilter.java
try {
    Claims claims = Jwts.parser()
            .verifyWith(key)              // ← Chỉ verify signature
            .build()
            .parseSignedClaims(token)
            .getPayload();

    String username = claims.getSubject();
    String role = claims.get("role", String.class);
    
    // ✅ Lấy username + role từ JWT claims (NO database call)
    // ❌ KHÔNG gọi database
    
} catch (Exception e) {
    // Token invalid
}
```

**Tại sao:**
1. **Stateless JWT design:** JWT chứa tất cả thông tin cần thiết
2. **Performance:** Không phải gọi database cho mỗi request
3. **Scalability:** Gateway có thể xử lý hàng ngàn requests/sec mà không bottleneck
4. **Secret key sharing:** Gateway và Auth Service dùng chung `jwt.secret`

**Sequence diagram:**
```
1. Auth Service tạo token: 
   {username: "john", role: "LECTURER"}
   → Sign bằng secret key → Token JWT

2. Client gửi request kèm token

3. Gateway:
   - Extract token
   - Verify signature bằng secret key (KHÔNG query DB)
   - Extract claims
   - Thêm vào headers X-Auth-User, X-Auth-Role

4. Downstream service:
   - Nhận headers từ gateway
   - Dùng thông tin để authorize (KHÔNG query DB nữa)
```

**Lợi ích:**
- ✅ Giảm network calls
- ✅ Độ trễ thấp
- ✅ Không phụ thuộc vào Auth Service availability
- ✅ Scaling horizontal dễ dàng

---

#### **Presence Service:**

**Q3.3: Trong cấu hình Spring Boot, bạn thao tác với Redis bằng StringRedisTemplate hay RedisTemplate<String, Object>?**

**Trả lời:** Dùng **`StringRedisTemplate`** (specialized cho String values)

```java
// File: backend/presence-service/src/main/java/com/iuhconnect/presenceservice/service/PresenceService.java
@Service
public class PresenceService {

    private static final String PRESENCE_KEY_PREFIX = "presence:";
    private static final String LAST_SEEN_KEY_PREFIX = "lastseen:";

    private final StringRedisTemplate redisTemplate;  // ← StringRedisTemplate, KHÔNG RedisTemplate<String, Object>
    
    public PresenceService(StringRedisTemplate redisTemplate, ...) {
        this.redisTemplate = redisTemplate;
    }

    public void setOnline(String userId) {
        String key = PRESENCE_KEY_PREFIX + userId;
        long now = System.currentTimeMillis();

        // String value operations
        redisTemplate.opsForValue().set(key, "ONLINE", 90, TimeUnit.SECONDS);
        redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, 
                                        String.valueOf(now));
    }

    public boolean isOnline(String userId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(PRESENCE_KEY_PREFIX + userId));
    }

    public void setOffline(String userId) {
        redisTemplate.delete(PRESENCE_KEY_PREFIX + userId);
    }
}
```

**Cấu trúc Redis:**
```
presence:user1        → "ONLINE"           (TTL: 90s)
presence:user2        → "ONLINE"           (TTL: 90s)
presence:user3        → (expired/deleted)
lastseen:user1        → "1716379200000"
lastseen:user2        → "1716379200000"
```

**Tại sao dùng StringRedisTemplate:**
- **Type-safe:** Biết chắc là String-to-String
- **Performance:** Tối ưu hóa cho String type
- **Simple:** Chỉ cần opsForValue() cho string operations
- **Serialization:** Tự động serialize/deserialize String (không cần custom serializers)

**Nếu dùng RedisTemplate<String, Object>:**
```java
// ❌ KHÔNG dùng - phức tạp hơn và cần config serialization
RedisTemplate<String, Object> redisTemplate;

redisTemplate.opsForValue().set(key, "ONLINE");
// Sẽ lưu dưới dạng binary serialized Java object, KHÔNG phải string đơn giản
```

---

**Q3.4: Khi người dùng mất mạng (phát hiện qua NetInfo ở React Native) và socket bị đóng, hàm nào trong PresenceService được gọi để đổi trạng thái thành OFFLINE?**

**Trả lời:** Khi socket đóng, 2 method được gọi tùy theo context:

**1. Chat Service (khi chat WebSocket close):**
```java
// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/handler/ChatWebSocketHandler.java
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String username = (String) session.getAttributes().get("username");
        if (username != null) {
            sessionManager.removeSession(username);
            presenceService.userDisconnected(username);  // ← Method gọi đây
        }
        log.info("🔌 WebSocket disconnected [username={}, status={}]", username, status);
    }
}
```

**2. Presence Service (khi presence WebSocket close):**
```java
// File: backend/presence-service/src/main/java/com/iuhconnect/presenceservice/handler/PresenceWebSocketHandler.java
@Component
public class PresenceWebSocketHandler extends TextWebSocketHandler {

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String username = (String) session.getAttributes().get("username");
        if (username != null) {
            sessions.remove(username);
            presenceService.setOffline(username);  // ← Method gọi đây
        }
        log.info("🔌 Presence WS disconnected [username={}, status={}, total={}]",
                username, status, sessions.size());
    }
}
```

**Method detail:**
```java
// File: backend/presence-service/src/main/java/com/iuhconnect/presenceservice/service/PresenceService.java
public void setOffline(String userId) {
    String key = PRESENCE_KEY_PREFIX + userId;
    long now = System.currentTimeMillis();

    // 1. Xóa presence key → user OFFLINE ngay lập tức
    redisTemplate.delete(key);
    
    // 2. Update lastseen
    redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, 
                                    String.valueOf(now));

    log.info("🔴 User OFFLINE: {}", userId);

    // 3. Publish Kafka event cho chat-service biết
    publishEvent(userId, "OFFLINE", now);
}
```

**Flow mất mạng:**
```
Frontend (React Native):
  1. NetInfo.addEventListener() phát hiện không có mạng
  2. Gọi socket.disconnect()
  
Backend:
  1. afterConnectionClosed() được gọi
  2. Gọi presenceService.setOffline(username)
  3. Delete Redis key "presence:userId"
  4. Publish Kafka event "presence-events"
  5. Chat Service consume event
  6. Chat Service broadcast PRESENCE_UPDATE tới contacts

Result:
  ✅ Trạng thái mất mạng xuất hiện trên contacts trong vòng <100ms
```

**TTL tự động (Fail-safe):**
```java
// Nếu client crash (không gọi disconnect):
redisTemplate.opsForValue().set(key, "ONLINE", 90, TimeUnit.SECONDS);
// Redis sẽ tự xóa key sau 90 giây
// → Mặc dù không gọi setOffline(), vẫn tự động OFFLINE
```

---

## PHẦN 2: THÔNG TIN CHO 3 SƠ ĐỒ DATABASE (THIẾT KẾ DỮ LIỆU)

### 4. Sơ đồ 1: ERD Chuẩn (MariaDB - Dữ liệu quan hệ)

#### **Khóa chính (PK):**

**Q4.1: Bảng users và friendships sử dụng khóa chính dạng chuỗi UUID hay số nguyên BIGINT (Tự động tăng)?**

**Trả lời:** Sử dụng **BIGINT tự động tăng**

```java
// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/model/User.java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // ← BIGINT auto-increment
    private Long id;
    
    // ... fields
}

// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/model/Friendship.java
@Entity
@Table(name = "friendships")
public class Friendship {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // ← BIGINT auto-increment
    private Long id;
    
    // ... fields
}
```

**Schema SQL:**
```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    full_name VARCHAR(100),
    role ENUM('STUDENT', 'LECTURER', 'ADMIN') NOT NULL,
    ...
);

CREATE TABLE friendships (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id1 BIGINT NOT NULL FOREIGN KEY REFERENCES users(id),
    user_id2 BIGINT NOT NULL FOREIGN KEY REFERENCES users(id),
    status ENUM('PENDING', 'ACCEPTED') NOT NULL,
    ...
);
```

**Tại sao BIGINT chứ không UUID:**
- ✅ **Performance:** Integer index nhanh hơn UUID (8 bytes vs 16 bytes)
- ✅ **Storage:** Tiết kiệm space hơn UUID
- ✅ **Sortable:** Dễ dàng sort + range query
- ✅ **JPA native support:** IDENTITY strategy là mặc định
- ❌ **UUID:** Không có lợi ích trong trường hợp này

---

#### **Trường dữ liệu bảng Users:**

**Q4.2: Ngoài các trường cơ bản (id, username, password, email, role, avatar), bạn có lưu trường status (ONLINE/OFFLINE/BUSY) ở đây luôn không, hay chỉ lưu ở Redis?**

**Trả lời:** **KHÔNG lưu trạng thái ở bảng users** - chỉ lưu ở Redis

```java
// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/model/User.java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "email", unique = true, length = 100)
    private String email;

    @Column(name = "full_name", length = 100)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender")
    private Gender gender;

    @Column(name = "date_of_birth")
    private java.time.LocalDate dateOfBirth;

    @Column(name = "address", length = 255)
    private String address;

    @Column(name = "bio", length = 500)
    private String bio;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "student_id", length = 50)
    private String studentId;

    @Column(name = "lecturer_id", length = 50)
    private String lecturerId;

    @Column(name = "department", length = 100)
    private String department;

    @Enumerated(EnumType.STRING)
    @Column(name = "lecturer_status")
    private LecturerStatus lecturerStatus;  // ← CHỈ có lecturer_status (AVAILABLE/BUSY), KHÔNG có ONLINE/OFFLINE

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private Role role = Role.STUDENT;

    @Column(name = "fcm_token", length = 500)
    private String fcmToken;

    // ❌ KHÔNG có: status ENUM('ONLINE', 'OFFLINE', 'BUSY')
}
```

**Trạng thái được lưu ở đâu:**

| Trạng thái | Nơi lưu | TTL | Cập nhật |
|-----------|---------|-----|---------|
| ONLINE/OFFLINE | Redis (`presence:{userId}`) | 90 giây | Heartbeat từ client / disconnect |
| BUSY/AVAILABLE | MariaDB (`lecturer_status`) | Vĩnh viễn | User cập nhật thủ công |

**Redis structure:**
```
presence:user1        → "ONLINE"     (TTL 90s)
lastseen:user1        → "1716379200000"
presence:user:user1   → "instance-1" (internal routing)
```

**Tại sao design này:**
1. **Transient data:** ONLINE/OFFLINE hay thay đổi liên tục → không lưu database
2. **Real-time performance:** Redis access millisecond vs database millisecond+
3. **Scalability:** Không cần query/update database cho mỗi status change
4. **Separation of concerns:** 
   - MariaDB: Permanent user info (email, role, etc.)
   - Redis: Transient session info (online status, etc.)

---

#### **Trạng thái kết bạn:**

**Q4.3: Bảng friendships có trường status để phân biệt "Đang chờ" (PENDING) và "Đã chấp nhận" (ACCEPTED) không?**

**Trả lời:** **CÓ trường status**

```java
// File: backend/auth-service/src/main/java/com/iuhconnect/authservice/model/Friendship.java
@Entity
@Table(name = "friendships", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id1", "user_id2"})
})
public class Friendship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id1", nullable = false)
    private User user1;  // Người gửi request

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id2", nullable = false)
    private User user2;  // Người nhận request

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FriendshipStatus status;  // ← PENDING hoặc ACCEPTED

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

// Enum
public enum FriendshipStatus {
    PENDING,   // Lời mời chưa được chấp nhận
    ACCEPTED   // Đã là bạn bè
}
```

**Schema SQL:**
```sql
CREATE TABLE friendships (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id1 BIGINT NOT NULL,
    user_id2 BIGINT NOT NULL,
    status ENUM('PENDING', 'ACCEPTED') NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    UNIQUE KEY uk_users (user_id1, user_id2),
    FOREIGN KEY (user_id1) REFERENCES users(id),
    FOREIGN KEY (user_id2) REFERENCES users(id)
);
```

**Query examples:**

```java
// Lấy pending requests cho user
List<Friendship> pendingRequests = friendshipRepository
    .findByUser2AndStatus(user, FriendshipStatus.PENDING);

// Lấy tất cả friends (accepted)
List<Friendship> friends = friendshipRepository
    .findAllUserFriendships(user, FriendshipStatus.ACCEPTED);

// Kiểm tra mối quan hệ giữa 2 users
Optional<Friendship> relation = friendshipRepository.findByUsers(user1, user2);
```

---

### 5. Sơ đồ 2: Document Schema (MongoDB - Dữ liệu phi cấu trúc)

#### **Khóa ngoại chéo:**

**Q5.1: Trường senderId trong collection messages được lưu dưới dạng chuỗi String (khớp với MariaDB) hay dạng ObjectId đặc thù của Mongo?**

**Trả lời:** Lưu dưới dạng **chuỗi String**

```java
// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/model/MessageEntity.java
@Document(collection = "messages")
public class MessageEntity {

    @Id
    private String id;  // ← MongoDB _id (do MongoRepository tạo)

    @Field("sender_id")
    private String senderId;  // ← String (khớp với user.id từ MariaDB)

    @Field("receiver_id")
    private String receiverId;  // ← String (khớp với user.id từ MariaDB)

    @Field("conversation_id")
    private String conversationId;  // ← String conversation ID

    private String content;
    private long timestamp;
    // ... fields khác
}
```

**MongoDB document mẫu:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "sender_id": "12345",           // ← String, KHÔNG phải ObjectId
  "receiver_id": "67890",
  "conversation_id": "conv-uuid-1",
  "content": "Hello there!",
  "timestamp": 1716379200000,
  "message_type": "TEXT",
  "is_read": false,
  "reactions": {
    "❤️": ["12345"],
    "😂": ["67890", "12345"]
  }
}
```

**Tại sao String:**
1. **Cross-database references:** MongoDB documents tham chiếu tới relational database IDs
2. **String flexibility:** ID từ MariaDB là `BIGINT` → convert thành String dễ dàng
3. **Join simulation:** Application layer có thể join MongoDB + MariaDB data

**Schema MongoDB:**
```javascript
db.createCollection("messages", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["sender_id", "receiver_id", "conversation_id", "timestamp"],
      properties: {
        _id: { bsonType: "objectId" },
        sender_id: { bsonType: "string" },
        receiver_id: { bsonType: "string" },
        conversation_id: { bsonType: "string" },
        content: { bsonType: "string" },
        timestamp: { bsonType: "long" },
        message_type: { bsonType: "string", enum: ["TEXT", "IMAGE", "VIDEO", "FILE", "STICKER"] },
        is_read: { bsonType: "bool" }
      }
    }
  }
});

db.messages.createIndex({ "conversation_id": 1, "timestamp": -1 });
```

---

#### **Cấu trúc Document conversations:**

**Q5.2: Mảng members lưu dưới dạng mảng ID chuỗi đơn giản ["id1", "id2"], hay lưu thành một mảng Object nhúng (Embedded) gồm cả role [{ "userId": "id1", "role": "ADMIN", "joinedAt": ... }]?**

**Trả lời:** Lưu dưới dạng **mảng Object nhúng** (Embedded)

```java
// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/model/ConversationEntity.java
@Document(collection = "conversations")
public class ConversationEntity {

    @Id
    private String id;

    private String name;          // Chỉ cho GROUP

    private String avatar;        // Chỉ cho GROUP

    @Field("type")
    private ConversationType type; // SINGLE hoặc GROUP

    @Field("creator_id")
    private String creatorId;

    @Field("members")
    private List<GroupMember> members;  // ← Embedded objects, KHÔNG phải simple strings

    @Field("created_at")
    private long createdAt;

    @Field("updated_at")
    private long updatedAt;

    @Field("last_message_id")
    private String lastMessageId;
}

// GroupMember - embedded class
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupMember {
    private String userId;
    private GroupRole role;        // ADMIN, MEMBER
    private long joinedAt;
}

public enum GroupRole {
    ADMIN,
    MEMBER
}
```

**MongoDB document mẫu (SINGLE conversation):**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "type": "SINGLE",
  "creator_id": "12345",
  "members": [
    {
      "userId": "12345",
      "role": "MEMBER",
      "joinedAt": 1716379200000
    },
    {
      "userId": "67890",
      "role": "MEMBER",
      "joinedAt": 1716379200000
    }
  ],
  "created_at": 1716379200000,
  "updated_at": 1716379200000,
  "last_message_id": "msg-uuid-1"
}
```

**MongoDB document mẫu (GROUP conversation):**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439013"),
  "name": "Advanced OOP Class",
  "avatar": "https://minio.../group-avatar.png",
  "type": "GROUP",
  "creator_id": "99999",
  "members": [
    {
      "userId": "99999",
      "role": "ADMIN",
      "joinedAt": 1716379200000
    },
    {
      "userId": "12345",
      "role": "MEMBER",
      "joinedAt": 1716379210000
    },
    {
      "userId": "67890",
      "role": "MEMBER",
      "joinedAt": 1716379220000
    }
  ],
  "created_at": 1716379200000,
  "updated_at": 1716379200000,
  "last_message_id": "msg-uuid-2"
}
```

**Tại sao embedded objects:**
1. **Rich queries:** Có thể filter/query trên role, joinedAt, etc.
2. **Atomicity:** Member info luôn consistent với conversation
3. **Performance:** Tránh N+1 query problem
4. **Flexibility:** Dễ mở rộng (thêm field như muted, etc.)

**Query example:**
```java
// Lấy conversations nơi user1 là ADMIN
@Query("{ 'members': { $elemMatch: { 'userId': ?0, 'role': 'ADMIN' } } }")
List<ConversationEntity> findWhereUserIsAdmin(String userId);
```

---

#### **Trạng thái đọc tin nhắn:**

**Q5.3: Bạn dùng một cờ boolean isRead hay dùng một mảng readBy chứa danh sách ID người đã xem?**

**Trả lời:** Dùng **cơ chế hybrid:**
- **isRead**: Boolean cơ bản (cho SINGLE conversation)
- **readBy**: Mảng (cho GROUP conversation)

```java
// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/model/MessageEntity.java
@Document(collection = "messages")
public class MessageEntity {

    @Id
    private String id;

    @Field("sender_id")
    private String senderId;

    @Field("receiver_id")
    private String receiverId;  // Chỉ dùng cho SINGLE conversation

    private String content;

    @Field("conversation_id")
    private String conversationId;

    private long timestamp;

    // ==================== Read status ====================
    
    @Field("is_read")
    @Builder.Default
    private boolean isRead = false;  // ← Cho SINGLE conversation
    
    // Lưu ý: Chưa implement readBy[] cho GROUP
    // Nhưng structure cho phép thêm sau:
    // @Field("read_by")
    // private List<String> readBy;  // IDs của người đã xem
    
    @Field("unread_count")
    private Integer unreadCount;  // Cho aggregation query

    // ... fields khác
}
```

**MongoDB document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "sender_id": "12345",
  "receiver_id": "67890",
  "conversation_id": "conv-uuid-1",
  "content": "Hello!",
  "timestamp": 1716379200000,
  "is_read": false,
  "unread_count": 5  // Dùng cho aggregation query
}
```

**Marking as read:**

```java
// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/MessageService.java
public void markAsRead(String conversationId, String userId) {
    // Lấy tất cả unread messages cho user trong conversation
    List<MessageEntity> unreadMessages = messageRepository
        .findByConversationIdOrderByTimestampDesc(conversationId, Pageable.unpaged())
        .stream()
        .filter(msg -> !msg.isRead() && userId.equals(msg.getReceiverId()))
        .toList();
    
    // Đánh dấu là đã đọc
    for (MessageEntity msg : unreadMessages) {
        msg.setRead(true);
    }
    messageRepository.saveAll(unreadMessages);
}
```

**Tại sao cơ chế này:**
- ✅ **Simple cho SINGLE:** Boolean đủ
- ✅ **Flexible cho GROUP:** Có thể mở rộng readBy[] khi cần
- ✅ **Performance:** unreadCount cache kết quả aggregation

---

### 6. Sơ đồ 3: Key-Value Structure (Redis - In-memory)

#### **Định dạng Key:**

**Q6.1: Key lưu trữ có chuẩn xác là chuỗi presence:{userId} không?**

**Trả lời:** **Đúng**, có 3 key prefixes chính:

```java
// File: backend/presence-service/src/main/java/com/iuhconnect/presenceservice/service/PresenceService.java
private static final String PRESENCE_KEY_PREFIX = "presence:";
private static final String LAST_SEEN_KEY_PREFIX = "lastseen:";

// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/PresenceService.java
private static final String INSTANCE_KEY_PREFIX = "presence:user:";
private static final String PRESENCE_KEY_PREFIX = "presence:";
private static final String LAST_SEEN_KEY_PREFIX = "lastseen:";
```

**Redis key structure:**

| Key Pattern | Nơi tạo | Purpose | TTL | Value |
|-------------|---------|---------|-----|-------|
| `presence:{userId}` | Presence Service | Track online status | 90s | "ONLINE" or deleted |
| `lastseen:{userId}` | Presence Service | Last seen timestamp | ∞ | Epoch millis (string) |
| `presence:user:{userId}` | Chat Service | Routing: which instance | 24h | Instance ID |
| `signaling:{instanceId}` | Redis Pub/Sub | Route signaling messages | N/A | Message payload |
| `meeting:session:{meetingId}` | Meeting Service | Store meeting state | 24h | JSON (serialized) |
| `meeting:handoff:{token}` | Meeting Service | Handoff token mapping | 5m | "meetingId\|userId" |

**Cụ thể:**

```redis
# Presence tracking
presence:user123            → "ONLINE"              (TTL: 90s)
lastseen:user123           → "1716379200000"       (No TTL)

# Internal routing (chat service)
presence:user:user123      → "chat-service-1"      (TTL: 24h)

# Meeting sessions
meeting:session:uuid1      → {JSON MeetingSession} (TTL: 24h)
meeting:handoff:token123   → "uuid1|user123"       (TTL: 5m)
```

---

#### **Cấu trúc Value:**

**Q6.2: Value được lưu dưới dạng một chuỗi đơn giản (VD: "ONLINE"), hay là một chuỗi JSON phức tạp chứa mốc thời gian (VD: {"status": "ONLINE", "lastSeen": 1684235400000, "deviceId": "..."})?**

**Trả lời:** **Lưu dưới dạng chuỗi đơn giản** cho `presence`, nhưng JSON phức tạp cho `meeting`

```java
// Presence - SIMPLE STRING
redisTemplate.opsForValue().set("presence:user123", "ONLINE", 90, TimeUnit.SECONDS);
// Value: "ONLINE" (string đơn giản)

// LastSeen - STRING TIMESTAMP
redisTemplate.opsForValue().set("lastseen:user123", "1716379200000");
// Value: "1716379200000" (string)

// Meeting Session - JSON (Complex)
MeetingSession meeting = MeetingSession.builder()
    .meetingId("uuid-123")
    .roomName("IUHConnect_user1_1716379200000")
    .hostUserId("user1")
    .participantUserIds(Set.of("user1", "user2"))
    .status(MeetingStatus.ACTIVE)
    .createdAt(1716379200000)
    .updatedAt(1716379200000)
    .build();

String json = objectMapper.writeValueAsString(meeting);
redisTemplate.opsForValue().set("meeting:session:uuid-123", json, 24, TimeUnit.HOURS);

// Value (formatted for readability):
/*
{
  "meetingId": "uuid-123",
  "roomName": "IUHConnect_user1_1716379200000",
  "hostUserId": "user1",
  "participantUserIds": ["user1", "user2"],
  "status": "ACTIVE",
  "createdAt": 1716379200000,
  "updatedAt": 1716379200000
}
*/
```

**So sánh:**

| Key | Value format | Tại sao |
|-----|--------------|--------|
| `presence:{userId}` | Simple string ("ONLINE") | Tần suất query cao, không cần metadata |
| `lastseen:{userId}` | String timestamp | Đơn giản, chỉ cần 1 field |
| `meeting:session:{id}` | JSON | Cấu trúc phức tạp nhiều field |
| `meeting:handoff:{token}` | String ("meetingId\|userId") | 2 values, dùng delimiter |

**Flow ví dụ:**

```javascript
// 1. User online
SET presence:user123 "ONLINE" EX 90
GET presence:user123  → "ONLINE"

// 2. Get all online users
KEYS presence:*
MGET presence:user1 presence:user2 presence:user3

// 3. Meeting session
SET meeting:session:uuid-1 '{"meetingId":"uuid-1","status":"ACTIVE"}' EX 86400
GET meeting:session:uuid-1 → {"meetingId":"uuid-1","status":"ACTIVE"}
```

---

#### **Thời gian sống (TTL):**

**Q6.3: Bạn set thời gian tự hủy (Time-to-live) cho các key trạng thái trên Redis là bao lâu?**

**Trả lời:** Các TTL khác nhau tùy mục đích:

```java
// File: backend/presence-service/src/main/java/com/iuhconnect/presenceservice/service/PresenceService.java
public void setOnline(String userId) {
    // ===== TTL: 90 giây =====
    // Nếu client không heartbeat trong 90s → auto expire
    redisTemplate.opsForValue().set(
        PRESENCE_KEY_PREFIX + userId,
        "ONLINE",
        90,  // ← TTL
        TimeUnit.SECONDS
    );
    
    // LastSeen: NO TTL (vĩnh viễn)
    redisTemplate.opsForValue().set(
        LAST_SEEN_KEY_PREFIX + userId,
        String.valueOf(now)
        // ← NO expiration
    );
}

// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/MeetingSessionService.java
public MeetingSession createMeeting(String hostUserId, String roomName) {
    // ===== Meeting Session TTL: 24 giờ =====
    redisTemplate.opsForValue().set(
        SESSION_KEY_PREFIX + meetingId,
        json,
        24,  // ← TTL
        TimeUnit.HOURS
    );
}

public String createHandoffToken(String meetingId, String userId) {
    // ===== Handoff Token TTL: 5 phút =====
    redisTemplate.opsForValue().set(
        HANDOFF_KEY_PREFIX + token,
        value,
        300,  // ← TTL
        TimeUnit.SECONDS
    );
}

// File: backend/chat-service/src/main/java/com/iuhconnect/chatservice/service/PresenceService.java
public void userConnected(String userId) {
    // ===== Internal routing TTL: 24 giờ =====
    redisTemplate.opsForValue().set(
        INSTANCE_KEY_PREFIX + userId,
        currentInstanceId,
        24,  // ← TTL
        TimeUnit.HOURS
    );
}
```

**TTL Summary Table:**

| Key | TTL | Reason | Handling when expired |
|-----|-----|--------|----------------------|
| `presence:{userId}` | **90 seconds** | Client sends PING/heartbeat mỗi 30s; nếu không → user OFFLINE | Auto-expire → treated as OFFLINE |
| `lastseen:{userId}` | **∞ (no expiry)** | Lưu trữ lâu dài | Manually update on logout |
| `presence:user:{userId}` | **24 hours** | Routing info, update on new login | Auto-expire → request to all instances |
| `meeting:session:{id}` | **24 hours** | Meeting stored for 1 day | Auto-cleanup old meetings |
| `meeting:handoff:{token}` | **5 minutes** | Short-lived token, must use quickly | Expire → token becomes invalid |

**Heartbeat mechanism:**

```java
// Client (React Native):
setInterval(() => {
    websocket.send({ type: "PING" });
}, 30000);  // Every 30 seconds

// Server:
@Override
protected void handleTextMessage(WebSocketSession session, TextMessage message) {
    if ("PING".equals(type)) {
        presenceService.refreshHeartbeat(username);  // ← Extend TTL
    }
}

public void refreshHeartbeat(String userId) {
    String presenceKey = PRESENCE_KEY_PREFIX + userId;
    Boolean exists = redisTemplate.hasKey(presenceKey);
    
    if (Boolean.TRUE.equals(exists)) {
        redisTemplate.expire(presenceKey, 90, TimeUnit.SECONDS);  // ← Extend to 90s
    }
}
```

**Timeline mất kết nối:**

```
T=0s:  Client online → SET presence:user1 ONLINE EX 90
T=30s: Client sends PING → EXPIRE presence:user1 90 (reset)
T=60s: Client sends PING → EXPIRE presence:user1 90 (reset)
T=90s: No PING received → Key expires → OFFLINE
T=95s: GET presence:user1 → (empty) → treated as OFFLINE
```

---

## KẾT LUẬN

| Component | Technology | Pattern |
|-----------|-----------|---------|
| **WebSocket Handler** | TextWebSocketHandler | Extends, NOT implements |
| **Session Storage** | ConcurrentHashMap | In-memory + Redis routing |
| **MongoDB Query** | Custom methods + Aggregation | find + aggregation pipeline |
| **Kafka Consumer** | ChatMessageDto | Event-driven |
| **JWT** | JwtTokenProvider | Stateless, No DB calls |
| **API Gateway** | GlobalFilter | Signature verification only |
| **Presence** | StringRedisTemplate | Simple string values |
| **Database IDs** | BIGINT IDENTITY | Auto-increment, NOT UUID |
| **User Status** | Redis (ONLINE) + DB (BUSY) | Hybrid approach |
| **Friendship** | Separate entity | @ManyToOne with status |
| **Conversation Members** | Embedded objects | GroupMember array |
| **Message Read Status** | isRead boolean | Hybrid with aggregation |
| **Redis Keys** | Prefixed strings | Multiple TTLs (90s to 24h) |
| **Meeting Session** | JSON serialized | 24-hour TTL |
| **Handoff Token** | Simple string | 5-minute TTL |

---

**Document ends here.**
