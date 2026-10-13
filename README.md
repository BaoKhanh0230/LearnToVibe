# VibeLog

VibeLog là nhật ký nhỏ dành cho hành trình học và vibe code. Bạn có thể ghi lại mình vừa làm gì, học trong bao lâu, cảm thấy thế nào và rút ra điều gì. Dữ liệu được lưu trong trình duyệt bằng `localStorage`.

Bạn cũng có thể sửa, tìm kiếm và lọc các phiên học đã ghi. Hình Doro trong thư mục `image` được dùng làm favicon và biểu tượng của dự án.

VibeLog còn hỗ trợ đặt mục tiêu số phút học mỗi tuần và tải toàn bộ nhật ký xuống file JSON để sao lưu.

Dashboard 7 ngày giúp nhìn nhanh tổng thời gian, trung bình, ngày tập trung nhất và chủ đề nổi bật. Mỗi phiên học có thể được phân loại theo chủ đề, gắn tối đa 8 tag và lọc lại trong nhật ký.

Biểu đồ tuần bắt đầu từ Thứ Hai. Giao diện luôn dùng dark mode; lịch nhắc học có thể tùy chỉnh giờ cùng các ngày trong tuần khi VibeLog đang mở. Thanh VibeLog cố định khi cuộn; nút ↑ ở góc dưới bên phải đưa về đầu trang, cuộn mượt khi bật chuyển động và tức thời khi giảm chuyển động.

Trải nghiệm cuộn sử dụng Lenis trên desktop và GSAP ScrollTrigger cho page entrance, scroll reveal, parallax nhẹ, tiến độ cuộn và animation biểu đồ. Nếu chưa chọn riêng trong app, các hiệu ứng theo cài đặt `prefers-reduced-motion` của hệ thống.

Nút `〰` trên thanh điều hướng bật/tắt chuyển động ngay, không tải lại trang và không mất nội dung form đang nhập. Lần đầu, app theo cài đặt giảm chuyển động của hệ thống; lựa chọn bật/tắt rõ ràng trong VibeLog được ưu tiên và lưu trong trình duyệt. Bật lại sẽ chạy lại hiệu ứng vào trang. Tắt sẽ dừng GSAP/Lenis và khôi phục nội dung về trạng thái tĩnh.

GSAP là thư viện JavaScript tạo animation (không phải bộ ảnh/icon). Project dùng GSAP core cho hiệu ứng vào trang, nhật ký, sự kiện lịch và cửa sổ chi tiết; ScrollTrigger cho hiệu ứng khi cuộn, parallax và biểu đồ. GSAP 3.15.0, ScrollTrigger và Lenis được lưu tại `src/vendor`, nên animation không cần tải thư viện từ CDN khi chạy. Nguồn và thông tin giấy phép ở `src/vendor/NOTICE.md`. Google Calendar vẫn cần mạng để đăng nhập và tải/gửi lịch.

Background chính dùng **Vanta NET** với Three.js trên một lớp cố định phía sau toàn trang; lớp phủ tối giữ chữ và lịch dễ đọc. Khung “Your learning space” giữ tiến độ tuần thật lấy từ nhật ký trên nền tĩnh. Three.js/Vanta chỉ tải khi bật chuyển động và màn hình từ 900px có chuột; điện thoại, chế độ giảm chuyển động hoặc máy không hỗ trợ WebGL dùng nền tĩnh. Hiệu ứng dừng khi tab bị ẩn và tạo lại khi quay về. Nút `〰` dọn canvas và khôi phục số liệu cuối cùng ngay khi tắt. Các khối mục tiêu, thống kê, nhắc học, lịch và nhật ký xuất hiện bằng GSAP ScrollTrigger khi cuộn; hiệu ứng có thể chạy lại khi cuộn về rồi đi xuống lần nữa.

Các hiệu ứng **BlurText**, **CountUp**, **SpotlightCard** từ React Bits được chuyển thành JavaScript thuần/GSAP trong `src/design-effects.js`: tiêu đề hiện từng cụm chữ, số liệu đếm lên đúng giá trị và ánh sáng theo chuột trên thẻ thống kê/nhật ký. Không chuyển project sang React. Nguồn, phiên bản và giấy phép Vanta, Three.js, React Bits được lưu trong `src/vendor/NOTICE.md` cùng các file LICENSE. Các hiệu ứng chỉ trang trí; lịch, form và nhật ký vẫn sử dụng được khi chúng bị tắt.

