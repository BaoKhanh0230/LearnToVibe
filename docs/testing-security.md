# Kiểm thử và bảo mật VibeLog: thực hành trước khi đi làm

## Trạng thái và phạm vi kiểm chứng

Đây là báo cáo về mã nguồn, không phải chứng nhận website an toàn tuyệt đối. 60 kiểm thử tự động đã đạt khi hoàn tất phần rà soát này. `npm audit --omit=dev --audit-level=high` trả về 0 lỗ hổng đã biết trong dependency production ở thời điểm chạy. Cần đọc báo cáo CI của commit tương ứng để biết kết quả trên GitHub.

Database được kiểm thử bằng `pg-mem`, Google API được giả lập trong kiểm thử máy chủ. Chưa có bằng chứng từ PostgreSQL Neon thật, Render thật hoặc đăng nhập Google trên domain mới. Chỉ khi deployment có trạng thái live và các bước nghiệm thu dưới đây đạt mới gọi là đã kiểm thử bản triển khai. `/healthz` kiểm tra tiến trình HTTP đang sống; nó không chứng minh Google hoặc database đang hoạt động.

## Kiểm thử chức năng: điều gì phải hoạt động?

| Lớp kiểm thử | Ví dụ thực tế trong VibeLog | Nó phát hiện gì? |
|---|---|---|
| Unit: một hàm nhỏ | Tính giờ kết thúc, kiểm tra duration, tạo ID sự kiện ổn định | Sai phép tính, sai timezone, dữ liệu đầu vào ngoài phạm vi |
| Integration: nhiều thành phần | HTTP → OAuth → kho phiên → giả lập Google | Sai cookie, sai API, lỗi lưu/đọc phiên hoặc refresh token |
| Persistence | Tạo lại server/store rồi đọc phiên cũ | Mất kết nối sau restart, xóa nhầm phiên của người khác |
| Regression | Giữ các test local, Pages và form cũ | Sửa bản cloud nhưng làm hỏng một tính năng đã chạy |
| E2E trên môi trường thật | Đăng nhập Google, refresh, xem tuần, đặt lịch, restart | Sai callback, cấu hình hosting, popup bị chặn, lỗi chỉ xuất hiện trên browser |

Test đầu vào đúng chưa đủ. Test đầu vào sai và tình huống lỗi cũng cần có: thiếu quyền, token hết hạn, người dùng hủy popup, Google trả 401, mạng lỗi, JSON sai và thời gian không hợp lệ. Một test tốt nên thất bại nếu bỏ cơ chế bảo vệ mà nó đang kiểm tra.

Ví dụ: gửi lại cùng một buổi học phải cập nhật cùng sự kiện. Test kiểm tra ID không đổi và chỉ tạo sau khi Google trả 404; khi API trả 403, app không được hiểu nhầm thành "chưa có sự kiện" và tạo một bản mới.

## Kiểm thử bảo mật: ai được phép làm gì?

