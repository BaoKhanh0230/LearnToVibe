# Học Docker qua VibeLog — 02/11/2026

## Mục tiêu và lộ trình

Học từng chặng, thực hành và giải thích lại được trước khi chuyển tiếp. Thời lượng dưới đây chỉ để tham khảo.

| Chặng | Thực hành | Kết quả cần hiểu |
| --- | --- | --- |
| 1 · 20–30 phút | Chạy website có sẵn, xem log, dừng/chạy lại container | Docker, image, container, port |
| 2 · 30–45 phút | Viết Dockerfile cho VibeLog Node.js 24, build và chạy local | Dockerfile → image → container; rebuild khi đổi code |
| 3 · 30–45 phút | Cấu hình local riêng, thử lưu dữ liệu qua volume | Biến môi trường, bind mount, volume; dữ liệu tồn tại ở đâu |
| 4 · 45–60 phút | Dùng Compose chạy ứng dụng và PostgreSQL thử nghiệm riêng | Service, network, hostname database, một lệnh khởi động nhiều dịch vụ |

Không cần học Kubernetes ở giai đoạn này. Docker chạy ứng dụng; việc xuất bản lên mạng vẫn cần máy chủ hoặc nền tảng hosting phù hợp.

## Docker giải quyết vấn đề gì?

VibeLog cần Node.js và các thư viện npm. Nếu mỗi máy cài phiên bản khác nhau, ứng dụng có thể chạy khác nhau. Docker giúp đóng gói môi trường chạy để có thể tạo lại nhất quán trên các máy tương thích.

- **Image:** gói mẫu chứa runtime, thư viện và file ứng dụng. Có thể tạo nhiều container từ cùng image.
- **Container:** tiến trình chạy trong môi trường được cô lập, tạo từ image; có thể chạy, dừng, khởi động lại và xóa.
- **Dockerfile:** file mô tả các bước tạo image của ứng dụng.
- **Docker Engine:** bộ máy tạo và quản lý container. Lệnh `docker` gửi yêu cầu cho Engine.
- **Docker Desktop:** ứng dụng giúp vận hành Docker trên máy cá nhân; trên Windows thường dùng WSL 2 để chạy Linux container.

Container không mang một hệ điều hành đầy đủ với kernel riêng như máy ảo. Linux container trên Windows dùng kernel Linux do môi trường máy ảo/WSL cung cấp. Image cần phù hợp với hệ điều hành và kiến trúc chạy.

## Bài 1 — Chạy website đầu tiên

Mở Docker Desktop, chờ Engine sẵn sàng. Trong PowerShell:

```powershell
docker --version
docker info
```

`docker --version` chỉ xác nhận đã có công cụ dòng lệnh. `docker info` kết nối được phần Server mới xác nhận Engine hoạt động. Lỗi pipe `dockerDesktopLinuxEngine` thường gặp khi Engine chưa sẵn sàng; cần kiểm tra Docker Desktop để biết nguyên nhân cụ thể.

Chạy lần đầu (nếu trợ giảng đã chạy và container đã tồn tại, dùng `docker start docker-bai-1`):

```powershell
docker run -d --name docker-bai-1 -p 127.0.0.1:8080:80 docker/welcome-to-docker
```

Lần đầu Docker tải image từ registry nên cần mạng. Sau đó mở <http://localhost:8080>.

| Thành phần | Ý nghĩa |
| --- | --- |
| `docker run` | Tạo container mới từ image rồi khởi chạy |
| `-d` | Chạy nền, trả terminal lại cho bạn |
| `--name docker-bai-1` | Đặt tên để thao tác dễ nhớ |
| `-p 127.0.0.1:8080:80` | Chuyển cổng 8080 trên máy vào cổng 80 của container, chỉ nhận kết nối trên máy này |
| `docker/welcome-to-docker` | Tên image; khi không ghi tag thì dùng `latest` |

Thử từng lệnh, quan sát trước khi chạy lệnh tiếp:

```powershell
docker ps
docker image ls
docker logs --tail 20 docker-bai-1
docker stop docker-bai-1
```

Tải lại trang sau khi dừng: trang sẽ không truy cập được. Nếu trình duyệt vẫn hiện nội dung cũ, thử tải lại bỏ cache. Tiếp tục:

```powershell
docker ps -a
docker start docker-bai-1
```

Tải lại trang: website hoạt động trở lại. `docker ps` chỉ hiện container đang chạy; `docker ps -a` hiện cả container đã dừng. `start` dùng container có sẵn; `run` tạo container mới nên không dùng lại cùng tên khi tên đó vẫn tồn tại.

Khi muốn kết thúc và xóa riêng container bài này:

```powershell
docker stop docker-bai-1
docker rm docker-bai-1
```

Image vẫn còn và có thể dùng để tạo container khác. Không cần chạy lệnh dọn toàn bộ Docker.

## Tự kiểm tra trước bài 2

1. Image và container khác nhau thế nào?
2. Với `-p 127.0.0.1:8081:80`, trình duyệt cần mở địa chỉ nào?
3. Sau `docker stop`, nên dùng `start` hay `run` để chạy lại chính container đó?

## Chuẩn bị cho bài VibeLog

VibeLog hiện chạy bằng `npm start`, dùng Node.js 24 trở lên. Khi đóng gói, cần để server lắng nghe `0.0.0.0` trong container và ánh xạ cổng ra máy. Tạo `.dockerignore` để bỏ `.env*`, `node_modules`, `.git`, `.vibelog-data` và cấu hình công cụ cá nhân khỏi build context; không chép secret vào image. Dùng cấu hình local riêng và volume riêng cho bài học. Chặng database dùng dữ liệu giả trong PostgreSQL local riêng.

Các chặng tiếp theo đã được chuẩn bị và kiểm chứng ở local; xem [bài thực hành Docker 2–4](docker-practice.md) để tự chạy và tìm hiểu từng file. Cấu hình Docker dành cho bài học local, chưa bật Google OAuth.

## Nguồn chính thức

- [Container là gì?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/)
- [Image là gì?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/)
- [Docker Desktop trên Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
