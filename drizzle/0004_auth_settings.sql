INSERT INTO "settings" ("key", "value", "description")
VALUES (
  'auth',
  '{"sessionDurationMinutes":1440,"passwordSetupDurationMinutes":10,"loginRateLimit":{"windowMinutes":15,"maxAttemptsPerUsername":10,"maxAttemptsPerIp":50}}'::jsonb,
  'Thời hạn phiên và giới hạn đăng nhập'
)
ON CONFLICT ("key") DO NOTHING;
