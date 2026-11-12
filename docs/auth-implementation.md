# Auth username/password: vận hành và contract

Đã triển khai trong project này: login, session, setup-password, logout, UI login/setup, page guard admin/account và script tạo admin. Chưa kết nối frontend CCA ở repo next-pro, chưa làm user CRUD/reset mật khẩu/reset lượt thi hoặc Cron cleanup. Không có đăng ký công khai và không tự tạo tài khoản khi server khởi động.

## Cấu hình

Sao chép .env.example thành .env.local; không commit credentials.

| Biến                | Ý nghĩa                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| DATABASE_URL        | Neon PostgreSQL đã áp dụng migration 8 bảng                                                  |
| APP_ORIGIN          | Origin của admin/API, ví dụ https://admin.example.com; không có path/dấu / cuối              |
| CCA_ALLOWED_ORIGINS | Danh sách origin CCA được phép, phân cách dấu phẩy; để trống khi chưa kết nối frontend ngoài |
| CRON_SECRET         | Dự phòng cho cleanup sau này; chưa có endpoint Cron hoạt động                                |

Development mặc định APP_ORIGIN=http://localhost:3000 nếu không khai báo. Nếu đổi port phải đổi APP_ORIGIN. Production yêu cầu APP_ORIGIN HTTPS rõ ràng; origin thiếu/sai khiến auth API trả lỗi cấu hình an toàn. Preview cần APP_ORIGIN của đúng preview và database riêng; không tự tin giá trị Host do client gửi.

Cookie production là __Host-cca_session, HttpOnly, Secure, SameSite=Lax, Path=/ và không có Domain. Development dùng cca_session không Secure để chạy HTTP local. CCA và API production cần HTTPS cùng site/domain gốc để cookie này làm việc; allowlist CORS không vượt qua chính sách cookie bên thứ ba của browser.

## Tạo admin

Sau khi kiểm tra DATABASE_URL và áp dụng migration đúng môi trường:

```sh
npm ci
npm run db:migrate
npm run admin:create -- admin
```

Lệnh tạo username đã chuẩn hóa lowercase, role admin, status pending_password và mật khẩu tạm ngẫu nhiên 24 byte (32 ký tự base64url). Database chỉ lưu scrypt verifier. Mật khẩu tạm được in một lần ở terminal sau khi INSERT thành công; tránh chạy lệnh trong CI có log công khai hoặc redirect đầu ra vào file được commit. Username đã tồn tại sẽ bị từ chối, không overwrite mật khẩu/role của tài khoản đó. Không cần truyền mật khẩu qua argv hoặc biến NEXT_PUBLIC_.

Script dùng node --conditions=react-server --import tsx để giữ server-only boundary và thực thi TypeScript bằng tsx. Nó load .env.local rồi .env, không ghi file chứa mật khẩu. Không tạo auth session hoặc tự kích hoạt admin.

Đăng nhập tại /login bằng mật khẩu tạm, sau đó đặt mật khẩu chính thức tại /setup-password. Khi hoàn tất, admin vào /admin; student vào /account. /admin hiện là shell có guard, chưa có màn hình quản lý user.

## Endpoint REST

Mọi response có Cache-Control: no-store, Vary: Origin và X-Content-Type-Options: nosniff. Token chỉ được gửi trong Set-Cookie; JSON không có raw token, token hash, password hash hoặc dữ liệu câu hỏi.

| Method/path                      | Input                                         | Kết quả                                                                                                       |
| -------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| POST /api/v1/auth/login          | JSON username, password                       | session DTO; cookie setup 10 phút hoặc authenticated 24 giờ                                                   |
| GET /api/v1/auth/session         | Cookie                                        | session DTO hoặc session:null nếu không hợp lệ/hết hạn                                                        |
| POST /api/v1/auth/setup-password | Cookie setup + JSON password, confirmPassword | Kích hoạt user, thu hồi mọi phiên cũ, cấp cookie/token authenticated mới                                      |
| POST /api/v1/auth/logout         | Cookie + JSON {}                              | Thu hồi phiên hiện tại, xóa cookie; gọi lặp vẫn thành công                                                    |
| OPTIONS trên bốn endpoint        | Origin + preflight method/header              | Origin chính xác, credentials=true, GET/POST và Content-Type; origin/header/method ngoài allowlist bị từ chối |

Session DTO gồm kind, expiresAt ISO và user{id, username, role}. Phiên setup chỉ dùng để đặt mật khẩu/đọc trạng thái/đăng xuất, không đủ quyền gọi requireSession hoặc vào admin. Khi chưa đăng nhập, API session vẫn trả 200 với session:null để UI xác định trạng thái.

Mutation bắt buộc Origin thuộc APP_ORIGIN hoặc CCA_ALLOWED_ORIGINS và Content-Type application/json. Đọc JSON được giới hạn 8 KiB, kể cả stream không khai báo Content-Length. Không dùng GET để thay đổi auth, không phản chiếu Origin tùy ý và không cho CORS wildcard.

