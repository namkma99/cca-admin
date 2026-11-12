# Phòng thi Claude

Trang `/cca` được export cùng website GitHub Pages. API chạy riêng bằng Node >= 22.13, không thêm thư viện. Không có API chấm bài hoặc secret trong Next.js static export.

## Chạy ở máy local

1. `cp .env.cca.example .env.cca.local`
2. `npm run cca:room-secret` tạo mã phòng ngẫu nhiên 144 bit, hash scrypt có salt, và server secret. Chép hai biến môi trường vào `.env.cca.local`; giữ mã phòng riêng để nhập khi đăng ký/reset. Không commit đầu ra lệnh này.
3. `npm run cca:api` chạy API ở `http://localhost:4318`. Nếu không đặt email-provider credentials trong môi trường development, OTP xuất hiện trong terminal API. Không có OTP cố định hoặc API đọc OTP.
4. `npm run dev`, mở `http://localhost:3000/cca`. Frontend development mặc định kết nối API local. Nếu đổi port, đặt `NEXT_PUBLIC_CCA_API_URL` cho Next và origin tương ứng cho API.

Mã phòng không nằm trong GitHub source. Biến `CCA_ROOM_CODE_HASH` chứa salted scrypt verifier, không phải phép mã hóa có thể giải ngược. Mã ngẫu nhiên dài cùng rate limit giảm khả năng dò. Giữ `CCA_SERVER_SECRET` ổn định để định danh email không đổi và hạn mức không bị mất sau restart.

## Triển khai API và GitHub Pages

API cần **một instance**, HTTPS và persistent volume cho SQLite; không dùng filesystem tạm thời hoặc nhiều replica độc lập. Có thể chạy container trên VPS hoặc dịch vụ hỗ trợ persistent disk. Đặt các secret trong secret manager của host; nếu triển khai qua GitHub Actions, lấy từ GitHub Actions Secrets và chỉ chuyển đến môi trường API.

```sh
docker build -f services/cca-api/Dockerfile -t devpro-cca-api .
docker volume create devpro-cca-data
docker run -d --name devpro-cca-api --restart unless-stopped \
  --env-file .env.cca.local -e NODE_ENV=production -e HOST=0.0.0.0 \
  -e CCA_DATABASE_PATH=/data/exams.sqlite \
  -v devpro-cca-data:/data -p 127.0.0.1:4318:4318 devpro-cca-api
```

Trước khi chạy production, thay các biến trong file environment:

| Biến                  | Giá trị                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `CCA_ALLOWED_ORIGINS` | Origin HTTPS chính xác của website; có thể phân cách nhiều origin bằng dấu phẩy, không có path hoặc dấu `/` cuối |
| `CCA_ROOM_CODE_HASH`  | Salted verifier từ lệnh tạo mã phòng                                                                             |
| `CCA_SERVER_SECRET`   | Chuỗi ngẫu nhiên tối thiểu 32 ký tự, giữ nguyên qua các lần deploy                                               |
| `RESEND_API_KEY`      | API key gửi email của Resend                                                                                     |
| `CCA_EMAIL_FROM`      | Địa chỉ gửi thuộc domain đã xác minh, ví dụ `DevPro <exam@your-domain.example>`                                  |
| `CCA_TRUST_PROXY`     | `1` nếu reverse proxy đáng tin ghi đè `X-Forwarded-For`; còn lại để `0`                                          |

Đặt reverse proxy có TLS trước port 4318, tắt cache cho API, forward Authorization và Origin. Dịch vụ từ chối khởi động production nếu thiếu secret, email delivery hoặc origin HTTPS. API không tự tạo mã dự phòng.

Trong GitHub repository → Settings → Secrets and variables → Actions → **Variables**, đặt `NEXT_PUBLIC_CCA_API_URL=https://your-api-domain.example` (không có `/v1`). Workflow Pages đã đọc biến này lúc build. Đây là địa chỉ công khai, không phải secret. Rebuild Pages sau khi đổi URL.

Không đặt room code, verifier, OTP, email-provider key hoặc server secret vào biến `NEXT_PUBLIC_*`. Nếu chưa có API URL, trang hiển thị chưa mở phòng thi và khóa đăng ký; không chuyển sang chấm điểm giả ở client.

Không có host API, credentials hoặc quyền triển khai được cấu hình trong lần triển khai mã nguồn này; cần cung cấp các thiết lập trên để kích hoạt production.

## Quy tắc đề và kết quả

