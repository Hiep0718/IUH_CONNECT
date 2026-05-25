# Kế Hoạch Chi Tiết Tích Hợp AI vào IUH Connect

Tài liệu này phác thảo chiến lược, kiến trúc và lộ trình triển khai chi tiết để tích hợp các tính năng AI vào nền tảng IUH Connect (Microservices + React Native).

## 1. Phân Tích Hiện Trạng & Cơ Hội Tích Hợp

Hệ thống IUH Connect hiện đang hoạt động theo kiến trúc Event-Driven Microservices với Spring Boot, Kafka, và MongoDB. Dữ liệu tin nhắn được push liên tục qua Kafka, tạo điều kiện cực kỳ thuận lợi để thêm một service phân tích AI mà không gây ảnh hưởng đến luồng chat thời gian thực.

### Các Cơ Hội Tích Hợp AI (High-Impact Areas)

1.  **Smart Chatbot (Trợ lý ảo học vụ & hành chính):**
    *   **Mô tả:** Một "user" đặc biệt (AI Bot) dùng để hỏi đáp tự động các thông tin về quy chế, lịch thi, thủ tục hành chính.
    *   **Công nghệ:** Retrieval-Augmented Generation (RAG) kết hợp với Vector Database lưu trữ tài liệu của trường.
2.  **Intelligent Content Analysis (Tóm tắt & Trích xuất thông tin):**
    *   **Mô tả:** Tự động tóm tắt hàng trăm tin nhắn bị lỡ trong các group lớp. Trích xuất tự động các "Deadline" hoặc "Thông báo đổi phòng học" để ghim/tạo lịch.
3.  **Notification Optimization (Phân loại thông báo thông minh):**
    *   **Mô tả:** Giảm thiểu "bão thông báo" (notification fatigue) bằng cách chấm điểm độ quan trọng của tin nhắn để có chiến lược Push Notification hợp lý.

---

## 2. Thiết Kế Kiến Trúc AI Integration

### 2.1. Thêm mới `ai-service` độc lập
Việc thiết lập một Microservice mới độc lập là bắt buộc đối với kiến trúc chuẩn để đảm bảo:
*   **Separation of Concerns:** `chat-service` duy trì I/O cao cho luồng real-time, không bị block thread bởi các HTTP call ra ngoài tới AI LLM.
*   **Scalability:** Tác vụ xử lý AI tốn nhiều tài nguyên hơn (memory/CPU). Khi lượng request AI tăng cao, có thể scale ngang riêng `ai-service` mà không làm phình to `chat-service`.

### 2.2. Công nghệ & Lựa Chọn Model
*   **Vị trí Service:** `backend/ai-service` (Spring Boot 3.2 + Spring AI / LangChain4j) chạy trên cụm CentOS 2GB RAM.
*   **Vị trí Model (Hybrid Deployment):** Cài đặt **Ollama** trực tiếp trên **máy vật lý** (Physical Machine/Host) của bạn để tận dụng cấu hình mạnh (CPU khỏe, nhiều RAM, hoặc có GPU). `ai-service` trên máy ảo sẽ gọi sang máy vật lý qua IP LAN. Việc này vừa **giải phóng hoàn toàn bộ nhớ cho cụm CentOS 2GB**, vừa loại bỏ Rate Limit của các API ngoài (miễn phí 100%), và giữ dữ liệu an toàn.
*   **Vector Database:** Cài đặt **ChromaDB** chạy chung trên máy vật lý (để tránh ăn RAM của máy ảo). Sử dụng local embedding model (ví dụ: `nomic-embed-text` qua Ollama) để chuyển hóa tài liệu thành vector.

### 2.3. Sơ Đồ Giao Tiếp Mới

```mermaid
graph TD
    subgraph CentOS VM Cluster (Microservices - 2GB RAM)
        GW[API Gateway] --> AI[AI Service]
        GW --> CHAT[Chat Service]
        CHAT -->|chat-messages| KAFKA[(Kafka)]
        KAFKA -->|consume (hybrid filter)| AI
        AI -->|priority event| KAFKA_NOTI[(Kafka: notifications)]
    end
    
    subgraph Physical Machine (Heavy Lifting)
        AI -->|REST API qua IP LAN :11434| OLLAMA((Ollama Host))
        OLLAMA -->|Qwen2 / Llama3| LOCAL_LLM
        AI <-->|REST API| VDB[(Vector Database: ChromaDB)]
    end
```

---

## 3. Lộ Trình Triển Khai (Roadmap)

