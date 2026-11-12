# Thiết kế CCA API và Admin trên Vercel

Cập nhật ngày 2026-11-12. Tài liệu mô tả nghiệp vụ và chuyển đổi từ API SQLite sang Next.js trên Vercel và Neon. Đã có scaffold Next.js và schema/migration 8 bảng; chưa triển khai nghiệp vụ auth/API/admin hoặc migrate Neon. Đã chốt cấu trúc 8 bảng và hướng triển khai gọn cho khoảng 10 user, sử dụng không thường xuyên. Chi tiết còn cần xác nhận được ghi riêng, không coi là đã duyệt.

- [Kiến trúc, công nghệ và structure](architecture.md).
- [Schema 8 bảng và relationship](database-design.md).

## Thành phần và quyền truy cập

- GitHub Pages: giao diện CCA tại `/cca`; các trang hiện tại khác vẫn công khai.
- Một project Vercel: giao diện admin và API. Có thể dùng cùng hostname, ví dụ `cca-admin.dev-pro.online`, với API dưới `/api`. Đây là ví dụ; cần xác nhận domain thực tế.
- Neon PostgreSQL: tài khoản, phiên đăng nhập, ngân hàng câu hỏi, chu kỳ và kết quả thi.
- Frontend CCA và Vercel nên dùng HTTPS trên cùng domain gốc để tránh phụ thuộc cookie bên thứ ba. CORS cho phép chính xác origin frontend, cho phép credentials; frontend gửi credentials khi gọi API.
- Mọi API thi yêu cầu phiên hợp lệ. Mọi API quản lý user cần kiểm tra thêm quyền admin tại máy chủ; ẩn nút trên UI không thay thế kiểm tra quyền.

## Luồng kích hoạt lần đầu được đề xuất

Admin cấp trước username và mật khẩu tạm ngẫu nhiên riêng cho từng người. Database chỉ lưu hash. Người dùng đăng nhập đúng mật khẩu tạm mới được chuyển sang bước đặt mật khẩu chính thức.

1. User ở trạng thái `pending_password` nhập username và mật khẩu tạm.
2. API kiểm tra thông tin và cấp phiên ngắn loại `password_setup`, đề xuất 10 phút. Phiên này không được lấy câu hỏi hoặc gọi API admin.
3. UI hiển thị mật khẩu mới và xác nhận mật khẩu.
4. API cập nhật hash và trạng thái trong transaction, thu hồi phiên ngắn, cấp mã phiên mới có hiệu lực 24 giờ.
5. Các lần đăng nhập sau dùng mật khẩu chính thức.

Không cho phép chỉ nhập một username chưa từng đăng nhập rồi tự đặt mật khẩu. Không sử dụng `last_login_at IS NULL` thay cho bằng chứng sở hữu tài khoản.

Nếu cần khôi phục mật khẩu khi không có OTP/email, đề xuất admin cấp lại mật khẩu tạm và thu hồi các phiên cũ. Phương án này cùng quyền reset lượt thi cần được chốt trước khi thực hiện.

## Database đã chốt: 8 bảng

Schema, khóa ngoại, index và relationship được quản lý tập trung trong [database-design.md](database-design.md):

1. `users`
2. `auth_sessions`
3. `questions`
4. `exam_cycles`
5. `exam_attempts`
6. `exam_attempt_payloads`
7. `rate_limits`
8. `admin_audit_logs`

Không thêm `question_bank_versions` ở bản đầu. Ngân hàng cố định theo phiên bản; không sửa/import đè trong khi còn chu kỳ hiện hành. Dữ liệu tạm của bài thi nằm riêng trong `exam_attempt_payloads`, không trộn với kết quả tổng hợp.

## UI CCA

- Trước khi hiển thị danh sách đề, gọi API kiểm tra phiên và hiển thị trạng thái chờ, tránh chớp nội dung đã đăng nhập.
- Chưa có phiên: khung username/password đồng bộ UI hiện tại, hỗ trợ sáng/tối, điện thoại, hiện/ẩn mật khẩu và trạng thái lỗi/chờ.
- Chờ đặt mật khẩu: khung riêng nhập mật khẩu mới và xác nhận. Chỉ mở sau khi xác thực mật khẩu tạm.
- Đã đăng nhập: hiển thị ba chủ đề, lượt còn lại và kết quả tổng hợp.
- Các trang ngoài CCA không bị chuyển đến đăng nhập.
- Không có đăng ký công khai. Cách cấp quyền truy cập là admin tạo user.

