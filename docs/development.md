# Chạy local và kiểm tra schema

## Trạng thái hiện tại

Đã có scaffold Next.js App Router, React, TypeScript strict, Tailwind, cấu hình shadcn/ui và Button nền tảng; schema Drizzle 8 bảng, relations và migration đầu tiên. Thư mục module/route được chuẩn bị theo kiến trúc. Những thư mục có .gitkeep chưa phải tính năng hoạt động.

Đã có auth API login/session/setup-password/logout, UI login/setup, page guard admin/account và script tạo admin. Xem [auth-implementation.md](auth-implementation.md) để cấu hình origin, cấp tài khoản và kiểm tra contract. Chưa có user CRUD, import câu hỏi, API thi hoặc Cron; không có endpoint đăng ký công khai.

## Chạy local

Dùng Node.js 24 LTS theo .nvmrc:

```sh
nvm use
npm ci
npm run dev
```

Mở http://localhost:3000. Trang nền tảng, build, typecheck và SQL tests không cần DATABASE_URL. Không thêm dữ liệu ngân hàng vào UI để tạo demo.

Khi cần kết nối Neon, sao chép .env.example thành .env.local rồi điền DATABASE_URL của môi trường phù hợp. Không commit .env.local. .env.example chỉ chứa mẫu, không phải credentials dùng được.

## Schema và migration

Nguồn schema: src/server/db/schema/index.ts. Mỗi bảng nằm trong file riêng; relations.ts định nghĩa quan hệ Drizzle. SQL và metadata sinh ra được lưu trong drizzle/ và cần đưa vào Git cùng schema.

```sh
npm run db:generate -- --name describe_change
npm run db:check
npm test
```

Generate/check không cần credentials hoặc kết nối mạng database. Khi chỉnh schema, luôn sinh migration mới sau khi migration cũ đã được áp dụng; không sửa lịch sử migration production.

Chỉ khi đã kiểm tra DATABASE_URL trỏ đúng database đích mới chạy:

```sh
npm run db:migrate
```

Lệnh migrate thay đổi database thật và tạo metadata migration của Drizzle ngoài 8 bảng ứng dụng. Nó không tự chạy khi dev/build/start hoặc trên Vercel. Lần dựng scaffold này chưa chạy migrate lên Neon, chưa tạo dữ liệu user hoặc import ngân hàng. Không dùng drizzle-kit push làm quy trình production.

## Database trong server code

src/server/db/client.ts được đánh dấu server-only, dùng Neon Pool qua WebSocket hỗ trợ interactive transaction. withDatabase mở pool trong phạm vi callback và đóng trong finally; mọi query phải được await trong callback, không trả query lười hoặc giữ db ra bên ngoài. Không gọi withDatabase riêng cho từng repository trong một nghiệp vụ; chia sẻ cùng db/transaction context.

```ts
import { withDatabase } from '@/server/db/client';

await withDatabase(async (db) => {
  await db.transaction(async (tx) => {
    // Các repository của một nghiệp vụ cùng nhận tx này.
    await tx.execute('select 1');
  });
});
```

Đây là ví dụ kết nối, chưa phải service cấp quyền. Xác thực, quyền, deadline và thứ tự khóa phải được triển khai theo docs trước khi mở endpoint. Pool này dành cho Neon có WebSocket proxy; URL PostgreSQL local thuần TCP không chạy qua adapter này nếu chưa có proxy. SQL tests dùng PGlite độc lập.

updated_at có default now() và $onUpdate của Drizzle, không có trigger PostgreSQL tự cập nhật. SQL viết tay phải tự cập nhật updated_at. CHECK/FK/unique nằm thật trong SQL; các quy tắc liên bảng như total theo topic, actor phải là admin, payload tồn tại theo trạng thái và nội dung đáp án thuộc choices vẫn do service/importer thực thi.

## Kiểm tra trước khi bàn giao

```sh
npm run format:check
npm run lint
npm run typecheck
npm run db:check
npm test
npm run build
```

Vitest dùng PGlite (PostgreSQL embedded) thực thi migration và kiểm tra FK, CHECK, partial unique, cascade và rollback; không mock SQL, không kết nối Neon và không đọc .env.local. Bộ test này chưa kiểm tra tranh chấp giữa nhiều kết nối hoặc driver WebSocket thật. Khi viết service cần bổ sung integration/concurrency trên PostgreSQL/Neon test riêng.

Nếu môi trường sandbox chặn Turbopack mở cổng nội bộ khi xử lý CSS, dùng `npm run build -- --webpack` để kiểm tra production build. Đây là lựa chọn bundler chính thức, không thay đổi runtime hoặc schema.

CI sử dụng Node 24 và chạy các kiểm tra này không cần secret. Không tạo dữ liệu production trong CI. Chọn Node 24 và framework Next.js ở Vercel khi triển khai; runtime Function là Node.js, không dùng Edge cho adapter hiện tại.

## Dependency và dữ liệu riêng tư

package-lock.json khóa phiên bản; dùng npm ci để tái lập. Các override dependency dev được ghi trong package.json để dùng esbuild/minimatch có bản vá; khi nâng Drizzle Kit/typescript-eslint cần kiểm tra lại khả năng bỏ override. Không dùng npm audit fix --force vì có thể hạ/nâng công cụ phá vỡ migration.

data/question-bank.json có đáp án: chỉ dùng từ script import/backend tương lai, không đặt trong public/ hoặc import vào client. Repository public chỉ chứa code/schema/docs; data/ nằm trong .gitignore và phải cung cấp riêng khi import. Nếu version dữ liệu, dùng kho lưu trữ private. Kiểm tra .next/static khi thêm tính năng để tránh đóng gói bank/đáp án.
