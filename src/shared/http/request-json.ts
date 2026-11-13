const messages: Record<string, string> = {
  UNAUTHENTICATED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  INVALID_INPUT: 'Please check your input and try again.',
  INVALID_CREDENTIALS: 'Incorrect username or password.',
  CONFLICT: 'This username is already in use.',
  NOT_FOUND: 'The requested record could not be found.',
  SELF_ACTION: 'You cannot change your own account here.',
  LAST_ADMIN: 'The last active administrator cannot be disabled.',
  DISABLED: 'Enable the account before resetting its password.',
  RATE_LIMITED: 'Too many requests. Please try again later.',
};

export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
    });
  } catch {
    throw new Error('Unable to connect. Check your connection and try again.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      messages[body?.error?.code] ??
        'Unable to complete the request. Please try again.',
    );
  }
  if (body === null)
    throw new Error('Unexpected server response. Please try again.');
  return body as T;
}
