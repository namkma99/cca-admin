# CCA API và Admin

Project dự kiến triển khai trên Vercel, kết hợp API phòng thi và giao diện admin quản lý user. Frontend thi tại `/cca` tiếp tục chạy trên GitHub Pages của project `next-pro`.

## Tài liệu hiện hành

- [Auth đã triển khai](docs/auth-implementation.md): API, cookie, cấu hình origin và script tạo admin.
- [Kiến trúc, công nghệ và structure](docs/architecture.md): Next.js fullstack gọn cho khoảng 10 user, Vercel Hobby + Neon Free.
- [Schema 8 bảng và relationship](docs/database-design.md): cột, khóa ngoại, ràng buộc, transaction và vòng đời dữ liệu.
- [Thiết kế API, auth và admin](docs/auth-and-api-design.md): hướng mới cùng những điểm cần xác nhận trước khi viết code.
- Ngân hàng câu hỏi local `data/question-bank.json`: 459 dòng nguồn, 456 câu đủ cấu trúc; có đáp án nên chỉ dùng ở backend. Không có trong Git repository public.
- Báo cáo nhập dữ liệu local `data/import-report.json`: thống kê và ba câu thiếu dữ liệu; đi cùng bộ dữ liệu riêng tư.

Đã có scaffold Next.js App Router và schema Drizzle 8 bảng cùng migration SQL. Đã có auth username/password, cookie HttpOnly, UI login/setup và script tạo admin. Chưa có user CRUD/thi, chưa migrate lên Neon hoặc triển khai dịch vụ. Xem [hướng dẫn local và migration](docs/development.md).

## Chạy local

Dùng Node.js 24 LTS theo `.nvmrc`:

```sh
npm ci
npm run dev
```

Trang nền tảng chạy không cần credentials. Chỉ cấu hình `DATABASE_URL` khi cần truy cập database; không tự chạy migration lên production.

## Hướng đã chốt

- Next.js App Router + TypeScript, một project Vercel Hobby kết hợp Neon PostgreSQL Free; điều kiện Hobby là sử dụng cá nhân, phi thương mại.
- Kiến trúc modular monolith, chia module nghiệp vụ; Drizzle ORM và migration SQL.
- Chốt 8 bảng, bao gồm dữ liệu bài thi tạm, rate limit và audit thao tác admin.
- Vercel project có cả API và màn hình admin quản lý user.
- Trang CCA trên GitHub Pages đăng nhập bằng username/password; các trang công khai khác không yêu cầu đăng nhập.
- Dùng HttpOnly cookie, phiên đăng nhập có thời hạn tuyệt đối 24 giờ.
- Bỏ OTP và dịch vụ gửi email.
- Ngân hàng câu hỏi và đáp án lưu trong database; API chỉ trả nội dung được cấp và không trả đáp án đúng.

## Tài liệu lịch sử

Hai tài liệu trong `docs/archive` mô tả bản cũ sử dụng SQLite, OTP và API chạy thường trực. Giữ để tham khảo quy tắc thi và kết quả kiểm thử cũ; không dùng làm cấu hình triển khai của phương án mới.

## Phân tách với frontend

Mã nguồn frontend CCA hiện tại vẫn ở `../next-pro`. JSON được sao chép sang `data/`; bản tại `../next-pro/artifacts/cca` vẫn được giữ vì API và các kiểm thử cũ đang đọc đường dẫn đó. Chỉ gỡ bản cũ sau khi chuyển đổi API hoàn tất.

Git repository `namkma99/cca-admin` hiện public và chỉ chứa code/schema/docs. Thư mục `data/` bị loại khỏi Git bằng `.gitignore` vì có đáp án; cần cung cấp riêng khi import trên backend. Nếu muốn version ngân hàng câu hỏi, dùng kho lưu trữ private. Không đưa dữ liệu vào public assets hoặc bundle frontend.