| Cơ chế đã có/đã bổ sung | Bằng chứng trong test | Ý nghĩa |
|---|---|---|
| Phiên riêng theo cookie | Cookie của người thứ hai có phiên khác; người không có cookie nhận 401 | Tránh dùng chung một tài khoản Google cho mọi người |
| Cookie HttpOnly, Secure khi HTTPS, SameSite=Lax | Kiểm tra header trên cấu hình origin HTTPS | JavaScript không đọc cookie; gửi cookie qua HTTPS; giảm nguy cơ yêu cầu từ website khác |
| Kiểm tra Host, Origin, request marker, CSRF | Host lạ, Origin lạ, thiếu/sai CSRF bị từ chối | Website khác không được lợi dụng cookie của bạn để ghi/xóa kết nối |
| OAuth state, cookie trình duyệt, PKCE | Callback thiếu cookie/sai state/phát lại bị chặn | Gắn kết quả cấp quyền với đúng lượt đăng nhập, đúng trình duyệt |
| Token chỉ được máy chủ dùng trong luồng Node | Response trạng thái không chứa Client Secret/access token/refresh token | Tránh đưa thông tin cho phép truy cập Google xuống frontend |
| AES-256-GCM, khóa ngoài database, ID phiên làm AAD | Đổi khóa, đổi ID hoặc sửa một byte đều không giải mã được | Bảo vệ thông tin kết nối trong database và phát hiện dữ liệu bị sửa |
| SQL có tham số `$1`, `$2` | Kiểm thử thao tác store với SQL thực thi trong `pg-mem`; review truy vấn | Dữ liệu người dùng không được nối vào câu SQL |
| Cập nhật phiên có điều kiện | Refresh đang chạy không tái tạo phiên đã ngắt | Tránh race condition làm người dùng "đăng nhập lại" sau khi logout |
| Validation ở máy chủ và danh sách trường cho phép | Giờ/duration/reminders sai bị từ chối; attendees và metadata lạ bị loại | Không dựa vào form frontend để bảo vệ API; không làm proxy cho mọi tính năng Google |
| Body tối đa 64 KiB | Body lớn nhận 413; Google không được gọi | Giới hạn bộ nhớ và lượng dữ liệu API xử lý |
| Chỉ phục vụ tài nguyên public | `.env`, `.git`, file phiên và source server nhận 404 | Tránh tải bí mật bằng một URL đoán được |
| HSTS, chống iframe, nosniff, Permissions-Policy | Test header trả đúng trên cấu hình HTTPS | Yêu cầu browser dùng HTTPS cho lần sau, hạn chế clickjacking/MIME sniffing và các quyền thiết bị app không dùng |

HttpOnly không chữa mọi lỗi XSS: mã JavaScript độc hại vẫn có thể gọi API trong trang. Mã hóa database cũng không bảo vệ khi cả máy chủ và khóa bị chiếm. Bảo mật cần nhiều lớp; xem [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) và [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html).

## Dependency, CI và bí mật

CI dùng `npm ci` để cài đúng lockfile, kiểm tra cú pháp, chạy test và audit dependency production. Audit mức High/Critical có thể làm CI thất bại để ngăn Pages xuất bản. Một báo cáo audit sạch chỉ có nghĩa không có cảnh báo phù hợp trong database advisory ở lúc quét; nó không chứng minh code ứng dụng hoặc các file vendor JavaScript đều an toàn.

Đã thêm `.github/dependabot.yml` để GitHub kiểm tra cập nhật npm và GitHub Actions hàng tuần rồi mở PR. PR cập nhật cần xem thay đổi và chạy test; không bật tự merge. [Tài liệu Dependabot](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).

Render auto-deploy có thể chạy độc lập với GitHub Actions. Không coi trạng thái CI xanh là một deployment gate cho Render nếu chưa cấu hình Render chỉ deploy sau CI. Trước khi xuất bản thật cần xác nhận thiết lập này hoặc deploy thủ công commit đã đạt CI.

`.env` và `.vibelog-data` bị loại khỏi Git. Kiểm tra artifact Pages chỉ có tài nguyên công khai; có thể so sánh giá trị bí mật đang cấu hình với file đã track/artifact mà không in giá trị ra terminal. Đây không thay thế quét lịch sử Git. Nếu lỡ commit bí mật, phải thu hồi/đổi bí mật đó; chỉ xóa file trong commit tiếp theo là chưa đủ.

Client ID là thông tin công khai của luồng Google trên browser. Client Secret, database password, encryption key và token người dùng mới là những dữ liệu cần giữ bí mật.

## Nghiệm thu sau khi Render và Neon đã triển khai

Chỉ thực hiện trên ứng dụng và tài khoản thử nghiệm do bạn kiểm soát. Không chạy quét tấn công vào Google, website người khác hoặc lịch thật của người dùng.

