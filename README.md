# VibeLog

VibeLog là nhật ký nhỏ dành cho hành trình học và vibe code. Bạn có thể ghi lại mình vừa làm gì, học trong bao lâu, cảm thấy thế nào và rút ra điều gì. Dữ liệu được lưu trong trình duyệt bằng `localStorage`.

Bạn cũng có thể sửa, tìm kiếm và lọc các phiên học đã ghi. Hình Doro trong thư mục `image` được dùng làm favicon và biểu tượng của dự án.

VibeLog còn hỗ trợ đặt mục tiêu số phút học mỗi tuần và tải toàn bộ nhật ký xuống file JSON để sao lưu.

Dashboard 7 ngày giúp nhìn nhanh tổng thời gian, trung bình, ngày tập trung nhất và chủ đề nổi bật. Mỗi phiên học có thể được phân loại theo chủ đề, gắn tối đa 8 tag và lọc lại trong nhật ký.

Biểu đồ tuần bắt đầu từ Thứ Hai. Giao diện hỗ trợ chế độ sáng/tối và chuyển màu mượt; lịch nhắc học có thể tùy chỉnh giờ cùng các ngày trong tuần khi VibeLog đang mở.

Trải nghiệm cuộn sử dụng Lenis trên desktop và GSAP ScrollTrigger cho page entrance, scroll reveal, parallax nhẹ, tiến độ cuộn và animation biểu đồ. Nếu hệ thống bật `prefers-reduced-motion`, các hiệu ứng nâng cao sẽ tự tắt.

Nút `〰` trên thanh điều hướng cho phép bật hoặc tắt chuyển động riêng trong VibeLog. Chuyển động được bật mặc định và lựa chọn của người dùng được lưu trong trình duyệt.

## CI/CD với GitHub Actions

Workflow tại `.github/workflows/ci-cd.yml` tự động chạy khi push hoặc mở pull request vào `main`:

1. Tải source code vào máy ảo Ubuntu của GitHub.
2. Cài đúng phiên bản Node.js.
3. Kiểm tra cú pháp JavaScript.
4. Chạy toàn bộ kiểm thử bằng `npm test`.
5. Nếu chạy trên `main`, kiểm thử đạt và repository variable `ENABLE_PAGES` là `true`, đóng gói website rồi triển khai lên GitHub Pages.

Để bật deployment, vào `Settings → Pages`, chọn nguồn `GitHub Actions`; sau đó vào `Settings → Secrets and variables → Actions → Variables`, tạo biến `ENABLE_PAGES` với giá trị `true`. Chạy lại workflow hoặc push một commit mới để xuất bản.

## Chạy dự án

Bạn cần cài Node.js. Trong thư mục dự án, chạy:

```powershell
npm start
```

Sau đó mở [http://localhost:4173](http://localhost:4173).

Chạy kiểm thử bằng:

```powershell
npm test
```

## Lộ trình học bằng dự án

### Chặng 1 — Nền móng (hiện tại)

- Hiểu vai trò của HTML, CSS và JavaScript.
- Tạo form, hiển thị danh sách và lưu dữ liệu trên trình duyệt.
- Khởi tạo Git, đọc thay đổi và tạo commit đầu tiên.

### Chặng 2 — Làm app hữu ích hơn

- Sửa một phiên học đã ghi.
- Tìm kiếm, lọc theo cảm giác và xem thống kê theo tuần.
- Học cách chia một yêu cầu thành các bước nhỏ và kiểm thử chúng.

### Chặng 3 — GitHub và đưa app lên mạng

- Tạo repository trên GitHub và đẩy code lên.
- Dùng branch, pull request và review thay đổi.
- Triển khai miễn phí bằng GitHub Pages.

### Chặng 4 — Chạm vào backend

- Hiểu API và cơ sở dữ liệu dùng để làm gì.
- Đồng bộ nhật ký giữa nhiều thiết bị.
- Thêm đăng nhập nếu thật sự cần.

## Cấu trúc thư mục

```text
VibeLog/
├── index.html          # Nội dung và cấu trúc trang
├── styles.css          # Màu sắc và bố cục
├── src/
│   ├── app.js          # Tương tác trên giao diện
│   └── store.js        # Lưu dữ liệu và tính thống kê
├── test/               # Kiểm thử tự động
└── scripts/server.mjs  # Web server nhỏ để chạy ở máy cá nhân
```

## Nguyên tắc học

1. Mỗi lần chỉ thay đổi một điều có thể mô tả trong một câu.
2. Trước khi nhờ AI sửa, hãy nói lại lỗi bằng lời của mình.
3. Luôn xem phần code thay đổi trước khi commit.
4. Commit là một mốc có ý nghĩa, không phải nút “save”.

