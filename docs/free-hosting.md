# VibeLog: máy chủ miễn phí và kết nối Google lâu dài

## Chi phí và giới hạn

Phương án là **Render Web Service Free + Neon PostgreSQL Free**. Chỉ chọn Free, không nâng cấp hay tạo Render Postgres tính phí. Hạn mức và điều khoản có thể thay đổi; xem [Render Free](https://render.com/docs/free) và [Neon Pricing](https://neon.com/pricing) trước khi tạo tài khoản/dịch vụ.

Render Free ngủ sau 15 phút không có truy cập. Lần mở đầu sau khi ngủ có thể phải chờ máy chủ thức dậy. Render có hạn mức giờ chạy, băng thông và build; tài khoản có thanh toán có thể chịu phí vượt một số hạn mức theo điều khoản. Chọn cấu hình chi tiêu để tránh vượt ngân sách, không coi đây là bảo đảm miễn phí ở mọi mức lưu lượng.

Neon Free hiện không giới hạn thời gian và không cần thẻ; database có giới hạn compute, lưu trữ và truyền dữ liệu. Nó có thể ngủ nhưng dữ liệu được giữ. Render Free không có ổ đĩa bền vững và Render Postgres Free hết hạn sau 30 ngày, nên bản này dùng Neon để lưu phiên.

## Mã nguồn đã chuẩn bị

- `render.yaml`: một web service gói `free`, chạy Node.js 24, tự cài dependency và chạy `npm start`. Không tạo database trả phí hoặc persistent disk.
- `scripts/server.mjs`: phục vụ giao diện và API cùng domain, lắng nghe `0.0.0.0` ở production, dùng cổng Render cung cấp. Lấy URL công khai từ `RENDER_EXTERNAL_URL` nếu chưa đặt `APP_URL`; không đoán domain theo tên service. `/healthz` cho Render kiểm tra tiến trình đang hoạt động.
- `scripts/postgres-session-store.mjs`: tạo bảng `vibelog_sessions`; lưu access token, refresh token và dữ liệu phiên dưới dạng AES-256-GCM được mã hóa, gắn với ID phiên. Kết nối PostgreSQL dùng TLS kiểm tra chứng chỉ. Cookie thật không lưu vào database; ID lưu là hash cookie.
- `scripts/google-auth.mjs`: chờ database hoàn tất trước khi phản hồi; kiểm tra phiên khi gia hạn. Cập nhật có điều kiện ngăn yêu cầu gia hạn đang chạy khôi phục phiên đã bị ngắt. Lỗi database không tự chuyển sang ổ đĩa tạm và làm mất phiên.
- `SESSION_ENCRYPTION_KEY`: khóa mã hóa riêng, Render tạo một lần và giữ qua các deploy. Không đổi/xóa khóa tùy ý: đổi khóa làm phiên cũ không đọc được. Không chuyển khóa local hoặc token local lên cloud; đăng nhập lại một lần trên domain mới.
- `package-lock.json` và CI: cài dependency đúng phiên bản, kiểm thử cả luồng local và kho PostgreSQL mô phỏng. Chưa thay thế kiểm tra deployment với database thật.

## Tạo và triển khai

Nếu đã kết nối Render và Neon trong Codex, agent có thể tiếp tục tạo tài nguyên bằng kết nối đó. Nếu chưa, có thể làm trên dashboard theo các bước dưới. Không gửi Client Secret, database password hay khóa mã hóa trong chat.

1. Tạo tài khoản/project **Neon Free**. Chọn region gần Render, tạo database cho VibeLog. Sao chép connection string PostgreSQL ở **Connect** (có thể dùng pooled connection).
2. Đảm bảo bản mã nguồn có `render.yaml` đã lên `main`.
3. Đăng nhập [Render](https://dashboard.render.com), chọn **New → Blueprint**, kết nối repository `BaoKhanh0230/LearnToVibe`, nhánh `main`, file `render.yaml`. Kiểm tra chỉ có web service gói **Free**.
4. Nhập biến bí mật trực tiếp trong Render:

   | Biến | Giá trị / ý nghĩa |
   |---|---|
   | `DATABASE_URL` | Connection string của Neon; không đưa vào Git |
   | `GOOGLE_CLIENT_ID` | OAuth client loại Web application đang dùng |
   | `GOOGLE_CLIENT_SECRET` | Secret của đúng OAuth client, lấy từ Google Cloud |
   | `SESSION_ENCRYPTION_KEY` | Blueprint tự tạo khóa base64 32 byte; giữ nguyên |

5. Deploy rồi lấy **URL thực tế** Render cấp. App tự dùng URL này làm origin; nếu dùng domain riêng, đặt `APP_URL=https://domain-cua-ban` và deploy lại. URL không kèm đường dẫn hay dấu `/` cuối.
6. Trong Google Cloud → **Google Auth Platform → Clients**, mở đúng OAuth client, thêm `https://domain-thuc-te/api/auth/callback` vào **Authorized redirect URIs**. Thêm origin mới vào Authorized JavaScript origins nếu muốn giữ cấu hình browser; giữ origin GitHub Pages và callback localhost cho các bản cũ.
7. Trong **Audience**, dùng External và Test users nếu đang Testing. Kết nối lâu dài vẫn chịu giới hạn Google: refresh token của ứng dụng Testing với Calendar thường hết hạn sau 7 ngày. Khi công khai, chuyển In production và hoàn tất xét duyệt Google nếu yêu cầu. [Google OAuth expiration](https://developers.google.com/identity/protocols/oauth2#expiration).
8. Mở **URL Render mới**, kết nối Google một lần. Refresh trang và kiểm tra lịch tự tải. Trigger deploy/restart từ Render, mở lại trên cùng trình duyệt để kiểm tra phiên còn. Dùng một trình duyệt khác để kiểm tra người dùng riêng, gửi lịch thử và ngắt kết nối.

## Điều xảy ra khi đăng nhập và refresh

1. Người dùng chọn Google và đồng ý quyền Calendar.
2. Google trả mã một lần về callback trên máy chủ. Máy chủ đổi mã thành access token và refresh token.
3. Máy chủ mã hóa dữ liệu và lưu ở Neon; trình duyệt nhận cookie HttpOnly, Secure, SameSite=Lax. JavaScript trong trang không đọc được cookie này.
4. Refresh trang gửi cookie về cùng máy chủ. Máy chủ tìm phiên trong Neon và tải lịch; nếu access token hết hạn, dùng refresh token lấy token mới.
5. Render restart hoặc deploy lại không xóa dữ liệu ở Neon. Khi Google thu hồi quyền, người dùng ngắt kết nối, xóa cookie hoặc cookie hết hạn, cần kết nối lại.

Cookie hiện có thời hạn 180 ngày; đó không phải bảo đảm Google cho phép truy cập đủ 180 ngày. Nếu máy chủ restart ngay trong quá trình đang cấp quyền (trước callback), nhấn kết nối lại; trạng thái OAuth đang chờ được giữ trong bộ nhớ một tiến trình. Cấu hình này dùng một web service, chưa phải giải pháp mở rộng nhiều tiến trình.

## Chuyển website và dữ liệu học

Sau deployment này, dùng **URL Render** để có kết nối lâu dài. URL GitHub Pages vẫn là bản tĩnh và vẫn cần kết nối lại khi refresh. Không có sự thay đổi tự động của domain GitHub Pages sang Render.

Nhật ký/kế hoạch đang lưu bằng localStorage theo origin. Domain Render mới sẽ không tự nhìn thấy nhật ký/kế hoạch ở GitHub Pages. Trước khi chuyển, tải bản JSON sao lưu nhật ký từ trang cũ; bản sao lưu hiện chưa gồm kế hoạch học và app chưa có luồng nhập lại bản sao lưu. Giữ trang cũ để tra cứu, hoặc bổ sung tính năng chuyển dữ liệu ở bước riêng. Sự kiện đã gửi lên Google vẫn nằm trong tài khoản Google và sẽ hiển thị ở lịch tuần sau khi kết nối.

Kết nối Google ở local không được sao chép lên cloud. Không cần xóa hoặc thay đổi `.env` hay `.vibelog-data` trên máy cá nhân.
