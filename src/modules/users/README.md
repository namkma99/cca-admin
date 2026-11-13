# Users

`server/service.ts` manages student accounts, administrative authorization and transactional audit events. User and global audit endpoints require active administrator sessions. Safe DTOs exclude password hashes and session tokens.

`components/` contains English user management, user details, tabular exam history and global audit logs with filtering/pagination. Shared audit contracts live in `contracts/audit.ts`.

See [Admin interface](../../../docs/admin-ui.md) for screen behavior, audit API parameters and suggested follow-up features.