### Phase 1: Nền tảng Hybrid AI & Vector DB (Foundation) - *Tuần 1*
1.  **Hạ tầng Máy vật lý:** Tải và cài đặt trực tiếp **Ollama** và Docker (để chạy **ChromaDB**) trên máy tính vật lý của bạn. Đảm bảo mở port `11434` (Ollama) và port của ChromaDB trên tường lửa máy vật lý.
2.  **Pull Models:** Trên máy vật lý, mở terminal chạy: `ollama run qwen2:7b` (cho text) và `ollama pull nomic-embed-text` (cho embedding).
3.  **Service (Cụm Máy ảo):** Khởi tạo dự án `backend/ai-service` với Spring Boot. Trong `application.yml`, cấu hình URL của Ollama trỏ về IP LAN của máy vật lý (VD: `http://192.168.1.x:11434`).
4.  **Gateway:** Đăng ký định tuyến `/api/v1/ai/**` tại API Gateway trỏ về `ai-service`.
5.  **Data Pipeline & Webhook:**
    *   Viết kịch bản parse tài liệu quy chế, tạo Embeddings qua local model `nomic-embed-text`, và lưu vào ChromaDB (khởi tạo ban đầu).
    *   Thiết kế thêm một **Webhook API** (vd: `POST /api/v1/ai/knowledge/update`) để Admin có thể kích hoạt tiến trình xóa/cập nhật lại vector khi có quy chế học vụ mới, đảm bảo RAG không bị lỗi thời.

### Phase 2: Ra mắt Trợ lý ảo AI (Smart Chatbot - RAG) - *Tuần 2*
1.  **Backend (`ai-service`):**
    *   Tạo account hệ thống `id = "ai-bot"`.
    *   Tạo endpoint `/api/v1/ai/ask`.
    *   **Luồng RAG:** Khi có câu hỏi -> Tạo embedding cho câu hỏi (qua Ollama) -> Search top 3 documents liên quan nhất từ ChromaDB -> Đẩy context này kèm câu hỏi vào prompt của Ollama (Qwen2) -> Trả về kết quả.
2.  **Frontend:**
    *   [x] Thêm contact "IUH Assistant" mặc định.
    *   [x] Giao diện chat gọi trực tiếp REST API `ask` khi nhắn với Bot.

### Phase 3: Tính năng Tóm Tắt & Tối ưu Token (Intelligent Analysis) - *Hoàn thành*
1.  **Backend (`ai-service`):**
    *   [x] Tạo API `/api/v1/ai/summarize/{conversationId}`.
    *   [x] Tối ưu Token: Gọi chat-service, lấy 50 tin nhắn và format cứng thành `[Thời gian] - Tên: Nội dung`.
2.  **Frontend:**
    *   [x] Thêm nút "AI Tóm tắt" trên Header nhóm chat. Hiển thị kết quả trong Bottom Sheet/Modal.

### Phase 4: Phân loại Thông báo Hybrid (Rule-based + AI) - *Hoàn thành*
Việc đẩy toàn bộ tin nhắn qua AI là không khả thi và gây quá tải. Thay vào đó, áp dụng cơ chế lọc 2 lớp:
1.  **Bước 1 - Lọc Cứng (Rule-based Filter):**
    *   [x] Phân tách Consumer Group: Cấu hình Kafka Consumer của `ai-service` thuộc về nhóm `ai-triage-group`.
    *   [x] Lọc từ khóa: Dài > 20 từ, hoặc chứa các từ khóa (`deadline`, `thông báo`, `nghỉ học`, `đổi phòng`), hoặc có tag `@all`. Drop tin nhắn ngắn/spam.
2.  **Bước 2 - AI Đánh Giá (AI Triage):**
    *   [x] Những tin vượt qua Bước 1 mới được gửi lên Ollama bằng prompt Zero-shot để gán nhãn độ khẩn cấp (HIGH / LOW).
    *   [x] Ghi Log gán cờ mức độ quan trọng.

---

## 4. Các Rủi Ro & Khắc Phục Khác (Risks & Mitigations)
1.  **Mất kết nối mạng LAN (Risk of Blocked Threads):** Vì máy ảo gọi sang máy vật lý qua IP LAN, nếu máy vật lý tắt hoặc rớt mạng, các thread của `ai-service` có thể bị treo khi chờ phản hồi.
    *   *Khắc phục:* Bắt buộc áp dụng **Circuit Breaker (Resilience4j)** cho các HTTP Call đến cổng `11434`. Nếu phát hiện IP LAN không kết nối được hoặc timeout, Circuit Breaker sẽ ngắt mạch (Open state) và lập tức trả về Fallback mềm ("AI đang bảo trì") thay vì bắt thread chờ đợi.
2.  **Độ trễ (Latency):** Tuy dùng máy vật lý nhanh hơn máy ảo, nhưng Local LLM vẫn tốn vài giây xử lý.
    *   *Khắc phục:* Frontend bắt buộc phải hiện hiệu ứng "Bot đang gõ...". Backend cấu hình trả về dạng stream (Server-Sent Events) để bot hiện từng chữ.

## 5. Bước Tiếp Theo
Với kiến trúc **Hybrid Deployment** này, hệ thống của bạn sẽ nhẹ gánh, chạy mượt trên CentOS 2GB, lại vẫn sỡ hữu siêu AI miễn phí, bảo mật. Bạn có thể bắt đầu bằng việc **cài đặt Ollama lên máy tính cá nhân và chạy lệnh `ollama run qwen2:7b`** để xem thử tốc độ xử lý trên máy mình nhé!