1. Kiểm tra Render plan là Free, deploy trạng thái live, đúng commit; root và `/healthz` trả 200. Kiểm tra log lỗi sau startup; không sao chép log chứa cookie, authorization code hoặc token vào chat.
2. Kiểm tra `/api/auth/status` trả JSON; chưa có cookie phải `connected:false`. `/api/calendar/events` chưa đăng nhập phải 401. Các URL `.env`, `.git/config`, `scripts/server.mjs` và file phiên phải 404.
3. Kiểm tra HTTPS và các header, rồi đăng ký callback đúng domain trong Google Cloud. Client Secret, DATABASE_URL và khóa mã hóa phải có ở cấu hình server, không có ở JavaScript frontend hoặc build log.
4. Đăng nhập bằng tài khoản Google thử nghiệm, xem lịch. Trong DevTools → Application/Storage → Cookies, kiểm tra HttpOnly, Secure, SameSite và không có token Google trong localStorage.
5. Tạo một buổi học có tên dễ nhận biết, kiểm tra giờ/múi giờ trên Google. Gửi lại, xác nhận cập nhật cùng sự kiện và không trùng. Tự xóa sự kiện thử sau nghiệm thu.
6. Refresh rồi đóng/mở tab: lịch tự tải. Trigger restart/deploy Render: cookie cũ vẫn khôi phục phiên, database còn dữ liệu mã hóa. Lần truy cập sau khi Render ngủ có thể chậm.
7. Dùng trình duyệt/profile khác và tài khoản Google khác: mỗi người chỉ xem lịch tài khoản mình. Đổi tài khoản trên cùng trình duyệt là thao tác có chủ đích; nhật ký localStorage vẫn thuộc thiết bị, chưa được phân vùng theo tài khoản.
8. Ngắt kết nối: reload và restart không được khôi phục phiên đã ngắt. Google thu hồi quyền phải yêu cầu kết nối lại; lỗi mạng tạm thời không làm mất nhật ký/kế hoạch.
9. Ghi kết quả kèm commit, thời điểm, môi trường, expected/actual. Nếu một bước lỗi, lưu bằng chứng đã che bí mật, sửa rồi kiểm tra lại đúng phạm vi lỗi.

## Những việc chưa được triển khai

Chưa có E2E browser tự động, quét toàn bộ lịch sử Git bằng Gitleaks, SAST/DAST, penetration test, CSP được thử trên browser, distributed rate limiting, backup/restore drill hoặc theo dõi sự cố tự động. Các thư viện vendor nằm trong `src/vendor` không được `npm audit` kiểm tra. OAuth pending state vẫn trong bộ nhớ một tiến trình; restart giữa lượt cấp quyền yêu cầu thử lại. Chưa hỗ trợ nhiều process/replica phối hợp refresh token.

Cookie hiện có hạn tối đa 180 ngày để phục vụ nhu cầu ghi nhớ; chưa có idle timeout hoặc xác thực lại trước thao tác nhạy cảm. Trong hệ thống nhạy cảm, cần chính sách phiên ngắn hơn và đánh giá riêng. Production cần tách quyền database migration khỏi quyền runtime; hiện startup tạo bảng nếu thiếu nên role kết nối vẫn cần quyền tạo bảng. Khóa mã hóa cần được giữ ổn định; chưa có cơ chế xoay khóa nhiều phiên bản.

