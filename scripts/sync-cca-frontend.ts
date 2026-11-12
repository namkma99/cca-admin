import { readFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';

const target = process.argv[2];
if (!target || process.argv.length !== 3) {
  console.error('Cách dùng: npm run frontend:sync -- ../next-pro');
  process.exitCode = 1;
} else {
  const root = resolve(target);
  try {
    const info = JSON.parse(
      await readFile(join(root, 'package.json'), 'utf8'),
    ) as { name?: string };
    if (info.name !== 'next-pro') throw new Error('Unexpected target project');
    await stat(join(root, 'src/features/cca/components/exam-result.tsx'));
    await stat(join(root, 'src/features/cca/storage.ts'));
    const files = [
      'api.ts',
      'contracts.ts',
      'use-exam-session.ts',
      'components/cca-page-view.tsx',
      'components/candidate-form.tsx',
      'components/topic-dashboard.tsx',
      'components/exam-room.tsx',
    ];
    for (const file of files) {
      const dest = join(root, 'src/features/cca', file);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(resolve('integrations/next-pro/cca', file), dest);
    }
    console.log(
      `Đã cập nhật ${files.length} file CCA tại ${root}. Các trang công khai khác giữ nguyên.`,
    );
  } catch {
    console.error(
      'Không đồng bộ được frontend. Kiểm tra đường dẫn project next-pro và module CCA hiện có.',
    );
    process.exitCode = 1;
  }
}
