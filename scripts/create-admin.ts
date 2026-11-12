import { config } from 'dotenv';
import { withDatabase } from '../src/server/db/client';
import { createAdmin } from '../src/modules/auth/server/provision-admin';
import { usernameSchema } from '../src/modules/auth/contracts/schemas';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const username = usernameSchema.safeParse(args[0]);
  if (args.length !== 1 || !username.success) {
    console.error('Cách dùng: npm run admin:create -- <username>');
    process.exitCode = 1;
    return;
  }
  try {
    const result = await withDatabase((db) => createAdmin(db, username.data));
    // Intentional one-time terminal output. Never persist this password or log it in HTTP.
    console.log(
      `Admin: ${result.username}\nMật khẩu tạm (chỉ hiển thị lần này): ${result.temporaryPassword}\nĐăng nhập tại /login và đặt mật khẩu chính thức trong bước tiếp theo.`,
    );
  } catch {
    // Driver errors may include credentials/connection details: do not print the raw error.
    console.error(
      'Không tạo được admin. Kiểm tra DATABASE_URL, migration và username chưa tồn tại. Không có tài khoản cũ nào được ghi đè.',
    );
    process.exitCode = 1;
  }
}
await main();
