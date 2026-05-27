# Kế hoạch Triển khai High-Availability (HA) Docker Swarm cho IUH Connect

Tài liệu này vạch ra lộ trình các bước cần thiết để đưa hệ thống IUH Connect từ môi trường Local Development (docker-compose hiện tại) lên môi trường triển khai thực tế (Production/Staging) bằng mô hình Docker Swarm 3 Node.

## Giai đoạn 1: Chuẩn bị Hạ tầng & Cấu hình Docker Swarm (Infrastructure Setup)
Mục tiêu thiết lập 3 máy ảo (VM) Linux, đảm bảo giao tiếp mạng nội bộ và khởi tạo cụm Swarm.

*   **Bước 1.1: Khởi tạo 3 VM & Cài đặt Docker**
    *   Tạo 3 VM (Ubuntu 22.04 hoặc CentOS): `master01`, `worker01`, `worker02`.
    *   Cài đặt Docker Engine trên cả 3 máy.
    *   Cấu hình Firewall/Security Group mở các cổng cho Swarm: `2377` (Cluster management), `7946` TCP/UDP (Node communication), `4789` UDP (Overlay network).
*   **Bước 1.2: Khởi tạo Cụm Swarm**
    *   Tại `master01`: Chạy `docker swarm init --advertise-addr <IP_NỘI_BỘ_MASTER>`.
    *   Lấy token Worker và chạy lệnh join trên `worker01` và `worker02`.
*   **Bước 1.3: Đánh nhãn Node (Node Labeling)**
    *   Áp dụng các nhãn để Docker biết nơi lập lịch (schedule) các container theo đúng thiết kế C4:
        *   `docker node update --label-add role=entrypoint master01`
        *   `docker node update --label-add role=core-worker worker01`
        *   `docker node update --label-add role=bg-worker worker02`

## Giai đoạn 2: Chuẩn bị Cấu hình Triển khai (Configuration Preparation)
Môi trường Swarm không sử dụng `docker-compose.yml` thông thường mà sử dụng `docker-stack.yml` kết hợp mạng Overlay và Load Balancer mới.

*   **Bước 2.1: Bổ sung Nginx Load Balancer**
    *   Tạo thư mục `nginx/` và cấu hình `nginx.conf` cơ bản đóng vai trò Reverse Proxy. Nginx sẽ đứng ra nhận request tại port `80`/`443` và điều hướng vào Service Name nội bộ của Swarm (ví dụ `api-gateway:8080`).
*   **Bước 2.2: Soạn thảo file `docker-stack.yml`**
    *   Chuyển đổi từ `docker-compose.yml` hiện tại sang chuẩn Swarm.
    *   **Network:** Đổi network từ `bridge` sang `overlay` để kết nối liên Node.
    *   **Placement Constraints:** Áp dụng ràng buộc vị trí chạy container dựa theo Label ở Bước 1.3.
        *   *Ví dụ:* `mariadb`, `redis`, `auth-service`, `chat-service` được đặt `placement.constraints: [node.labels.role == core-worker]`
        *   `mongodb`, `kafka`, `zookeeper`, `presence`, `notification` được đặt `placement.constraints: [node.labels.role == bg-worker]`
        *   `nginx`, `api-gateway` được đặt `placement.constraints: [node.labels.role == entrypoint]`
    *   **Resource Limits:** Thiết lập RAM tối đa (`deploy.resources.limits.memory`) cho các container nặng như Kafka, MongoDB, Spring Boot để tránh OOM (Out Of Memory).
*   **Bước 2.3: Xử lý Volumes (Dữ liệu cố định)**
    *   Mặc định volume nội bộ máy ảo sẽ không thể di chuyển theo Container sang máy khác. Vì đã có ràng buộc vị trí (Placement) trên từng node nhất định, việc map local volume theo từng node là chấp nhận được ở mức HA cơ bản.

## Giai đoạn 3: Đóng gói và Phân phối Image (Image Build & Registry)
Swarm cần kéo Docker Image từ một nguồn chung chứ không build local.

*   **Bước 3.1: Viết script Build Images**
    *   Tạo một shell script (ví dụ `build_and_push.sh`) để tự động `docker build` cho tất cả 5 backend services: `api-gateway`, `auth-service`, `chat-service`, `presence-service`, `notification-service`.
*   **Bước 3.2: Đẩy lên Docker Registry**
    *   Tạo account trên Docker Hub (hoặc set up một Local Registry riêng).
    *   Cập nhật `docker-stack.yml` để sử dụng đường dẫn Image từ Registry (ví dụ: `your_docker_id/iuh-auth-service:latest`).

## Giai đoạn 4: Triển khai và Kiểm thử (Deployment & Validation)

*   **Bước 4.1: Khởi chạy hệ thống**
    *   Copy thư mục dự án (chứa `docker-stack.yml` và cấu hình Nginx) lên máy `master01`.
    *   Tại `master01`, chạy lệnh: `docker stack deploy -c docker-stack.yml iuh-connect`
*   **Bước 4.2: Giám sát trạng thái**
    *   Chạy `docker service ls` để đảm bảo số lượng replicas đạt trạng thái `1/1`.
    *   Kiểm tra vị trí chạy của các service bằng `docker stack ps iuh-connect` để chắc chắn chúng nằm đúng máy Worker như chỉ định.
*   **Bước 4.3: Kiểm thử toàn diện**
    *   Mở trình duyệt truy cập vào IP Public của `master01` (Nginx), gọi thử các Endpoint API để kiểm tra luồng định tuyến (Routing).
    *   Thử ngắt dịch vụ và xem cơ chế tự phục hồi của Docker Swarm.

---
**Công việc cần làm ngay tiếp theo trong workspace:**
1. Tạo thư mục `deploy/` để chứa các file triển khai.
2. Viết file `docker-stack.yml` chuẩn Swarm Mode.
3. Viết script `deploy.sh` hỗ trợ quá trình build/push/deploy.
4. Cấu hình Nginx (`nginx.conf`).
