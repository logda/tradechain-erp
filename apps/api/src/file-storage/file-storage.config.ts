import { join, relative, sep } from 'node:path';

function resolveDefaultErpDataDir() {
  return join(process.cwd(), '..', '..', 'work', 'erp-data');
}

export function resolveErpDataDir() {
  return process.env.ERP_DATA_DIR?.trim() || resolveDefaultErpDataDir();
}

export function resolveUploadRoot() {
  return join(resolveErpDataDir(), 'uploads');
}

export function resolveFormalQuoteUploadRoot() {
  return join(resolveUploadRoot(), 'formal-quotes');
}

export function resolveFormalQuoteAttachmentUploadRoot() {
  return join(resolveUploadRoot(), 'formal-quote-attachments');
}

export function resolveSalesOrderAttachmentUploadRoot() {
  return join(resolveUploadRoot(), 'sales-order-attachments');
}

export function normalizeStorageRelativePath(value: string) {
  return value.split(sep).join('/');
}

export function buildFormalQuoteUploadKey(absolutePath: string) {
  return normalizeStorageRelativePath(relative(resolveUploadRoot(), absolutePath));
}

export function buildFormalQuoteAttachmentUploadKey(absolutePath: string) {
  return normalizeStorageRelativePath(relative(resolveUploadRoot(), absolutePath));
}

export function buildSalesOrderAttachmentUploadKey(absolutePath: string) {
  return normalizeStorageRelativePath(relative(resolveUploadRoot(), absolutePath));
}

export function buildPublicFileUrl(pathname: string, fallbackBaseUrl: string) {
  const explicitBaseUrl = process.env.ERP_PUBLIC_BASE_URL?.trim() || fallbackBaseUrl;
  return `${explicitBaseUrl.replace(/\/+$/, '')}/${pathname.replace(/^\/+/, '')}`;
}

export function resolveRequestBaseUrl(request: {
  headers?: Record<string, string | string[] | undefined>;
}) {
  const forwardedProto = request.headers?.['x-forwarded-proto'];
  const forwardedHost = request.headers?.['x-forwarded-host'];
  const host = request.headers?.host;

  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto ?? 'http';
  const hostname = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost ?? (Array.isArray(host) ? host[0] : host);

  if (hostname?.trim()) {
    return `${protocol}://${hostname.trim()}`;
  }

  return 'http://127.0.0.1:3001';
}
