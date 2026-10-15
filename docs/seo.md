# Bài học SEO cho VibeLog — 15/10/2026

## Từ website đến kết quả tìm kiếm

Vercel phục vụ website/API; Supabase giữ dữ liệu phiên kết nối Google. Render/Neon là nền tảng cũ được giữ trong thời gian chuyển đổi. Google Search là một hệ thống khác: bot phải tìm thấy URL, đọc trang (crawl), quyết định lưu vào chỉ mục (index), rồi xếp hạng theo truy vấn. Deploy thành công không tự bảo đảm được lập chỉ mục hoặc đứng đầu.

Mục tiêu đầu tiên: tìm được VibeLog bằng tên và công dụng, ví dụ “VibeLog nhật ký học tập”. Những cụm rộng như “ứng dụng học tập” cần thêm nội dung hữu ích, sự tin cậy và thời gian cạnh tranh.

## Đã triển khai trong mã nguồn

- Địa chỉ ưu tiên: https://vibelog-baokhanh.vercel.app/.
- `index.html`: tiêu đề, mô tả, giới thiệu công dụng hiển thị trong HTML gốc, canonical trỏ về Vercel và thẻ xác minh Search Console do chủ tài khoản cung cấp. Tiêu đề/mô tả là gợi ý; Google có thể chọn cách hiển thị khác.
- Open Graph cung cấp tên/mô tả khi chia sẻ link; đây không phải cam kết tăng hạng tìm kiếm.
- `robots.txt`: cho phép đọc nội dung công khai và chỉ vị trí sitemap; không thu thập `/api/` và `/healthz`.
- `sitemap.xml`: chỉ chứa trang chủ công khai. Các phần `#new-entry` hay `#study-calendar` trên cùng trang không phải những trang riêng để thêm vào sitemap. Không khai báo ngày cập nhật giả.
- Máy chủ phục vụ đúng MIME cho hai file SEO, hỗ trợ GET/HEAD, giữ danh sách tài nguyên công khai được phép. API/health còn trả `X-Robots-Tag: noindex`.
- Build GitHub Pages giữ canonical về Vercel. Canonical là tín hiệu ưu tiên, Google vẫn tự chọn bản chính. `robots.txt` ở đường dẫn repository Pages không có hiệu lực cho cả host GitHub Pages; khai báo robots tại gốc host mới có hiệu lực.

`robots.txt` không phải khóa bảo mật. Bot bị chặn crawl sẽ không đọc được `noindex` trên phản hồi; không dựa vào cặp chỉ dẫn này để bảo vệ dữ liệu. Calendar vẫn yêu cầu phiên và quyền truy cập; nhật ký hiện lưu trong trình duyệt. Sitemap chỉ giới thiệu trang chủ, không xuất dữ liệu cá nhân.

## Thực hành Search Console

1. Vào https://search.google.com/search-console bằng tài khoản Google của bạn.
2. Thêm tài sản loại **URL prefix / Tiền tố URL**: `https://vibelog-baokhanh.vercel.app/`. Với domain do Vercel cấp, dùng cách này vì bạn không quản lý DNS của `vercel.app`.
3. Chọn **HTML tag / Thẻ HTML**. Thêm property URL prefix mới cho địa chỉ Vercel. Thẻ cũ của property Render vẫn có trong source, nhưng không mặc định dùng được cho property mới: lấy đúng thẻ Google hiển thị cho URL Vercel rồi thêm vào source trước khi Verify. Giữ thẻ của các chủ sở hữu đang cần dùng.
4. Sau xác minh, vào **Sitemaps / Sơ đồ trang web**, gửi `https://vibelog-baokhanh.vercel.app/sitemap.xml` (hoặc `sitemap.xml` nếu giao diện đã điền sẵn tiền tố).
5. Mở **URL Inspection / Kiểm tra URL**, nhập URL trang chủ; chạy **Test live URL / Kiểm tra URL đang hoạt động**. Nếu trang truy cập được và phù hợp lập chỉ mục, chọn **Request indexing / Yêu cầu lập chỉ mục**. Không cần gửi lặp lại liên tục.
6. Theo dõi **Page indexing / Lập chỉ mục trang** để biết Google đã index chưa hoặc lý do chưa index. Trong **Performance / Hiệu suất**, xem impressions (lượt hiển thị), clicks (lượt nhấp), queries (cụm từ tìm kiếm), CTR (nhấp/hiển thị). Dữ liệu không xuất hiện ngay; thời gian crawl có thể từ vài ngày đến vài tuần và không bảo đảm index.

Giữ nguyên thẻ xác minh sau khi thành công vì Google có thể kiểm tra lại. Kết nối Calendar không tự cấp quyền Search Console; xác minh Search Console cũng không xuất bản hay xét duyệt ứng dụng OAuth. Những giới hạn Test users/Testing của Google Auth vẫn cần xử lý riêng nếu muốn người ngoài dùng Calendar.

Có thể thử `site:vibelog-baokhanh.vercel.app` hoặc “VibeLog nhật ký học tập” trên Google, nhưng `site:` không phải báo cáo đầy đủ. URL Inspection là nơi kiểm tra trạng thái cụ thể. Sitemap chỉ giúp khám phá URL, không bảo đảm index hoặc tăng hạng.

## Bước tiếp theo khi có dữ liệu

Viết hướng dẫn công khai có ích cho người mới: ghi phiên học đầu tiên, đặt mục tiêu tuần, kết nối Calendar. Mỗi trang mới cần URL thật, tiêu đề rõ, liên kết truy cập được và nội dung riêng. Không nhồi từ khóa, mua liên kết hoặc xuất nhật ký người dùng để tạo nội dung SEO. Chia sẻ website trong nơi phù hợp giúp người dùng và công cụ tìm kiếm biết đến sản phẩm.

## Nguồn chính thức

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://support.google.com/webmasters/answer/9008080
- https://support.google.com/webmasters/answer/10267942
