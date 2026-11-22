export async function checkReadiness(cancel: AbortSignal): Promise<boolean> {
  if (cancel.aborted) return false;
  const request = new AbortController();
  const abort = () => request.abort();
  cancel.addEventListener('abort', abort, { once: true });
  const timeout = window.setTimeout(abort, 4_000);
  try {
    const response = await fetch('/health', {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: request.signal,
    });
    const mime = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (response.status !== 200 || mime !== 'application/json') {
      void response.body?.cancel().catch(() => undefined);
      return false;
    }
    const body: unknown = await response.json();
    return !request.signal.aborted && typeof body === 'object' && body !== null && 'status' in body && body.status === 'ok';
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
    cancel.removeEventListener('abort', abort);
  }
}
