import 'server-only';
import { AppError } from './errors';

const MAX_BODY_BYTES = 8192;

export async function readJson(request: Request) {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !==
    'application/json'
  ) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      415,
      'Yêu cầu phải dùng application/json.',
    );
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES)
    throw new AppError('BODY_TOO_LARGE', 413, 'Nội dung yêu cầu quá lớn.');
  // Bound streamed input too, even if content-length is missing or dishonest.
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError('INVALID_INPUT', 400, 'Dữ liệu không hợp lệ.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AppError('BODY_TOO_LARGE', 413, 'Nội dung yêu cầu quá lớn.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new AppError('INVALID_INPUT', 400, 'Dữ liệu JSON không hợp lệ.');
  }
}