Không suy ra tuân thủ ISO/SOC 2 hoặc bất kỳ tiêu chuẩn nào chỉ từ những kiểm tra ở trên. [OWASP ASVS](https://owasp.org/projects/asvs) là bộ yêu cầu giúp xác định phạm vi kiểm chứng kỹ thuật.

## Ở doanh nghiệp thường khác thế nào?

Mức độ tùy sản phẩm, dữ liệu và quy mô; một công cụ nội bộ nhỏ khác hệ thống thanh toán. Các yêu cầu thường tăng khi nhiều người phát triển và nhiều người dùng phụ thuộc vào dịch vụ.

| VibeLog đang học | Hệ thống có yêu cầu vận hành cao hơn |
|---|---|
| Một người phát triển, push main theo yêu cầu | PR review, branch protection, bắt buộc CI, người chịu trách nhiệm release |
| Google giả lập và PostgreSQL mô phỏng | Integration trên PostgreSQL thật, E2E trên staging với dữ liệu đã làm sạch |
| Một máy chủ Free có thể ngủ | Định nghĩa uptime, timeout, capacity; load test và nhiều instance nếu cần |
| Secrets trong environment của hosting | Secret manager/KMS, phân quyền theo vai trò, audit truy cập, xoay khóa |
| Schema tạo khi startup | Migration có phiên bản, test trên branch riêng, kế hoạch rollback; runtime role quyền tối thiểu |
| Kiểm thử bảo mật trong code | Threat modeling, SAST, SCA, secret scanning, DAST, pentest theo rủi ro |
| Logs lỗi cơ bản | Metrics, tracing, alert có người trực, quy trình ứng phó sự cố |
| Database giữ dữ liệu | Backup theo lịch và diễn tập khôi phục; mục tiêu RPO/RTO cụ thể |

RPO là lượng dữ liệu có thể mất khi sự cố; RTO là thời gian có thể ngừng dịch vụ để khôi phục. "Có backup" chưa đủ nếu chưa từng thử restore. Tương tự, coverage 90% chưa chứng minh phân quyền đúng: vẫn cần các test người A không được đọc/sửa dữ liệu của người B.

## Lộ trình học bằng chính dự án này

### Bước 1: HTTP và đọc bằng chứng

Học request/response, GET/POST/PATCH, status 200/400/401/403/404/413/500, headers, HTTPS và JSON. Mở DevTools Network, quan sát `/api/auth/status`; biết phân biệt lỗi server trả HTML với lỗi Google OAuth. Dùng `curl` hoặc Postman để gửi request và đọc response.

### Bước 2: Viết test nhỏ và test lỗi

Đọc `test/calendar-validation.test.mjs`, thêm trường hợp end trước start và duration ngoài giới hạn. Chạy `npm test`, cố ý bỏ validation để thấy test thất bại, rồi phục hồi. Bắt đầu bằng [Node test runner](https://nodejs.org/api/test.html); khi làm framework khác có thể học Jest/Vitest theo team.

### Bước 3: Auth và phân quyền

Phân biệt authentication (bạn là ai), authorization (bạn được làm gì), cookie phiên và Google access token/refresh token. Đọc luồng state/PKCE; thử case sai CSRF ở test. Học XSS, CSRF, SQL injection và IDOR; dùng OWASP Cheat Sheets để hiểu cơ chế, không chỉ ghi nhớ tên lỗi.

### Bước 4: Test trên browser và database thật

Học [Playwright](https://playwright.dev/docs/intro) để mở app, điền form, bấm nút và kiểm tra UI. Mock Google cho CI; giữ một bài smoke test đăng nhập thật trên staging thay vì cố vượt CAPTCHA/MFA. Học PostgreSQL, parameterized queries, transactions và migration. Tạo môi trường test riêng; không dùng dữ liệu lịch người dùng thật.

### Bước 5: CI và supply chain

Học Git branch/PR, đọc log GitHub Actions, `npm ci`, lockfile và `npm audit`. Theo dõi một PR Dependabot và kiểm tra breaking change trước merge. Học [Gitleaks](https://github.com/gitleaks/gitleaks) để quét bí mật trong Git; học SAST như CodeQL/Semgrep khi hiểu rõ loại lỗi cần tìm.

### Bước 6: Kiểm thử runtime và vận hành

Học [OWASP ZAP](https://www.zaproxy.org/docs/) trên staging/lab của bạn; bắt đầu bằng passive scan. Active scan có thể gửi payload, tạo/xóa dữ liệu hoặc tăng tải, nên cần xác định phạm vi trước. Sau đó học log đã che bí mật, metrics, alerts, Docker và diễn tập restart/restore. Dùng dashboard Render/Neon để nối triệu chứng trên UI với lỗi ở server/database.

Bạn chưa cần biết mọi công cụ trước ngày đi làm. Kỹ năng nền tảng là đọc được bằng chứng, viết test cho lỗi vừa gặp, biết giới hạn của một kết quả "pass", và không đưa bí mật vào Git/log/chat. Khi dùng AI tạo code, vẫn cần đọc diff và kiểm chứng các giả định về quyền truy cập, dữ liệu và môi trường deploy.
