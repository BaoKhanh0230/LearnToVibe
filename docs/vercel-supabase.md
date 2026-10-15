# Chuyển VibeLog sang Vercel + Supabase

Vercel thay phần website/API của Render. Supabase PostgreSQL thay kho phiên của Neon. Việc đổi database đơn lẻ không giải quyết hàng đợi deploy của hosting. Không có nền tảng miễn phí nào bảo đảm mọi lần deploy đều tức thời.

## Tình trạng chuẩn bị ngày 15/10/2026

- Project Vercel đã tạo: `vibelog-baokhanh`, ID `prj_WP8kAr2WCctB4azJslBJCIfyLs2s`.
- Domain Vercel xác nhận: `vibelog-baokhanh.vercel.app`.
- Chưa deploy hoặc đổi website chính thức; chưa kiểm chứng runtime Vercel thật.
- Supabase organization do chủ tài khoản chọn: `BaoKhanh0230's Org`, ID `ehaiykbgwjygpxivmkgx`, plan Free.
- Chủ tài khoản đã tạo project `VibeLog`, ref `bpdigfubhbzeppknsfmd`, vùng Seoul (`ap-northeast-2`), trạng thái `ACTIVE_HEALTHY`. Giữ nguyên vùng đã chọn.
- Migration bảng phiên đã áp dụng: RLS bật, thu hồi quyền `anon`/`authenticated`.
- Biến production Vercel đã cấu hình: APP_URL, Google Client ID/Secret và khóa mã hóa phiên mới. Chủ tài khoản đã cho phép rõ chuyển các khóa sang Vercel. Chờ DATABASE_URL để kiểm tra runtime.
- Công cụ kiểm tra chi phí Supabase báo không khả dụng; project được chủ tài khoản tạo qua Dashboard.

## Thay đổi kỹ thuật

`api/index.js` dùng handler HTTP chung với máy chủ Node và khởi tạo kho PostgreSQL một lần trong mỗi tiến trình. Không dùng kho file trên filesystem tạm của serverless. Nếu khởi tạo thất bại, trả JSON 503 và cho phép yêu cầu sau thử lại.

OAuth state và PKCE verifier nay được mã hóa trong kho phiên, có hạn 10 phút, gắn với cookie trình duyệt và chỉ được tiêu thụ một lần bằng thao tác có điều kiện. Callback vẫn hoạt động khi được xử lý bởi tiến trình khác. Giới hạn 100 yêu cầu chờ trong RAM chỉ có hiệu lực từng tiến trình, không phải rate limit toàn hệ thống.

`vercel.json` chuyển `/api/*` và `/healthz` tới function, phục vụ tài nguyên công khai từ `_site`. Build không đóng gói `.env`, database, migration hay source máy chủ vào thư mục website. Handler hỗ trợ cả request body dạng stream và dạng đã được runtime phân tích.

`scripts/build-vercel.mjs` yêu cầu `APP_URL` HTTPS và cập nhật canonical, Open Graph URL, robots/sitemap trong artifact theo địa chỉ mới. Source Render/Pages giữ URL cũ đến khi thực sự chuyển website chính thức. Không coi việc chuẩn bị cấu hình là deploy thành công.

## Hoàn tất Supabase

1. Trong https://supabase.com/dashboard, tạo project VibeLog tại organization đã chọn, ưu tiên Singapore. Chọn cấu hình miễn phí; đọc chi phí Dashboard trước khi xác nhận. Lưu database password an toàn.
2. Chạy migration `supabase/migrations/20261015000000_sessions.sql` trước khi bật app. Bảng chứa phiên Google mã hóa, bật RLS và thu hồi quyền `anon`/`authenticated`; không cho frontend đọc dữ liệu này.
3. Trong **Connect**, lấy connection string **Transaction pooler**, cổng `6543`, cho runtime serverless. Database role phía server phải có quyền bảng. Không đưa connection string vào source, chat hoặc frontend.
4. Lấy CA certificate tại Database Settings/SSL. App hỗ trợ biến `DATABASE_CA_CERT` chứa PEM, có thể dùng ký tự `\n` thay xuống dòng. Không tắt xác minh chứng chỉ để chữa lỗi kết nối.
5. Cấu hình biến môi trường production Vercel: `APP_URL=https://vibelog-baokhanh.vercel.app`, `DATABASE_URL`, `DATABASE_CA_CERT` nếu cần, `SESSION_ENCRYPTION_KEY` (khóa 32 byte base64), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Các giá trị nhạy cảm chỉ lưu phía server. Không dùng khóa/mật khẩu trong ví dụ.

## Google và dữ liệu khi đổi địa chỉ

Trong OAuth client hiện tại, thêm redirect URI chính xác:

`https://vibelog-baokhanh.vercel.app/api/auth/callback`

Không cần thay toàn bộ cơ chế đăng nhập sang Supabase Auth: kết nối Google Calendar hiện tại vẫn dùng OAuth máy chủ và refresh token được mã hóa. Giữ callback Render trong thời gian chuyển đổi.

Cookie thuộc từng domain. Không chuyển cookie Render sang Vercel; người dùng cần kết nối Google lại. Không tự động sao chép refresh token từ Neon sang Supabase. Nhật ký/kế hoạch localStorage cũng thuộc từng origin: xuất JSON từ website cũ để giữ bản sao trước khi chuyển. Chức năng xuất JSON hiện là sao lưu, không đồng nghĩa đã có tính năng nhập dữ liệu tự động.

## Kiểm chứng trước khi chuyển website chính thức

- Kiểm thử local và CI đạt; artifact công khai không chứa secrets.
- Deploy Vercel trạng thái READY và URL công khai truy cập được khi chưa đăng nhập Vercel.
- Trang chủ, robots/sitemap đúng URL mới; đường dẫn giả trả 404, file riêng không tải được.
- Auth status trả JSON; Calendar chưa đăng nhập trả 401; cookie Secure/HttpOnly/SameSite và PKCE vẫn đúng.
- Kiểm tra database thật: TLS, mã hóa, đọc/ghi, thay thế/xóa có điều kiện và tồn tại qua kết nối mới, chỉ dùng dữ liệu giả.
- Chủ tài khoản kiểm tra Google consent, tải lịch, tạo/cập nhật một sự kiện thử và refresh trang. Smoke test không chứng minh đủ các bước browser này.
- Sau khi bản mới hoạt động, cập nhật địa chỉ chính thức, khai báo property URL prefix mới trong Search Console và lấy thẻ xác minh cho URL mới. Không mặc định thẻ của property Render xác minh được property Vercel.
- Giữ Render/Neon để đối chiếu cho đến khi nghiệm thu. Không xóa phiên hoặc dịch vụ cũ chỉ để thử migration.

## Giới hạn và lựa chọn khác

Vercel Hobby dành cho cá nhân/phi thương mại, có hạn mức functions. Supabase Free có thể pause sau giai đoạn ít hoạt động. Railway gần cách chạy Node hiện tại nhưng cần cân nhắc hạn mức credit và chi phí. Cloudflare Workers hỗ trợ static assets và API, cần điều chỉnh runtime/kết nối.

Nguồn: https://vercel.com/docs/plans/hobby ; https://supabase.com/docs/guides/platform/free-project-pausing ; https://supabase.com/docs/guides/database/connecting-to-postgres ; https://docs.railway.com/pricing/free-trial ; https://developers.cloudflare.com/workers/static-assets/