Phiên đăng nhập 24 giờ tách biệt với phiên làm bài 120 phút. Theo hướng đề xuất, F5/rời phòng vẫn kết thúc bài sau khi xác nhận nhưng giữ đăng nhập; cookie không tự mất khi F5. Trước khi bắt đầu bài có thể yêu cầu đăng nhập lại nếu thời gian phiên còn lại không đủ làm bài; cần xác nhận hành vi này.

## UI Admin

Người dùng yêu cầu bổ sung màn hình admin quản lý user trên Vercel. Phạm vi ban đầu đề xuất:

- Đăng nhập bằng tài khoản có role admin.
- Danh sách và tìm kiếm user, trạng thái và thời điểm đăng nhập.
- Cấp user kèm mật khẩu tạm, không hiển thị password_hash.
- Khóa/mở quyền truy cập và thu hồi phiên.
- Cấp lại mật khẩu tạm khi cần khôi phục tài khoản.

Đã chốt lưu lịch sử thao tác trong `admin_audit_logs`; chưa bao gồm màn hình tra cứu log. Quyền sửa username, đổi role và reset lượt thi cần được xác nhận. Chưa mặc định xây thêm quản lý câu hỏi, báo cáo hoặc dashboard thống kê. Tài khoản admin đầu tiên có thể cấp bằng script riêng, không có endpoint đăng ký admin công khai.

## Quy tắc thi kế thừa

- Ba chủ đề, 10 đề và tối đa 10 lượt mỗi user/chủ đề trong một chu kỳ.
- CCA-F và CCAO-F 60 câu; CCAR-P 63 câu. Mỗi bài 120 phút.
- 10 đề bao phủ các câu hợp lệ, không lặp câu trong cùng một đề, tần suất giữa các câu được cân bằng.
- Backend kiểm tra `expires_at` trên mọi thao tác và chấm điểm. Bài hết hạn được finalize khi có request tiếp theo hoặc Cron hằng ngày. Vercel Hobby không bảo đảm chạy tác vụ đúng phút hết hạn; summary và việc xóa dữ liệu tạm có thể trễ nếu trình duyệt đã đóng, nhưng không nhận đáp án sau deadline. Không dùng setInterval chạy thường trực trong Vercel Function.
- Câu nhiều đáp án chỉ được điểm khi khớp toàn bộ tập đáp án. Giữ đúng/sai/bỏ trống riêng.
- Điểm thang 100–1000 là mô phỏng, không tương đương quy đổi điểm chứng chỉ chính thức.
- Browser storage chỉ lưu kết quả tổng hợp; không lưu cookie token, password, câu hỏi hoặc lựa chọn chi tiết.
- Nội dung đã hiển thị vẫn có thể đọc bằng DevTools hoặc chụp lại. Bảo vệ ngân hàng còn lại và đáp án bằng xác thực, quyền truy cập, giới hạn lượt và rate limit.

## Kế hoạch chuyển đổi

1. Chốt cấp mật khẩu tạm lần đầu, quyền admin, reset và hành vi phiên hết hạn.
2. Tạo cấu trúc project Vercel có API và UI admin, tách khỏi static export của next-pro.
3. Tạo migration Neon và công cụ cấp admin/user ban đầu; import câu hỏi từ data/question-bank.json, kiểm tra số lượng và đáp án.
4. Chuyển lớp lưu trữ SQLite sang PostgreSQL, bảo vệ giao dịch và ràng buộc đồng thời.
5. Thay OTP/Bearer token bằng password, phiên đặt mật khẩu và HttpOnly cookie. Bỏ cấu hình Resend.
6. Nối frontend CCA trên GitHub Pages với API mới và UI đăng nhập mới.
7. Xây admin quản lý user trong phạm vi đã duyệt.
8. Kiểm thử quyền admin/student, đặt mật khẩu lần đầu đồng thời, cookie/CORS/CSRF, phiên 24 giờ, deadline, 10 lượt và reset.
9. Cấu hình Vercel/Neon, domain và secrets; đổi NEXT_PUBLIC_CCA_API_URL trên workflow Pages sau khi kiểm tra môi trường triển khai.

Tài liệu archive mô tả bản cũ và không thay thế thiết kế này. Chưa có chuyển đổi dữ liệu người dùng/kết quả cũ; cần xác nhận có dữ liệu production phải giữ hay không trước khi migration.
