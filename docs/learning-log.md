# Nhật ký học tập và tiến độ VibeLog

Đây là trang trung tâm để tiếp tục project ở những buổi học sau. Cập nhật gần nhất: **19/10/2026**, múi giờ Asia/Bangkok.

## Buổi 19/10/2026 — Từ dữ liệu trình duyệt sang dữ liệu tài khoản

- Đã bổ sung nhận diện Google bằng `sub`, ID ổn định, lưu nhật ký/kế hoạch/mục tiêu/nhắc học theo tài khoản, đồng bộ có version và nhập local có xác nhận.
- Đánh giá Supabase Auth và giữ luồng Google OAuth máy chủ đã có: Supabase tiếp tục là PostgreSQL, không có `auth.users` hay khóa service_role ở frontend.
- Đã tạo bảng `vibelog_user_data` với role NOLOGIN/NOBYPASSRLS, FORCE RLS, policy chủ sở hữu và chặn Data API. Kiểm thử RLS thật bằng dữ liệu giả trong transaction rollback đạt; security advisor không có lỗi bảng mới.
- Ngắt Calendar giữ tài khoản/nhật ký; đăng xuất xóa phiên thiết bị. Gia hạn quyền lịch thất bại không xóa dữ liệu học.
- 85 bài kiểm thử tự động đạt; build Pages/production đạt, audit production cuối buổi 0 lỗ hổng. Đã commit/push GitHub; kết quả phát hành ở phần bên dưới.
- Chủ tài khoản xác nhận đổi mạng giúp kiểm tra cổng Supabase thành công sau lỗi timeout khi chạy local.
- Đã chuyển tài khoản lên thanh điều hướng, thêm menu avatar, hồ sơ (tên/avatar có sẵn) lưu theo tài khoản, sao lưu toàn bộ và cảnh báo đồng bộ ngoài menu. Không thay schema database.
- Chrome desktop/mobile đã kiểm tra menu, bàn phím, chỉnh hồ sơ qua API, tải lại trong context mới, tách tài khoản B, sao lưu và đăng xuất. Test dùng phiên giả/kho riêng, không sửa dữ liệu cá nhân. Đã sửa lỗi focus làm menu đóng sớm khi bấm mục khác.
- Sửa UX lưu hồ sơ: PATCH riêng, giữ dữ liệu nhật ký, tự giải quyết race version và tự thử lại; báo thành công sau xác nhận, không bắt user đồng bộ thủ công. Profile offline lưu cục bộ theo tài khoản và tự gửi lại; tự phục hồi draft profile từ luồng cũ. Chrome đã kiểm tra 503 tạm thời, offline/online và khôi phục draft, đều đạt.
- Chủ tài khoản đã thử đăng nhập, tạo nhật ký, đăng xuất và đổi tài khoản. Sau bản sửa profile, chủ tài khoản xác nhận “mọi thứ đã chạy ổn”. Ghi nhận là nghiệm thu local; chưa suy rộng thành đã test mọi luồng production, Calendar write hoặc nhiều thiết bị vật lý.
- Hướng dẫn đầy đủ: [tài khoản, cách hoạt động và test](accounts-and-testing.md).
- Tổng kết kiến thức, khác biệt môi trường doanh nghiệp và bài tập: [bài giảng 19/10](lesson-2026-10-19.md).
- Buổi tiếp theo ưu tiên SQL/thiết kế quan hệ trên database dev riêng, rồi CRUD từng nhật ký + RLS và migration có kiểm thử. Nghiệm thu production bằng A/B, profile và hai trình duyệt; Calendar write thật vẫn là mục riêng cần kiểm tra. Mốc “ngày mai 16/10” bên dưới thuộc kế hoạch lịch sử; buổi triển khai thực tế là 19/10.

### Phát hành cuối buổi

