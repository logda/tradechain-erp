export function createMutationRequestKey() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function readMutationRequestHeaders(formData: FormData): Record<string, string> {
  const key = formData.get('idempotencyKey');
  return typeof key === 'string' && key
    ? { 'Idempotency-Key': key }
    : {};
}
