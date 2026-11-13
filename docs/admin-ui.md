# Admin interface

The portal uses English UI copy, sentence case, explicit UTC timestamps, keyboard focus indicators, and horizontally scrollable tables/navigation on small screens.

## Screens

- `/admin`: links to user management, audit logs and settings.
- `/admin/users`: create student accounts, search loaded usernames, filter status, refresh, and view creation/last sign-in times.
- `/admin/users/[userId]`: account details; enable/disable and password reset; up to 200 completed exam attempts in a table; topic cycle reset; recent audit events with actor usernames and expandable metadata.
- `/admin/audit-logs`: global administrator activity, actor/target links, action labels, metadata, search by actor or target username, action filters and pagination (25 events per page).
- `/admin/settings`: grouped settings, unsaved-change indicator, discard and guarded save. Stored preferences that the exam workflow does not consume are described explicitly.

Loading, error and empty states are distinct. Read failures reach error boundaries instead of appearing as an empty list or a missing user. Failed refreshes retain the last successful data. Account mutations require confirmation and are disabled while pending.

## Audit API

`GET /api/v1/admin/audit-logs?q=&action=&page=1&pageSize=25`

Requires an authenticated, active administrator. `q` matches either actor or target username, case-insensitively (maximum 64 characters). `action` accepts `create_user`, `disable_user`, `enable_user`, `reset_password`, or `reset_exam_cycle`. Page size is 1–100. Results are ordered by creation time and ID descending and return `{ logs, total, page, pageSize }`. No schema migration is required.

These are administrative account logs, not application errors, sign-in events, settings history or cron run history.

## Suggested next work

1. **Apply stored settings:** define passing rules and historical score behavior; connect portal naming; design answer review without exposing the question bank.
2. **Export exam results:** CSV with user/topic/date filters and protection against spreadsheet formula injection.
3. **Session management:** show active sessions and allow explicit revocation, with auditing.
4. **Exam monitoring:** view active attempts, expiry times and topic/cycle progress through new admin-only endpoints.
5. **Question bank overview:** counts by topic, imported version and excluded questions, keeping answers server-only.
6. **Settings and job history:** record configuration changes and cron outcomes before exposing monitoring screens. Do not imply historical events exist when they were never recorded.

## Validation

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`. `npm run build -- --webpack` is the supported fallback when the execution environment prevents Turbopack's internal worker from binding a port.