Nút **Tìm nhanh** hoặc **Ctrl/⌘ + K** mở bảng tìm nhật ký theo tên/nội dung/tag và các thao tác: ghi nhật ký, xem lịch, hẹn buổi học, tìm kiếm, sao lưu và bật/tắt chuyển động. Gõ không dấu vẫn tìm được tiếng Việt; dùng ↑/↓ chọn, Enter mở và Esc đóng. Kết quả nhật ký đưa đến đúng thẻ, giữ nguyên nội dung form đang nhập. Thông báo dùng cùng một viên trạng thái chuyển kích thước và nội dung khi gửi lịch: đang xử lý → thành công/lỗi. Nút × đóng thông báo; nút `〰` cũng giảm chuyển động của bảng tìm và thông báo. Icon mới là SVG cục bộ cùng nét, không tải bộ icon từ bên ngoài.

Thông báo đặt phía trên, ngay dưới thanh điều hướng, với chữ 15px/icon lớn hơn và hiển thị 6 giây (lỗi nhập liệu 7 giây). Form nhật ký/kế hoạch dùng thông báo tiếng Việt thay cho popup validation mặc định; đánh dấu và đưa focus đến ô cần sửa, kiểm tra cả tên chỉ chứa khoảng trắng và thời lượng sai. Xác nhận xóa dùng hộp thoại riêng, mặc định focus vào **Giữ lại**. Dropdown cảm giác/chủ đề/bộ lọc có animation mở/đóng, đóng khi bấm ngoài hoặc Esc; hỗ trợ ↑/↓, Home/End, Enter/Space, Tab và gõ để tìm lựa chọn. Giá trị vẫn lưu qua select gốc, nên sửa/reset form và bộ lọc giữ hành vi hiện tại. Trình duyệt hỗ trợ Popover API hiển thị menu ở top layer để không bị các thẻ cắt mất; trình duyệt cũ dùng menu fixed. Giảm chuyển động bỏ các animation này.

## CI/CD với GitHub Actions

Workflow tại `.github/workflows/ci-cd.yml` tự động chạy khi push hoặc mở pull request vào `main`:

1. Tải source code vào máy ảo Ubuntu của GitHub.
2. Cài đúng phiên bản Node.js.
3. Kiểm tra cú pháp JavaScript.
4. Chạy toàn bộ kiểm thử bằng `npm test`.
5. Nếu chạy trên `main`, kiểm thử đạt và repository variable `ENABLE_PAGES` là `true`, đóng gói website rồi triển khai lên GitHub Pages.

Để bật deployment, vào `Settings → Pages`, chọn nguồn `GitHub Actions`; sau đó vào `Settings → Secrets and variables → Actions → Variables`, tạo biến `ENABLE_PAGES` với giá trị `true`. Chạy lại workflow hoặc push một commit mới để xuất bản.

## Chạy dự án

## Kết nối Google Calendar

VibeLog hỗ trợ ghi giờ bắt đầu thực tế và thời lượng của phiên học; giờ kết thúc được tính từ hai thông tin này. Các thống kê dùng ngày bắt đầu học, kể cả khi ghi nhật ký muộn. Nhật ký cũ vẫn được giữ, nhưng cần sửa và bổ sung giờ bắt đầu trước khi gửi lên Google. Không suy đoán giờ học từ giờ tạo nhật ký.

### Thiết lập kết nối lâu dài (làm một lần)

