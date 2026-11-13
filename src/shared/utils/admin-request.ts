export async function adminRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    throw new Error('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
  }
  if (response.status === 401)
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  const data = await response.json().catch(() => {
    throw new Error('Không thể đọc phản hồi từ máy chủ. Vui lòng thử lại.');
  });
  if (!response.ok)
    throw new Error(
      data.error?.message ?? 'Không thể thực hiện thao tác. Vui lòng thử lại.',
    );
  return data as T;
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Có lỗi xảy ra. Vui lòng thử lại.';
}