- Commit ứng dụng: [`cc076a653b43e6e71a01b094714a0e4267140b04`](https://github.com/BaoKhanh0230/LearnToVibe/commit/cc076a653b43e6e71a01b094714a0e4267140b04), đã push `origin/main`.
- [GitHub Actions run 39236017194](https://github.com/BaoKhanh0230/LearnToVibe/actions/runs/39236017194): Test VibeLog và Deploy to GitHub Pages đều success.
- Đã đọc lại website Pages công khai: HTTP 200 và có menu tài khoản mới. Domain Vercel trả 200 nhưng chưa có menu mới, xác nhận production vẫn ở bản trước.
- Kiểm tra trước release: không phát hiện giá trị secret local trong 88 file ứng viên; `.env`, dữ liệu phiên, draft và ảnh browser không nằm trong commit. Database xác nhận role hạn chế, FORCE RLS và chặn SELECT của anon/authenticated.
- Vercel chưa phát hành bản mới tại thời điểm ghi dòng này: công cụ trả 403 do thiếu quyền scope `merikatori`. Không có CLI đã đăng nhập để dùng thay thế. Chủ tài khoản chọn kết nối lại Vercel đúng tài khoản; cần tiếp tục phát hành đúng commit ứng dụng và chạy smoke test production sau khi kết nối có quyền.
- Không coi việc push GitHub/Pages success là Vercel đã cập nhật. Không thay token/secret hoặc chọn project khác để vượt lỗi quyền.

## Cách cập nhật sau mỗi buổi

1. Đọc phần trạng thái hiện tại và kế hoạch buổi tiếp theo trước khi bắt đầu.
2. Ghi ngày học, mục tiêu, khái niệm đã học, thay đổi đã làm và bằng chứng kiểm chứng.
3. Phân biệt rõ: đã có mã nguồn, đã deploy, đã kiểm thử tự động, đã được người dùng nghiệm thu.
4. Cập nhật phần còn thiếu và kế hoạch; ghi quyết định hoặc giới hạn cần nhớ.
5. Commit/push ghi chú cùng các thay đổi cần thiết. Không ghi mật khẩu, token, connection string, cookie hoặc dữ liệu Calendar/nhật ký cá nhân.

## Trạng thái deployment trước buổi tài khoản (15/10)

Website chính thức: **https://vibelog-baokhanh.vercel.app/**.

| Hạng mục | Đã đạt | Giới hạn / việc còn thiếu |
| --- | --- | --- |
| Website và API | Chạy trên Vercel; Node.js 24, function tại Singapore | Không bảo đảm mọi lần deploy hoặc cold start đều tức thời |
| Database | Supabase PostgreSQL, project VibeLog tại Seoul; TLS xác minh CA/hostname | Hiện chủ yếu lưu phiên OAuth, chưa lưu nhật ký theo tài khoản |
| Google Calendar | Chủ tài khoản xác nhận đăng nhập, tải lịch và giữ kết nối sau refresh | Chưa xác nhận ghi/cập nhật sự kiện thật và giữ phiên qua redeploy trên Vercel |
| Tài khoản VibeLog | Chưa xây dựng tài khoản ứng dụng có user ID ổn định để sở hữu dữ liệu | Kết nối Calendar hiện tại không tương đương hệ thống tài khoản và phân quyền nhật ký |
| Nhật ký, kế hoạch học | Tạo/sửa/tìm/lọc, thống kê và kế hoạch trong app; lưu localStorage | Chưa đồng bộ thiết bị, chưa tách dữ liệu theo tài khoản |
| Sao lưu | Có xuất JSON nhật ký | Chưa có quy trình nhập/di chuyển dữ liệu vào tài khoản cloud |
| Bảo vệ phiên Google | Token mã hóa phía máy chủ, cookie HttpOnly/Secure/SameSite, PKCE; bảng phiên bật RLS và chặn anon/authenticated | Khi có tài khoản VibeLog cần liên kết phiên Calendar với đúng người dùng và bảo vệ việc đổi tài khoản |
| SEO kỹ thuật | Title, description, nội dung công khai, canonical Vercel, robots.txt, sitemap.xml và thẻ Search Console | Chưa có các trang hướng dẫn chuyên biệt; không bảo đảm thứ hạng |
| Google Search | Chủ tài khoản báo Google đã đưa yêu cầu vào hàng đợi ưu tiên thu thập | Chưa xác nhận URL đã được lập chỉ mục; chưa ghi nhận sitemap báo Success hoặc dữ liệu tìm kiếm |
| Kiểm thử | 65/65 bài tự động đạt và CI đạt ở bản đã triển khai; smoke test website thật đạt | Không dùng smoke test thay cho nghiệm thu Google bằng tài khoản thật |
| Nền tảng cũ | Render/Neon được giữ để đối chiếu; Render auto-deploy tắt | Không tự xóa dịch vụ hoặc chuyển refresh token/dữ liệu cũ |

Mã nguồn vanilla HTML/CSS/JavaScript và Node.js; không cần đổi framework chỉ để làm SEO hoặc thêm tài khoản.

## Buổi 14/10/2026 — Deploy và kết nối Google lâu dài

Nguồn ghi nhận: [deployment-status.md](deployment-status.md), tài liệu triển khai có sẵn và xác nhận của chủ tài khoản.

- Học vai trò hosting, database, biến môi trường, OAuth callback và phiên đăng nhập.
- Deploy Node.js lên Render Free, kho phiên mã hóa trên Neon PostgreSQL Free.
- Hiểu filesystem tạm của cloud và lý do dữ liệu phiên cần lưu ngoài máy chủ.
- Chủ tài khoản xác nhận Calendar tải được và giữ kết nối sau redeploy Render.
- Chuẩn bị bài tiếp theo: để người khác tìm thấy project bằng công cụ tìm kiếm.

Tài liệu ngày này là lịch sử nền tảng cũ, không phải địa chỉ production hiện tại.

## Buổi 15/10/2026 — SEO, Search Console và chuyển hosting

### Đã học

- Phân biệt deploy, phát hiện URL, crawl, index và xếp hạng theo truy vấn.
- Search Console xác minh quyền quản lý và báo cáo tìm kiếm; gửi yêu cầu index không bảo đảm đã index.
- Vai trò title, description, canonical, robots.txt, sitemap và nội dung công khai.
- SEO kỹ thuật, nội dung hữu ích, liên kết và cách giới thiệu sản phẩm tới đúng người.
- Từ khóa thương hiệu so với truy vấn giải quyết nhu cầu; dùng dữ liệu Search Console thay vì đoán lượng tìm kiếm.
- Các cách tạo nội dung HTML: trực tiếp, SSG, SSR, CMS; chưa cần chuyển framework cho VibeLog.
- Supabase thay phần database; Vercel thay phần website/API. Đổi database đơn lẻ không giải quyết chờ deploy Render.
- Kết nối database gồm định dạng URI, mã hóa ký tự mật khẩu (`#` thành `%23` đúng một lần), chứng chỉ CA và xác thực mật khẩu.

### Đã làm

- Thêm SEO cơ bản, sitemap, robots và hai thẻ xác minh do chủ tài khoản cung cấp.
- Bản SEO Render build thành công nhưng deploy kết thúc update_failed sau khoảng 15 phút; tiếp tục hướng thay hosting theo yêu cầu người dùng.
- So sánh Vercel, Railway, Cloudflare và Supabase qua tài liệu. Đã triển khai/thử thật Vercel + Supabase; chưa deploy thử Railway/Cloudflare.
- Chủ tài khoản tạo Supabase project; đã tạo bảng phiên, bật RLS và thu hồi quyền frontend.
- Chuyển OAuth state/PKCE từ RAM sang kho mã hóa để callback chạy được trên tiến trình serverless khác; tiêu thụ state một lần bằng thao tác có điều kiện.
- Tạo handler Vercel, build chỉ đóng gói tài nguyên công khai, cấu hình môi trường và CA Supabase chính thức.
- Xử lý lần lượt ERR_INVALID_URL, SELF_SIGNED_CERT_IN_CHAIN và 28P01; chủ tài khoản sửa connection string/mật khẩu trong Dashboard.
- Chuyển canonical và tài liệu sang địa chỉ Vercel; giữ các dịch vụ cũ.
- Chủ tài khoản xác nhận Google Calendar đăng nhập, tải lịch và giữ kết nối sau refresh.
- Chủ tài khoản gửi yêu cầu lập chỉ mục và nhận thông báo hàng đợi thu thập dữ liệu.

### Bằng chứng và giới hạn

- 65 kiểm thử tự động đạt, CI GitHub đạt.
- Smoke test production đạt: health/auth status 200, API lịch chưa đăng nhập 401, Origin lạ 403, file riêng 404, cookie bảo mật, PKCE, sitemap/robots.
- Luồng OAuth hủy thử nghiệm đọc/ghi Supabase qua nhiều HTTP request và chặn phát lại; không cần truy cập Google thật trong bài này.
- Truy vấn quyền database xác nhận RLS bật, anon và authenticated không được SELECT bảng phiên.
- Bản chứa thẻ Search Console Vercel: commit `e8679bd532e8a2f9b192fb96f6e4a1d8e2f32610`, deployment `dpl_52rmyfEobU3Ln7WrCZiQuaNo6nwX` đạt READY. Thẻ xác minh, canonical, sitemap và backend được đọc lại trên URL công khai.
- Đưa vào hàng đợi Google chưa phải đã index hoặc có thứ hạng. Trạng thái sitemap Success chưa được chủ tài khoản báo lại.

## Kế hoạch buổi 16/10/2026 — Tài khoản và dữ liệu theo người dùng

Đây là kế hoạch lịch sử lập ở buổi 15/10, lúc đó chưa triển khai. Phần thực hiện và quyết định cuối cùng nằm ở buổi **19/10/2026** phía trên; không dùng phần kế hoạch này làm trạng thái hiện tại.

Mục tiêu do người dùng đặt: đăng nhập, lưu nhật ký/kế hoạch học theo tài khoản; đăng nhập Google và có quyền Calendar thì tự hiển thị lịch của đúng tài khoản đó.

### Khái niệm cần học

- Authentication: xác định người dùng là ai, tạo user ID ổn định.
- Authorization: xác định họ được xem/sửa dữ liệu nào; mọi hàng nhật ký/kế hoạch phải có chủ sở hữu.
- Persistence và đồng bộ: dữ liệu cloud tồn tại độc lập với localStorage của một trình duyệt.
- Phiên VibeLog và quyền Google Calendar là hai việc khác nhau. Đăng nhập Google thông thường không tự cấp quyền Calendar.

### Hướng thiết kế để đánh giá vào buổi tới

1. Đánh giá Supabase Auth với Google cho tài khoản ứng dụng, tích hợp phù hợp với luồng Calendar máy chủ đang hoạt động; không viết lại OAuth trước khi xác định cách liên kết danh tính và token.
2. Dùng ID do hệ thống xác thực kiểm chứng để gắn chủ sở hữu; không tin user_id/email do frontend tự gửi lên.
3. Dự kiến các bảng nhật ký và kế hoạch chứa user_id; thiết kế RLS/API cho phép người dùng đọc/sửa/xóa dữ liệu của chính họ. Định nghĩa policy cả đọc và ghi; không dùng khóa đặc quyền phía frontend.
4. Sau đăng nhập và khi đã được cấp quyền Calendar, tự tải lịch; khi quyền bị từ chối hoặc thu hồi, thông báo cách kết nối lại, không giả định có quyền.
5. Token Google dùng phía server và liên kết đúng user ID; phân biệt refresh phiên Supabase với refresh access token Google. Supabase Auth không tự gia hạn provider token.
6. Lưu kế hoạch học trong database; khi gửi sang Google giữ event ID để cập nhật cùng sự kiện, có trạng thái thành công/lỗi và khả năng thử lại. Chưa mặc định làm đồng bộ hai chiều mọi thay đổi Google Calendar.
7. Thiết kế việc đưa dữ liệu localStorage cũ vào tài khoản với xác nhận chủ sở hữu, chống nhập trùng; không tự gán dữ liệu khách cũ cho người tiếp theo đăng nhập trên máy chung.
8. Đăng xuất/đổi tài khoản phải xóa dữ liệu hiển thị của tài khoản trước và chặn kết quả request cũ xuất hiện ở tài khoản mới.

### Tiêu chí nghiệm thu dự kiến

- Tài khoản A tạo nhật ký/kế hoạch; đăng xuất rồi đăng nhập lại vẫn có dữ liệu.
- Cùng tài khoản trên trình duyệt/thiết bị thứ hai nhìn thấy dữ liệu cloud.
- Tài khoản B không đọc/sửa/xóa được dữ liệu A, kể cả gọi API hoặc thay ID trực tiếp.
- Đăng nhập Google và đồng ý quyền Calendar thì lịch đúng tài khoản tự tải; refresh trang không trộn dữ liệu.
- Từ chối quyền Calendar vẫn có hành vi rõ ràng; quyền nhật ký không bị giả định phụ thuộc vào quyền lịch.
- Kiểm tra hết hạn token, đổi tài khoản, đăng xuất, lỗi mạng, thử lại và tránh tạo trùng sự kiện.
- Dữ liệu local cũ còn được bảo toàn trước khi chuyển; nếu nhập cloud có thể thử lại mà không nhân bản.

## Tài liệu để tiếp tục

- [README](../README.md): cách chạy và tổng quan các tính năng.
- [SEO và Search Console](seo.md).
- [Vercel + Supabase và trạng thái migration](vercel-supabase.md).
- [Kiểm thử và bảo mật](testing-security.md).
- [Lịch sử Render + Neon ngày 14/10](deployment-status.md).
- [Google login qua Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).
- [Provider token và refresh](https://supabase.com/docs/guides/auth/social-login#provider-tokens).
- [RLS trong Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