- Mỗi email được xác thực bằng OTP 6 chữ số, hiệu lực 5 phút, tối đa 5 lần thử. Token chỉ ở RAM, hết hạn sau 8 giờ. Đăng nhập mới thu hồi token cũ và kết thúc bài đang làm của email đó.
- Mỗi chủ đề có 10 đề và 10 lượt trong một chu kỳ reset. Bắt đầu dùng ngay một lượt. Đóng trang, F5, bỏ bài hoặc hết giờ không hoàn lượt.
- Số câu theo cấu hình: CCA-F 60, CCAO-F 60, CCAR-P 63; thời gian 120 phút. Nguồn tham khảo: [CCA-F](https://anthropic-partners.skilljar.com/claude-certified-architect-foundations-certification), [CCAO-F](https://anthropic-partners.skilljar.com/claude-certified-associate-foundations-certification), [CCAR-P](https://anthropic-partners.skilljar.com/claude-certified-architect-professional-certification). Kiểm tra lại guide trước khi áp dụng một phiên bản kỳ thi mới.
- 10 đề được random theo từng thí sinh/chu kỳ, không lặp câu trong một đề. Tổng 10 đề bao phủ 100% câu **hợp lệ**; tần suất mỗi câu chênh tối đa 1. Phân bố theo domain và độ khó chưa được hiệu chỉnh vì tài liệu không có metadata này.
- Có 459 dòng nguồn, 456 câu hợp lệ. CCAR-P câu 37, 136, 138 bị loại do thiếu nội dung tương tác/hình ảnh; câu 37 thiếu cả đáp án. Không suy đoán hoặc bổ sung đáp án. CCA-F chỉ có câu một đáp án nên chưa tái hiện được tỷ lệ câu nhiều đáp án của kỳ thi thật.
- Đáp án theo cột D của Excel, chưa thẩm định lại nội dung chuyên môn. Câu nhiều đáp án chỉ được điểm khi khớp toàn bộ tập đáp án; không chấm điểm thành phần. Câu sai và câu chưa trả lời đều 0 điểm, nhưng báo cáo riêng.
- Hiển thị tỷ lệ đúng và điểm **mô phỏng** `round(100 + 900 × correct / total)`. Mốc 720 chỉ để tham khảo. Không tuyên bố đạt chứng chỉ: [điểm chính thức](https://anthropic-partners.skilljar.com/page/faq-certifications) có hiệu chỉnh giữa các đề, không thể suy ra từ tỷ lệ đúng đơn thuần.

## Lưu trữ và rời trang

localStorage chỉ chứa tối đa 30 summary (10/chủ đề), dưới key chung `devpro:cca:results`, không chứa định danh thí sinh. Các trường là mã lượt, chủ đề, số đề, tổng câu, số đúng/sai/bỏ trống, tỷ lệ, điểm mô phỏng, lý do kết thúc và thời điểm. Danh tính, mã phòng, token, câu hỏi, lựa chọn và flags không được ghi vào localStorage/sessionStorage/IndexedDB. Không xóa dữ liệu của tính năng khác. Đăng nhập thành công thay cache bằng lịch sử chính xác từ máy chủ của email vừa xác thực; không dùng cache để xác định danh tính hay cấp lượt.

Popup F5/đóng tab dùng `beforeunload` do trình duyệt kiểm soát: không tùy chỉnh được nội dung, có thể không hiện nếu chưa tương tác hoặc trên một số thiết bị. Không xóa bài ở `beforeunload`, vì người dùng có thể hủy. Chỉ khi thực sự rời trang (`pagehide`) mới gửi abandon bằng keepalive. Điều hướng link và Back có xác nhận riêng. Khôi phục từ bfcache không khôi phục phòng đang thi.

Không thể bảo đảm request cuối cùng được gửi khi OS kill trình duyệt/mất mạng. API đã tiêu thụ lượt lúc bắt đầu và deadline vẫn chạy; timer máy chủ tự kết thúc bài. Lần đăng nhập tiếp theo đóng bài đang mở nếu còn. Không dừng đồng hồ khi chuyển tab hoặc mất mạng. Đáp án chưa được API xác nhận lưu có thể không được chấm nếu người dùng thoát hoặc mất mạng tới hết giờ; UI hiển thị số câu chưa lưu và tự thử lại.

API chỉ giữ snapshot câu hỏi và lựa chọn khi bài đang diễn ra. Khi nộp/hết giờ/bỏ bài, API xóa snapshot và lựa chọn, giữ summary. Không lưu lịch sử từng câu sau bài thi. SQLite WAL/backup có thể còn các trang cũ cho tới khi được checkpoint/ghi đè; đây là xóa ở mức ứng dụng, không phải cam kết xóa forensic. Bảo vệ volume và backup. Session và OTP hết hạn được dọn định kỳ.

Reset yêu cầu xác nhận và nhập lại mã phòng, xóa kết quả/lượt/seed của đúng thí sinh và chủ đề ở cả server và localStorage. Khôi phục đủ 10 lượt, tạo 10 form mới. Vì người dùng được quyền tự reset, hạn mức là **10 lượt mỗi chu kỳ reset**, không phải hạn mức vĩnh viễn.

## Kiểm thử

```sh
npm run test:cca
npm run typecheck
npm run lint
npm run test:cca:e2e
npm run build
```

Playwright chạy API SQLite thật và Chrome, không mock API. Fixture gửi OTP vào `.local/cca-e2e` để kiểm thử; file fixture/test không được copy vào production Docker image. Cài Google Chrome hoặc bỏ `channel: 'chrome'` trong config và dùng Chromium của Playwright. Kiểm thử deadline dùng clock được inject vào fixture; production không có endpoint sửa clock.

Sao lưu SQLite bằng online backup hoặc dừng instance trước khi sao chép cả database/WAL; kiểm tra restore. Không xóa volume hoặc đổi server secret khi chỉ cập nhật mã nguồn.
