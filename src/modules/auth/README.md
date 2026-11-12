# Auth

Đã triển khai contracts, service/repository queries, HTTP adapters, page guards, UI login/setup/logout và bootstrap admin. Xem [hướng dẫn auth](../../../docs/auth-implementation.md).

Crypto và DB code chỉ chạy ở server. Service nhận SQL interface để test trên PostgreSQL embedded. HTTP JSON chỉ trả DTO theo allowlist; token đi qua cookie HttpOnly. Script dùng cùng provisioning service, không mở đăng ký admin công khai.
