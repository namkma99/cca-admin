# Quản lý người dùng

Trang `/admin/users` có tìm kiếm username, lọc vai trò/trạng thái và tạo học viên. Trang chi tiết hiển thị quyền truy cập, khóa/mở khóa, đặt lại mật khẩu, chu kỳ thi, kết quả và nhật ký quản trị.

- Login và setup-password từ `APP_ORIGIN` chỉ chấp nhận admin; học viên phải dùng frontend thi thuộc `CCA_ALLOWED_ORIGINS`.
- Mọi trang và endpoint quản trị yêu cầu phiên `authenticated`, tài khoản `active`, role `admin`. Không có chức năng đổi role trên UI/API.
- Không cho khóa hoặc reset mật khẩu tài khoản đang đăng nhập. Reset mật khẩu và chu kỳ thi bị từ chối khi tài khoản đích đã khóa.
- Khóa/reset mật khẩu kết thúc bài thi đang làm và thu hồi phiên. Mở khóa khôi phục trạng thái trước khi khóa; người dùng phải đăng nhập lại.
- Cấp/reset không sinh mật khẩu: tài khoản `pending_password` dùng username để vào bước đặt mật khẩu. Quy tắc này áp dụng cả admin theo chính sách hiện tại.
- Thao tác quản trị và audit được ghi trong cùng transaction. Reset chu kỳ giữ kết quả cũ, trả `{ ok: true }`, không trả đối tượng user.
- UI xác nhận thao tác ảnh hưởng truy cập, chặn bấm lặp, hiển thị lỗi mạng/quyền và phân biệt lịch sử chưa tải với lịch sử rỗng. Lỗi đọc dữ liệu không được biến thành danh sách rỗng hoặc 404 giả.

Kiểm thử: `tests/integration/admin-routes.test.ts` gọi trực tiếp mọi route admin để xác minh quyền; các test component kiểm tra luồng thao tác và lỗi.
