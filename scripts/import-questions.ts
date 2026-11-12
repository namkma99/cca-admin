import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { withDatabase } from '../src/server/db/client';
import { importQuestions } from '../src/modules/question-bank/server/import-questions';
import { AppError } from '../src/server/http/errors';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });

const file = process.argv[2] ?? 'data/question-bank.json';

try {
  const input = JSON.parse(await readFile(resolve(file), 'utf8')) as unknown;
  const report = await withDatabase((db) => importQuestions(db, input));
  console.log(JSON.stringify(report));
} catch (error) {
  if (error instanceof AppError) {
    console.error(
      JSON.stringify({
        error: { code: error.code, message: 'Question bank import rejected.' },
      }),
    );
  } else {
    console.error(
      JSON.stringify({
        error: {
          code: 'IMPORT_FAILED',
          message: 'Question bank import failed.',
        },
      }),
    );
  }
  process.exitCode = 1;
}
