# Next.js structure và schema implementation plan

**Goal:** Dựng nền tảng Next.js chạy được và migration 8 bảng đã chốt, chưa triển khai auth/exam/admin services.

**Architecture:** Một App Router project, module theo nghiệp vụ, schema Drizzle và Neon WebSocket driver hỗ trợ transaction. Không cần database credentials để build hoặc sinh migration.

**Tech Stack:** Next.js, React, TypeScript, Tailwind, Zod, Drizzle, Neon; Vitest và PGlite để kiểm tra SQL bằng PostgreSQL embedded.

**Spec:** docs/architecture.md và docs/database-design.md.

## Constraints

- Đúng 8 bảng, FK ghép cycle/user, partial unique chu kỳ và bài đang chạy.
- Dữ liệu nguồn có đáp án chỉ nằm ở backend, không import vào UI.
- Không tạo endpoint giả cho auth/admin/exam hoặc Cron chưa có nghiệp vụ.
- Không tự kết nối/migrate production. Không có Git repository để tạo worktree/commit.

## Tasks

- [x] 1. Scaffold cấu hình package, Next/App Router, Tailwind, TypeScript strict, lint/format/test; thêm module boundaries và UI nền tảng không hiển thị dữ liệu riêng tư.
- [x] 2. Viết test migration trên PostgreSQL embedded trước schema: bảng/FK, username chuẩn hóa, câu needs_review, ready thiếu đáp án, chu kỳ/form/active unique, trạng thái và kết quả bài, cascade payload, rate/audit constraints. Chạy để xác nhận migration chưa tồn tại.
- [x] 3. Tạo schema chia file, quan hệ Drizzle, env validation và connection scope cho Neon. Sinh migration bằng drizzle-kit; chạy test kiểm tra dữ liệu bị từ chối/được nhận và rollback SQL.
- [x] 4. Cập nhật hướng dẫn local/migration, CI và trạng thái docs. Chạy format, lint, typecheck, tests, build; rà soát schema/migration và assets build không chứa bank.

## Verification commands

```sh
npm run db:generate
npm run db:check
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

PGlite kiểm tra SQL thực thay vì mock hoặc snapshot schema; chưa thay thế smoke test Neon thật khi có credentials và triển khai service đồng thời. Không tạo test chỉ để đếm file scaffold.

## Verification results

- Migration generated: drizzle/0000_initial_schema.sql; exactly 8 application tables.
- Regeneration reports no schema changes; drizzle-kit check passes.
- 24 tests pass: 19 PostgreSQL embedded constraint/rollback tests, 5 environment cases.
- Typecheck, ESLint (zero warnings) and Prettier check pass.
- Production build passes with npm run build -- --webpack. Default Turbopack build is blocked by this environment denying internal port binding during CSS processing, including an escalated attempt.
- Scanned 21 client build assets for answer field names and source-bank prompt samples; no matches.
- Fresh dependency installation with overrides reports 0 npm audit vulnerabilities.
- Independent read-only review completed; expanded negative SQL tests and clarified updated_at ownership and service-level validation boundaries.
- No Neon connection/migration, production deploy, Git commit or business endpoint created. Concurrency/driver tests await service implementation and a separate PostgreSQL test environment.