Frontend CCA bên ngoài dùng fetch với credentials:'include', kiểm tra session trước khi render dữ liệu riêng tư. UI trong project gọi API cùng origin. Không ghi password/token/session vào localStorage, sessionStorage hoặc IndexedDB. Không nhận returnTo từ client; điều hướng tới các đường dẫn cố định theo kind/role.

## Mật khẩu và vòng đời phiên

- Username: trim/lowercase, 1–64 ký tự; bắt đầu bằng chữ/số, phần còn lại là a-z, 0-9, dấu chấm, gạch dưới hoặc gạch ngang.
- Password login 1–128 ký tự. Password chính thức 12–128 ký tự, không trim, xác nhận trùng và khác mật khẩu tạm.
- Scrypt N=32768, r=8, p=3; salt ngẫu nhiên 16 byte và key 64 byte. Verifier có version/tham số; không thực thi thông số tùy ý từ hash lỗi. Đây là một cấu hình scrypt được [OWASP liệt kê](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Cookie token ngẫu nhiên 32 byte, DB chỉ lưu SHA-256. Cookie hết hạn không thay thế việc kiểm tra expires_at, revoked_at, trạng thái và role hiện tại của user trong DB.
- Authenticated session có hạn tuyệt đối 24 giờ từ lúc cấp; GET/session hoặc truy cập trang không cập nhật hạn.
- Pending user nhập đúng mật khẩu tạm nhận setup session 10 phút. Chỉ ghi first_login_at khi kích hoạt thành công; last_login_at được cập nhật khi xác thực mật khẩu thành công.
- Password setup kiểm tra bằng chứng trước khi hash mật khẩu mới; khóa user rồi session, kiểm tra lại hash/status/expiry dưới khóa. Đổi password/status, revoke toàn bộ phiên và INSERT phiên mới trong cùng transaction. Kích hoạt lặp hoặc phiên setup cũ không dùng lại được.
- Login cũng kiểm tra lại password verifier và trạng thái user sau khi lấy khóa để không cấp phiên từ mật khẩu vừa bị thay thế.
- Logout thu hồi phiên hiện tại; không kết thúc bài thi hoặc thu hồi mọi thiết bị vì chính sách đó chưa được triển khai/chốt.

## Rate limit và lỗi

Login giới hạn 10 request/username và 50 request/IP mỗi 15 phút, bao gồm cả lần thành công. Setup giới hạn 5 lần xử lý mật khẩu/user mỗi 10 phút, dùng chung giữa các setup session. PostgreSQL UPSERT bộ đếm nguyên tử; transaction rate limit commit độc lập để lỗi xác thực không rollback bộ đếm. IP đã bị chặn không tạo thêm bucket username mới. Window có hạn cố định, không kéo dài do request bị chặn.

Production trên Vercel chỉ đọc IP từ x-vercel-forwarded-for khi VERCEL=1; ngoài Vercel dùng bucket local dùng chung thay vì tin header giả. Nếu triển khai host khác phải thêm adapter proxy đáng tin cậy. Tham khảo [Vercel request headers](https://vercel.com/docs/headers/request-headers).

Lỗi có dạng error{code,message} và requestId. HTTP 400 cho input sai, 401 cho thông tin đăng nhập/phiên không hợp lệ, 403 cho quyền/Origin, 413 cho body lớn, 415 cho content type, 429 cho rate limit (Retry-After 900 hoặc 600 giây), 500 cho lỗi hạ tầng. Username không tồn tại, mật khẩu sai và user disabled đều nhận cùng lỗi INVALID_CREDENTIALS. Unknown user vẫn chạy scrypt dummy để giảm khác biệt thời gian.

Không log password, raw cookie, verifier, request body hoặc raw database error. Lỗi hạ tầng chỉ log event/request ID. Rate limit/auth sessions hết hạn vẫn bị từ chối dù chưa cleanup; tác vụ dọn dữ liệu định kỳ thuộc bước Cron tiếp theo.

## Kiểm chứng và giới hạn

Các test chạy SQL thật qua Drizzle/PGlite, kiểm tra token hash, deadline chính xác, hạn cố định, kích hoạt/replay, thu hồi, role/status, giới hạn và rollback khi INSERT session thất bại. HTTP tests kiểm tra cookie/CORS/CSRF/JSON/body/error minimization; DOM tests kiểm tra form, loading/error, validation và điều hướng. Script dùng chung provisioning service đã có integration test và có smoke test usage không kết nối DB.

Chưa chạy Neon thật hoặc tranh chấp nhiều connection, chưa tạo admin thật, chưa migrate/deploy. Khi có database test riêng cần smoke test driver WebSocket, browser cookie trên domain thực tế và hai request setup đồng thời. PGlite không thay thế kiểm chứng tranh chấp trên Neon/PostgreSQL nhiều connection.
