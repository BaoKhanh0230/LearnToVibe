# Deployment VibeLog — 14/10/2026

## Tài nguyên đã tạo

- Website Node.js: https://vibelog-baokhanh.onrender.com
- Render: `vibelog-baokhanh`, service `srv-db7es03bc2fs73eurmt0`, workspace My Workspace, region Singapore, **plan Free**, 1 instance.
- Dashboard: https://dashboard.render.com/web/srv-db7es03bc2fs73eurmt0
- Neon: project `vibelog`, ID `floral-tooth-79757222`, organization Hoang Bao (**Free**), region `aws-ap-southeast-1`.
- PostgreSQL 17, database `vibelog`, main branch `br-spring-firefly-azmf224d`.
- Test branch: `deployment-tests`, `br-billowing-wind-azpuocov`. Giữ nhánh để kiểm thử lần sau; không chứa token Google thật hoặc dữ liệu người dùng. Các phiên giả do bài kiểm thử tạo được xóa sau khi chạy. Compute test `ep-delicate-waterfall-azaqv3xn` đã được tắt sau kiểm thử để tránh tiêu thụ hạn mức khi không dùng; bật lại trước khi chạy bài test database.
- Commit ứng dụng ban đầu được deploy: `dac7e3b764c8a621c07ca4cb37b391d8e101c876`, đã đạt CI.
- Initial deploy `dep-db7es0rbc2fs73eursqg` có trạng thái `live`.

## Cấu hình

Máy chủ dùng Client ID/Client Secret Google đang cấu hình tại local, đưa trực tiếp vào biến môi trường Render, không thêm vào Git. Khóa AES mới riêng cho cloud được tạo và lưu ở Render; khóa local không bị thay thế. DATABASE_URL ở Render trỏ tới nhánh main của Neon; không đưa vào frontend. App lấy URL từ `RENDER_EXTERNAL_URL`.

Render dùng `npm ci --omit=dev`, `npm start`, Node.js 24.14.1, `NODE_ENV=production`, `LISTEN_HOST=0.0.0.0`. Free service không có persistent disk; phiên nằm trong Neon. Chỉ tạo Free service, không tạo Render database hoặc dịch vụ trả phí. Tính phí pipeline/băng thông vẫn theo điều khoản nhà cung cấp.

Auto-deploy Render hiện **tắt**. Chỉ deploy commit đã đạt CI bằng Dashboard hoặc công cụ Render; tránh deploy trực tiếp một push chưa qua kiểm thử. GitHub Pages vẫn tự deploy theo workflow hiện có. Dịch vụ được tạo bằng công cụ trực tiếp nên chưa gắn vào Blueprint `render.yaml`; thay đổi file đó không tự cấu hình lại dịch vụ đang chạy. Health check path riêng `/healthz` tồn tại trong app; công cụ tạo service không cho đặt health check path và Render service hiện chưa cấu hình đường dẫn đó.

## Kiểm chứng đã đạt

1. 60 unit/integration test; test Google dùng mock, PostgreSQL mô phỏng.
2. `npm audit --omit=dev --audit-level=high`: 0 lỗ hổng đã biết tại thời điểm rà soát.
3. `scripts/verify-cloud-sessions.mjs` chạy trên Neon thật: TLS, mã hóa, đọc đúng phiên, không thấy phiên khác, đọc lại sau đóng/mở connection pool, chống ghi đè phiên mới và không khôi phục phiên đã ngắt. Bài này kiểm tra persistence qua kết nối mới, không thay thế bài browser giữ cookie qua restart Render.
4. `scripts/verify-deployment.mjs` chạy trên URL Render thật: root/health 200, auth status là JSON, cấu hình callback đúng, cookie OAuth HttpOnly/Secure/SameSite, PKCE S256, offline access, lịch chưa đăng nhập 401, Origin lạ 403, file bí mật/server/Git 404.
5. Log Render mức error sau startup không có bản ghi tại thời điểm kiểm tra. Không có nghĩa mọi lỗi tương lai sẽ được phát hiện tự động.

## Google và nghiệm thu trình duyệt

Callback đã được chủ tài khoản xác nhận thêm vào Authorized redirect URIs:

`https://vibelog-baokhanh.onrender.com/api/auth/callback`

Chủ tài khoản đã xác nhận đăng nhập và refresh trang đều thành công trên URL Render. Tạo/cập nhật một buổi học thử và ngắt kết nối trên browser chưa được xác nhận trong lượt triển khai này. Không coi một health check 200 là bằng chứng cho các bước này. Khi Google Auth còn Testing, hạn refresh token Calendar vẫn áp dụng; xem hướng dẫn [free-hosting.md](free-hosting.md).

## Chạy lại kiểm thử

```powershell
node scripts/verify-deployment.mjs https://vibelog-baokhanh.onrender.com
```

Với bài database, tạo file `.env.cloud-test` (đã bị Git ignore) có `TEST_DATABASE_URL` của **nhánh test**, rồi chạy:

```powershell
node --env-file=.env.cloud-test scripts/verify-cloud-sessions.mjs
```

Không dán connection string vào Git/chat; xóa file tạm sau kiểm thử nếu không cần. Không thay TEST_DATABASE_URL bằng database production. Không thu hồi/xóa phiên người dùng để thử nghiệm.

Nhật ký/kế hoạch localStorage trên GitHub Pages không tự chuyển sang origin Render. Sự kiện trên Google vẫn giữ nguyên. Bản Pages vẫn có thể dùng riêng, nhưng không có phiên máy chủ lâu dài.