1. Tạo/chọn project trong [Google Cloud Console](https://console.cloud.google.com/) và bật **Google Calendar API**.
2. Trong **Google Auth Platform**, cấu hình Branding, Audience và Data Access. Nếu ứng dụng ở chế độ Testing, thêm tài khoản Google của bạn vào Test users. Thêm scope `https://www.googleapis.com/auth/calendar.events.owned`.
3. Mở OAuth Client ID loại **Web application** đang dùng (không cần tạo project Google mới). Trong **Authorized redirect URIs**, thêm chính xác `http://localhost:4173/api/auth/callback` rồi Save. Có thể giữ Authorized JavaScript origins đã cấu hình trước đó.
4. Sao chép file `.env.example` thành `.env` trong thư mục project. Điền **Client ID** vào `GOOGLE_CLIENT_ID` và **Client Secret** vào `GOOGLE_CLIENT_SECRET`. Hai thông tin này lấy từ OAuth client của Google Cloud. Giữ `APP_URL=http://localhost:4173` và `PORT=4173`. Không gửi Client Secret trong chat hoặc nhập vào giao diện web.
5. Dừng máy chủ cũ bằng `Ctrl + C` rồi chạy `npm start`. Dùng Node.js 24 trở lên. Mở `http://localhost:4173`, nhấn **Kết nối Google Calendar**, chọn tài khoản và cho phép quyền lịch. Google đưa bạn trở lại VibeLog; lịch tự tải.

Ví dụ cấu trúc `.env` (thay hai giá trị đầu bằng thông tin thật trên máy bạn):

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
APP_URL=http://localhost:4173
PORT=4173
```

Đây là luồng đăng nhập mới: kết nối cũ trong trình duyệt không chuyển thành refresh token được, nên cần cấp quyền lại **một lần** sau khi cấu hình. Sau đó reload, đóng/mở trình duyệt hoặc khởi động lại máy chủ vẫn giữ kết nối trên cùng trình duyệt, cùng địa chỉ website. Máy chủ tự gia hạn access token và thử lại một lần khi Google trả lỗi hết hạn. Cookie phiên có thời hạn 180 ngày. Xóa cookie, dùng trình duyệt khác, thay Client ID, xóa dữ liệu kết nối hoặc Google thu hồi quyền sẽ cần kết nối lại. Lỗi mạng tạm thời giữ kết nối để thử lại.

Nếu Google báo **400: redirect_uri_mismatch**, mở **Google Calendar → Thiết lập kết nối Google** trong VibeLog. App hiển thị Client ID và callback thực tế đang dùng, không hiển thị Client Secret. Mở đúng OAuth client có ID đó trong **Google Auth Platform → Clients**, thêm callback vào **Authorized redirect URIs** rồi Save. Không chỉ thêm vào Authorized JavaScript origins; không dùng `https` thay `http`, `127.0.0.1` thay `localhost`, sai cổng hay thêm `/` ở cuối. Nếu có nhiều project/client, kiểm tra ID nguyên văn thay vì chỉ dựa vào tên VibeLog. Nếu đổi Client ID trong `.env`, Client Secret phải thuộc cùng client và cần khởi động lại máy chủ. [Quy định khớp redirect URI của Google](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri-mismatch).

Google giới hạn refresh token của ứng dụng **External / Testing** có quyền Calendar khoảng **7 ngày**. Muốn tránh phải cấp quyền mỗi tuần, xem **Google Auth Platform → Audience → Publish app / In production**; làm theo yêu cầu xét duyệt Google nếu cần. Không có bảo đảm kết nối vĩnh viễn. [Tài liệu thời hạn Google OAuth](https://developers.google.com/identity/protocols/oauth2#expiration).

### Dữ liệu kết nối và triển khai

Google access token và refresh token chỉ được sử dụng ở máy chủ. Dữ liệu phiên lưu bằng AES-256-GCM trong `.vibelog-data/sessions.enc`, khóa ở `.vibelog-data/encryption.key`. Thư mục này tự tạo, phải được giữ khi khởi động lại và chỉ dùng cho **một tiến trình máy chủ**. Không xóa hoặc chia sẻ `.env` và `.vibelog-data`; cả hai đã được loại khỏi Git. Máy chủ chỉ phục vụ tài nguyên app, không cho tải cấu hình, file phiên hay source máy chủ qua web. Mã hóa trên đĩa không thay thế quyền truy cập tài khoản/máy tính: người có cả khóa và dữ liệu vẫn có thể giải mã.

Trình duyệt chỉ giữ cookie HttpOnly/SameSite; không lưu token Google trong localStorage. Nút **Ngắt kết nối** xóa phiên trên máy chủ và thu hồi quyền Google. Nếu Google đang mất mạng, app vẫn ngắt phiên tại máy; giao diện báo cách thu hồi quyền ở Google. Đổi tài khoản sẽ thay phiên sau khi tài khoản mới cấp quyền thành công; hủy đăng nhập vẫn giữ phiên cũ.

Tính năng lâu dài cần máy chủ Node.js và ổ đĩa lưu bền vững, **không chạy bằng GitHub Pages tĩnh**. Workflow Pages vẫn xuất bản giao diện, nhưng phần kết nối Google sẽ báo cần máy chủ. Khi đưa máy chủ lên mạng: dùng HTTPS, đặt `APP_URL` đúng origin (không kèm đường dẫn), thêm `${APP_URL}/api/auth/callback` vào Google Cloud, cấu hình `LISTEN_HOST` nếu nền tảng yêu cầu và giữ `.env`/dữ liệu bên ngoài thư mục public. Cookie tự dùng Secure khi `APP_URL` là HTTPS. Bản hiện tại lưu phiên trên đĩa cho một máy chủ; triển khai nhiều máy cần kho phiên dùng chung.

Trong nhật ký, chọn **Gửi / cập nhật lịch** để tạo hoặc cập nhật sự kiện trên lịch chính của tài khoản đang kết nối. Có thể bật gửi mỗi lần lưu nhật ký. Gửi lại cùng phiên sẽ cập nhật cùng sự kiện, tránh tạo bản trùng. Form **Hẹn buổi học tiếp theo** lưu kế hoạch trên thiết bị và gửi ngay nếu đã kết nối, kèm lời nhắc trước 10 phút. Khi chưa kết nối hoặc gặp lỗi mạng, dữ liệu vẫn được giữ để gửi lại bằng nút trên từng phiên/kế hoạch.

**Lịch của bạn trong tuần** hiển thị các sự kiện trên lịch chính của Google ngay trong app, gồm cả sự kiện tạo ngoài VibeLog. Lưới tuần có bảy cột ngày và trục giờ 00:00–24:00; sự kiện nằm đúng khung giờ, các lịch trùng nhau được chia cột cạnh nhau. Hàng riêng cho sự kiện cả ngày, đánh dấu hôm nay và đường đỏ chỉ giờ hiện tại. Tuần bắt đầu thứ Hai; dùng **Tuần trước**, **Tuần sau**, **Tuần này** để chuyển tuần và **Tải lại** để lấy các thay đổi từ Google. Lịch tự tải sau khi kết nối hoặc gửi/cập nhật buổi học. Bấm một sự kiện để xem chi tiết; bấm ô trống để điền giờ vào form đặt buổi học (chưa gửi lên Google cho đến khi lưu form). Trên điện thoại, cuộn ngang để xem các ngày. Lịch phụ/chia sẻ chưa được hiển thị. Không cần thêm quyền Google; dùng scope `calendar.events.owned` đã cấu hình. Lịch tải từ Google chỉ được hiển thị trong bộ nhớ, không lưu vào localStorage.

Giao diện áp dụng `apple-design-SKILL.md`: font hệ thống, nền trung tính, màu nhấn xanh, thẻ bo góc và thanh công cụ trong mờ; giữ GSAP/Lenis và phản hồi nút bấm. Các tùy chọn giảm chuyển động, giảm trong suốt và tăng tương phản của hệ thống được tôn trọng. Quy tắc giao diện nằm ở `src/apple-design.css`.

Giờ nhập theo múi giờ thiết bị và được chuyển thành thời điểm UTC khi gửi API. Lựa chọn tự gửi và kế hoạch được lưu trên thiết bị. Xóa nhật ký/kế hoạch trong VibeLog chỉ xóa bản trên thiết bị; xóa sự kiện Google trong Google Calendar. Đồng bộ một chiều từ VibeLog; thay đổi trên Google không nhập lại vào nhật ký. File sao lưu nhật ký hiện chưa bao gồm kế hoạch học hoặc thông tin kết nối Google.

Quyền `calendar.events.owned` cho phép quản lý sự kiện trên lịch bạn sở hữu; VibeLog chỉ gọi API với các ID sự kiện do mình tạo. Triển khai công khai có thể cần Google xét duyệt OAuth theo đối tượng và quyền ứng dụng.

Tài liệu: [Google OAuth cho máy chủ web](https://developers.google.com/identity/protocols/oauth2/web-server), [Google Calendar events.insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).

### Chạy tại máy cá nhân

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

