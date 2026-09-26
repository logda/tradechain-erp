// 仅供服务端调用；不记录请求正文、会话头或 URL 查询参数。
export function logServerRequestFailure(method: string, endpoint: string, error: unknown) {
  const path = endpoint.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  console.error(`[ERP Web] ${method} ${path} 请求失败`, error instanceof Error ? error.stack ?? error.message : String(error));
}
