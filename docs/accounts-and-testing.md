# Tài khoản, dữ liệu riêng và cách test — 19/10/2026

## Trạng thái thực tế

- Đã viết mã đăng nhập, dữ liệu theo tài khoản, đồng bộ, nhập dữ liệu local, xử lý xung đột và tách ngắt Calendar khỏi đăng xuất.
- Đã tạo `public.vibelog_user_data` trong Supabase project VibeLog hiện có (`bpdigfubhbzeppknsfmd`). Không chuyển hay xóa dữ liệu phiên cũ.
- Đã kiểm tra RLS trên PostgreSQL thật bằng dữ liệu giả trong transaction rollback: B không đọc/sửa A, không chèn dữ liệu cho C. Không giữ dữ liệu test trong database.
- Security advisor không báo vấn đề ở bảng mới. Thông báo INFO ở bảng phiên cũ không có policy là chủ ý: bảng này chặn toàn bộ Data API, chỉ máy chủ truy cập.
- 85 bài kiểm thử tự động đạt, gồm API hồ sơ riêng, tự thử lại, phục hồi draft profile cũ, chống mất avatar mới khi retry và điều hướng menu. Build Pages đạt; audit production đạt ở bài tài khoản ban đầu (0 lỗ hổng).
- Đã kiểm tra Chrome thật trên desktop và mobile: sửa hồ sơ qua API, tải lại ở browser context mới, tách tài khoản B, download sao lưu, đăng xuất, bàn phím và menu fallback. Bài browser dùng phiên giả và kho dữ liệu kiểm thử riêng trong bộ nhớ; không truy cập dữ liệu Google hay database production.
- Mã nguồn ứng dụng đã push GitHub ở commit `cc076a6`; CI và Pages deploy success. Vercel production đã cập nhật qua CLI với source commit `f460f7d`, deployment READY và smoke test đạt trên [domain chính](https://vibelog-baokhanh.vercel.app/). Đăng nhập Google thật và thao tác A/B trên production cần nghiệm thu riêng. Xem [nhật ký phát hành](learning-log.md).

## Menu tài khoản và hồ sơ

Tài khoản nằm trên thanh điều hướng cố định, góc phải. Bấm avatar để mở menu: chỉnh sửa hồ sơ, sao lưu toàn bộ dữ liệu, nhập local nếu có, đổi Google account và đăng xuất. Các thao tác thử đồng bộ, xuất bản nháp, tải lại cloud chỉ xuất hiện khi cần. Chấm trên avatar báo trạng thái đồng bộ; lỗi còn có cảnh báo ngoài menu. Menu hỗ trợ mũi tên, Home/End, Esc, Tab và bấm ra ngoài.

Avatar mặc định dùng chữ cái đầu/cuối của tên, màu ổn định theo ID tài khoản; không tải hình từ dịch vụ ngoài. **Chỉnh sửa hồ sơ** cho đổi tên hiển thị trong VibeLog (1–60 ký tự) và chọn avatar có sẵn. Email Google chỉ hiển thị, không sửa ở đây. Chưa hỗ trợ upload ảnh tùy ý.

Hồ sơ lưu tại `payload['vibelog.profile.v1']` trong cùng hàng dữ liệu tài khoản, dùng cùng RLS, version và quy trình đồng bộ. Không cần tạo bảng hoặc chạy lại schema. Đổi tên không thay Google ID, email hay quyền sở hữu dữ liệu. Đăng nhập cùng tài khoản trên trình duyệt khác sẽ tải được hồ sơ đã lưu. File sao lưu toàn bộ có nhật ký, kế hoạch, cài đặt và hồ sơ; chưa có tính năng tự nhập lại file sao lưu toàn bộ.

Lưu hồ sơ dùng `PATCH /api/user/profile`, chỉ gửi tên/avatar. Máy chủ tự đọc bản mới nhất, gộp profile và thử lại khi có xung đột version; giữ nguyên nhật ký/kế hoạch, không kiểm tra lại cả snapshot nhật ký chỉ để đổi avatar. Gửi lại cùng nội dung đã lưu không tăng version thêm. Giao diện chỉ báo **Đã cập nhật hồ sơ thành công** sau khi máy chủ xác nhận. Lỗi tạm thời được thử lại ngầm; nếu offline kéo dài thì thay đổi được giữ theo tài khoản trong localStorage và tự gửi khi có mạng hoặc lượt thử ngầm tiếp theo. Không yêu cầu user bấm đồng bộ, xuất draft hay tải cloud chỉ vì cập nhật profile.

Bản nháp profile-only từ luồng cũ được nhận diện và tự chuyển sang API mới khi mở app. Xung đột nhật ký thật vẫn được bảo vệ, không tự ghi đè. Kiểm tra Chrome đã bao gồm 503 giả lập, offline/online và tự phục hồi draft cũ. Sau cập nhật mã backend, khởi động lại `npm start` một lần để server nhận route mới; không cần thay `.env` hoặc chạy schema.

Để test: mở menu → Chỉnh sửa hồ sơ → đổi tên/chọn avatar → Lưu hồ sơ → reload → đăng nhập cùng tài khoản ở trình duyệt khác. Đổi sang B phải thấy hồ sơ B. Thử lưu tên trống, mất mạng khi lưu và Esc trong menu; bản nháp/lỗi phải còn được báo rõ.

Xem hồ sơ bằng SQL (thay ID thật):

```sql
SELECT user_id, version,
       (payload ->> 'vibelog.profile.v1')::jsonb AS profile
FROM public.vibelog_user_data
WHERE user_id = 'ID_TAI_KHOAN';
```

## Quyết định về đăng nhập (chi tiết)

Supabase Auth đã được đánh giá. Bản này tiếp tục dùng OAuth Google phía máy chủ vốn có, bổ sung `openid email profile` để nhận diện tài khoản. Supabase dùng để lưu PostgreSQL; không bật Supabase Auth và không tạo `auth.users`.

Lý do: app đã có callback, PKCE, cookie HttpOnly và refresh token Calendar mã hóa hoạt động trên Node/Vercel. Một luồng Google có thể cung cấp danh tính và xin quyền lịch cùng lúc, tránh có hai phiên đăng nhập và hai tài khoản Google có thể lệch nhau. Nếu sau này cần email/password hoặc nhiều nhà cung cấp, có thể chuyển sang Supabase Auth bằng một kế hoạch liên kết danh tính riêng; ID hiện tại không phải UUID của Supabase Auth.

Máy chủ gọi HTTPS `https://openidconnect.googleapis.com/v1/userinfo` bằng access token vừa đổi từ authorization code. Chỉ khi Google xác nhận `sub` thì mới tạo phiên có tài khoản. ID VibeLog là SHA-256 của chuỗi `google:<sub>`; cùng Google account luôn cho cùng ID trên mọi thiết bị, không phụ thuộc email. Email/tên chỉ để hiển thị, không quyết định quyền.

Quyền Calendar được kiểm tra riêng từ scope Google trả về và refresh token. Nếu Google cho đăng nhập nhưng không cấp quyền lịch, tài khoản/nhật ký vẫn dùng được; lịch yêu cầu cấp quyền lại. Nếu hủy toàn bộ OAuth thì không có phiên mới, phiên cũ vẫn được giữ.

Tài liệu chính thức: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Dữ liệu đi đâu và được bảo vệ thế nào

1. Google callback tạo cookie phiên ngẫu nhiên. Access/refresh token vẫn nằm trong kho phiên mã hóa phía máy chủ; không gửi vào localStorage hay JavaScript frontend.
2. Trước khi khởi tạo nhật ký, frontend đọc `/api/auth/status`, rồi `/api/user/data`. Khi đăng nhập, chỉ dữ liệu cloud của tài khoản được chọn mới đi vào nhật ký/kế hoạch/thống kê.
3. Bảng `vibelog_user_data` có một hàng mỗi user: `user_id`, `version`, `payload`. Payload chứa nhật ký, kế hoạch, mục tiêu tuần, nhắc học và tùy chọn tự gửi Calendar. Cài đặt chuyển động vẫn thuộc thiết bị.
4. Khi lưu, frontend gửi `PUT /api/user/data` với snapshot và phiên bản đã đọc. Máy chủ xác định user từ cookie, kiểm tra Origin, CSRF và ID tài khoản dự kiến. ID trong body/query không thể chọn một chủ sở hữu khác.
5. Mỗi truy vấn dùng transaction, `SET LOCAL ROLE vibelog_user` và `set_config('vibelog.user_id', ..., true)`. Role này không có quyền bỏ qua RLS; policy kiểm tra user_id cả khi đọc và ghi. Context chỉ tồn tại trong transaction, không rò sang người dùng kế tiếp khi dùng connection pool.
6. Bảng bật và FORCE RLS; `anon`, `authenticated` và PUBLIC không có quyền đọc/ghi qua Supabase REST. Đây là policy dành cho backend riêng, không phải policy `auth.uid()` của Supabase Auth. Máy chủ/database owner vẫn là bên tin cậy.
7. Ghi thành công tăng version. Nếu thiết bị khác đã ghi trước, API trả 409 thay vì ghi đè. App giữ bản nháp, khóa chỉnh sửa và cung cấp nút xuất/tải cloud.

Dữ liệu học không mã hóa AES ở tầng ứng dụng như refresh token; quyền DB/RLS và TLS bảo vệ truy cập. Role quản trị database vẫn đọc được nội dung nhật ký.

## Chuẩn bị chạy và triển khai

### Local — có thể test ngay

```powershell
npm ci
npm test
npm start
```

Mở `http://localhost:4173`. `.env` hiện có Google Client ID/Secret; callback Google phải chứa chính xác `http://localhost:4173/api/auth/callback`. Không cần thêm key Supabase vào frontend.

Nếu **không có DATABASE_URL**, app dùng file mã hóa trong `.vibelog-data` để lưu cả phiên và dữ liệu tài khoản phục vụ phát triển, một tiến trình. Hai trình duyệt cùng dùng máy chủ local có thể test chia sẻ dữ liệu theo tài khoản, nhưng đây chưa phải kiểm chứng Supabase/production.

Nếu muốn local dùng Supabase, cấu hình DATABASE_URL, DATABASE_CA_CERT và SESSION_ENCRYPTION_KEY như [hướng dẫn Vercel](vercel-supabase.md). Giữ khóa/mật khẩu ở môi trường server. Bảng trên project hiện tại đã được tạo. Với database mới, trước khi chạy app, thực thi:

```powershell
npm run db:users
```

Script chạy schema có transaction trong `scripts/user-data-schema.sql`: bảng, role và policy. Database role của ứng dụng phải được phép `SET ROLE vibelog_user`; script cấp membership cho role chạy setup. Nếu role setup khác role runtime, DBA cần cấp membership cho role runtime tương ứng. Không chạy app với `vibelog_user` làm login role; role đó cố ý NOLOGIN.

### Google Cloud và production

- Giữ OAuth client và callback đang hoạt động: `https://vibelog-baokhanh.vercel.app/api/auth/callback`.
- Data Access cần các scope danh tính `openid`, email, profile và `https://www.googleapis.com/auth/calendar.events.owned`. Calendar API phải bật.
- Nếu app Google còn Testing, cả A và B phải ở danh sách Test users. Thời hạn/thu hồi refresh token vẫn tuân theo Google; không có kết nối vĩnh viễn.
- Production giữ nguyên APP_URL, GOOGLE_CLIENT_ID/SECRET, DATABASE_URL, DATABASE_CA_CERT, SESSION_ENCRYPTION_KEY đã có. Không cần Supabase publishable/service_role key cho thiết kế này.
- Sau khi deploy source mới lên Vercel, chạy các bước nghiệm thu dưới đây. Phiên Calendar cũ chưa chứa danh tính: đăng nhập Google lại một lần để nâng cấp, rồi chọn nhập dữ liệu local nếu cần.
- GitHub Pages vẫn là bản tĩnh, chỉ lưu trên thiết bị và dùng kết nối Calendar popup. Không hỗ trợ tài khoản/cloud qua backend mới; dùng Vercel cho bài học này.

## Kịch bản test thủ công và kết quả mong đợi

Nên dùng hai Google account thử nghiệm A/B, một cửa sổ thường, một cửa sổ riêng tư hoặc trình duyệt khác. Tạo nhật ký với tên dễ nhận biết; không dùng nội dung cá nhân nhạy cảm làm dữ liệu test.

| Bước | Thao tác | Phải thấy |
| --- | --- | --- |
| 1. Dữ liệu cũ | Trước đăng nhập, tạo `LOCAL-ONLY`, một kế hoạch và đổi mục tiêu tuần | App lưu ở chế độ thiết bị |
| 2. Đăng nhập A | Bấm **Đăng nhập Google**, chọn A, cấp quyền | Phần tài khoản hiện email A; dữ liệu cloud A tải về; lịch của A tự tải nếu đủ quyền |
| 3. Không nhập ngầm | Chưa bấm nhập dữ liệu cũ | `LOCAL-ONLY` chưa được gán cho A; nút nhập dữ liệu cũ xuất hiện |
| 4. Nhập có xác nhận | Bấm **Nhập dữ liệu cũ vào tài khoản**, đọc email nhận, xác nhận | Nhật ký/kế hoạch local được gộp theo ID; ID đã có ưu tiên cloud; không tự gửi nhật ký cũ lên Google. Chỉ xóa các khóa local đã nhập sau khi cloud lưu thành công |
| 5. Tạo dữ liệu A | Thêm `A-ONLY`, sửa nội dung, đổi mục tiêu/nhắc học, tạo kế hoạch tương lai | Thanh tài khoản báo **Đã đồng bộ với tài khoản** sau mỗi đợt lưu |
| 6. Thiết bị khác | Mở cửa sổ riêng tư, đăng nhập cùng A | Thấy nhật ký, kế hoạch và cài đặt của A; không phụ thuộc localStorage trình duyệt thứ nhất |
| 7. Tài khoản B | Ở cửa sổ thứ hai, đăng xuất rồi đăng nhập B | Không thấy `A-ONLY`, kế hoạch và mục tiêu riêng A. Tạo `B-ONLY`, chờ đồng bộ |
| 8. Đổi lại A | Đổi tài khoản Google về A | Chỉ dữ liệu A; `B-ONLY` không xuất hiện. Calendar cũng chuyển theo tài khoản mới |
| 9. Hủy OAuth | Bấm đổi tài khoản nhưng hủy trên Google | Giữ nguyên tài khoản và dữ liệu cũ; không nhập nhầm local |
| 10. Ngắt lịch | Bấm **Ngắt kết nối** trong phần Calendar | Lịch được dọn; vẫn hiện email A và vẫn đọc/lưu được nhật ký |
| 11. Kết nối lại | Cấp quyền Calendar lại với A | Lịch A tải lại; nhật ký cloud vẫn còn |
| 12. Đăng xuất | Bấm **Đăng xuất** ở phần tài khoản | Dữ liệu A không còn hiển thị. Đăng nhập A lại vẫn lấy được dữ liệu đã lưu |
| 13. Sự kiện Calendar | Gửi một nhật ký có giờ học; gửi lại lần nữa | Google Calendar có cùng một sự kiện được cập nhật, không tạo bản trùng. Xóa dữ liệu test ở Google Calendar sau bài học |

Nếu Google có tùy chọn bỏ quyền Calendar, thử chỉ cấp danh tính: đăng nhập được, nhật ký dùng được, lịch báo cần cấp quyền. Nếu Google hủy toàn bộ flow vì từ chối quyền thì test đó là hủy OAuth, không phải đăng nhập thành công.

### Test mạng lỗi và hai thiết bị sửa cùng lúc

1. Đăng nhập A, chờ tải dữ liệu, mở DevTools → Network → Offline.
2. Ghi `OFFLINE-DRAFT`. App không được báo đã đồng bộ cloud; phần tài khoản báo lỗi, có **Thử đồng bộ lại** và **Xuất bản nháp**.
3. Bật Online, bấm thử lại. Khi báo đã đồng bộ, reload rồi kiểm tra bản ghi còn nguyên.
4. Để test xung đột: mở A ở hai trình duyệt, cùng tải một phiên bản. Sửa và lưu ở trình duyệt 1; sau đó sửa ở trình duyệt 2 mà chưa reload.
5. Trình duyệt 2 phải báo dữ liệu đã đổi, giữ bản nháp và khóa chỉnh sửa. Bấm **Xuất bản nháp** để giữ JSON, rồi **Tải lại dữ liệu cloud**, xác nhận bỏ bản nháp. Dữ liệu từ trình duyệt 1 phải còn nguyên.
6. File bản nháp chứa dữ liệu học riêng. Hiện chưa có nút nhập file bản nháp: có thể dùng để đối chiếu và nhập lại các thay đổi cần giữ sau khi tải cloud. Không chia sẻ file nếu có nội dung cá nhân.
7. Bản nháp tự giữ trong sessionStorage của tab, tách theo user. Reload cùng tab có thể phục hồi/thử lưu nếu version chưa đổi; đóng tab có thể mất bản nháp. Không coi bản nháp là bản sao lưu cloud.
8. Mở hai tab cùng trình duyệt, đổi tài khoản ở tab 2 rồi quay lại tab 1: tab 1 kiểm tra phiên và tải lại/khóa nếu còn bản nháp. API cũng chặn việc ghi bằng CSRF/ID của phiên cũ.

### Test API bằng DevTools

Chạy trong Console trên đúng origin của app, khi đăng nhập A:

```js
const s = await fetch('/api/auth/status').then(r => r.json());
const d = await fetch('/api/user/data').then(r => r.json());
console.log(s.user, d.version); // Không có Google access/refresh token

const result = await fetch('/api/user/data', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-VibeLog-Request': '1',
    'X-VibeLog-CSRF': s.csrfToken,
    'X-VibeLog-User': 'id-khong-phai-tai-khoan-hien-tai'
  },
  body: JSON.stringify(d)
});
console.log(result.status); // 409: không thay đổi dữ liệu
```

Bỏ/sửa CSRF phải trả 403. Đăng xuất rồi GET `/api/user/data` phải trả 401. Thêm `?user_id=ID_B` vào GET không được trả dữ liệu B: endpoint luôn chọn chủ sở hữu từ phiên. Không gửi cookie/CSRF thật cho người khác.

## Giới hạn cần biết

- Đồng bộ theo snapshot tối đa 64 KB mỗi lần gửi, tối đa 1.000 hàng mỗi danh sách. Đây là giới hạn của phiên bản nhỏ này; khi nhật ký lớn hơn cần chuyển sang API từng bản ghi và phân trang.
- Thiết bị đã mở app không nhận realtime thay đổi từ thiết bị khác: reload để đọc mới; version chặn ghi đè khi sửa dữ liệu cũ. Chưa tự gộp xung đột.
- Cookie đăng nhập có hạn 180 ngày; quyền Calendar có hạn/thu hồi riêng. Cấp lại quyền không xóa dữ liệu tài khoản.
- Dữ liệu local thuộc origin: localhost, Vercel, Pages là ba kho khác nhau. Nút nhập chỉ đọc local của origin đang mở; không tự lấy dữ liệu từ domain cũ.
- Chưa có trang quản lý/xóa tài khoản hoặc tự động liên kết nhiều nhà cung cấp danh tính.

Tham khảo phân quyền: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
