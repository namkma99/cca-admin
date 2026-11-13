# Cấu hình xác thực trong Admin Settings

Admin chỉnh chính sách tại `/admin/settings`, mục **Xác thực & phiên đăng nhập**. Dữ liệu lưu trong bảng `settings`, key `auth`, và được đọc mới ở mỗi request login/setup-password; không cần redeploy khi thay đổi.

## API

`GET /api/v1/admin/settings` trả `{ "settings": { ..., "auth": ... } }`.

`PUT /api/v1/admin/settings` hỗ trợ cập nhật từng trường, yêu cầu phiên admin, Origin được phép và Content-Type JSON:

```json
{
  "auth": {
    "sessionDurationMinutes": 1440,
    "passwordSetupDurationMinutes": 10,
    "loginRateLimit": {
      "windowMinutes": 15,
      "maxAttemptsPerUsername": 10,
      "maxAttemptsPerIp": 50
    }
  }
}
```

Response `200` chứa toàn bộ cấu hình đã lưu trong `settings`, bao gồm `auth`. Ví dụ chỉ gửi `{ "auth": { "loginRateLimit": { "maxAttemptsPerIp": 20 } } }` sẽ giữ nguyên những trường khác. Các cập nhật auth được khóa theo hàng trong transaction để tránh mất thay đổi khi cập nhật đồng thời.

| Trường                                | Mặc định | Giới hạn số nguyên |
| ------------------------------------- | -------- | ------------------ |
| sessionDurationMinutes                | 1440     | 1–43200 phút       |
| passwordSetupDurationMinutes          | 10       | 1–60 phút          |
| loginRateLimit.windowMinutes          | 15       | 1–1440 phút        |
| loginRateLimit.maxAttemptsPerUsername | 10       | 1–10000 request    |
| loginRateLimit.maxAttemptsPerIp       | 50       | 1–10000 request    |

Auth chỉ nhận số JSON, không nhận chuỗi, null, số thập phân hoặc trường lạ. Dữ liệu không hợp lệ trả `400 INVALID_INPUT` và không lưu bất kỳ thay đổi nào trong request đó. Chưa đăng nhập trả `401`, không phải admin trả `403`.

## Hành vi áp dụng

- Thời hạn phiên đăng nhập áp dụng khi login bằng mật khẩu hoặc hoàn tất đặt mật khẩu và được cấp phiên mới. Cookie lấy Max-Age/Expires từ chính hạn của phiên đó.
- Thời hạn phiên đặt mật khẩu áp dụng khi cấp phiên `password_setup` mới. Phiên đã cấp giữ nguyên `expires_at`; đổi cấu hình không kéo dài, rút ngắn hoặc thu hồi các phiên hiện có.
- Mọi request login, kể cả bước nhập username và cả lần thành công/thất bại, dùng giới hạn IP và username đang lưu. Bộ đếm IP được kiểm tra trước username.
- Thay đổi chính sách không xóa bộ đếm. Giới hạn số request mới có hiệu lực ngay; cửa sổ đang tồn tại giữ hạn cũ, độ dài cửa sổ mới áp dụng khi bắt đầu cửa sổ tiếp theo. `Retry-After` là số giây còn lại thực tế của bucket đang chặn.
- Giới hạn xử lý đặt mật khẩu vẫn là 5 request/user trong khoảng thời gian bằng `passwordSetupDurationMinutes`; đây là chốt bảo vệ riêng, không phải giới hạn login.
- Quy tắc độ dài mật khẩu và cookie HttpOnly/Secure/SameSite, origin CORS tiếp tục do code/biến môi trường quản lý. Không đưa secret hoặc token vào Settings.
- Khi chưa có key `auth`, dùng mặc định tập trung ở `src/modules/settings/contracts/auth.ts`. Lỗi database hoặc cấu hình đã lưu không hợp lệ sẽ thất bại an toàn; không bỏ qua giới hạn xác thực.

## Migration và triển khai

Migration `drizzle/0004_auth_settings.sql` đã được đăng ký trong Drizzle journal, thêm key `auth` với mặc định bằng `ON CONFLICT DO NOTHING`, giữ nguyên cấu hình đã tồn tại. Không đổi cấu trúc bảng.

Sau khi xác nhận `DATABASE_URL` trỏ đúng môi trường, áp dụng migration bằng:

```sh
npm run db:migrate
```

Code và test không tự migrate database production. Kiểm thử tích hợp áp dụng migration trên PostgreSQL nhúng PGlite, kiểm tra mặc định, cập nhật từng phần, quyền API, cookie và việc thực thi thời hạn/rate limit.
