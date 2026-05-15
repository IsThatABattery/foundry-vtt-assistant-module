import { ApiError, fail } from './http';
import type { ApiRequest, ApiResponse, HandlerMap } from './types';

export interface RouterOptions {
  token: string;
  handlers: HandlerMap;
}

function getHeader(headers: Record<string, string | undefined> | undefined, name: string): string | undefined {
  const key = Object.keys(headers ?? {}).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers?.[key] : undefined;
}

export function isAuthorized(headers: Record<string, string | undefined> | undefined, token: string): boolean {
  if (!token) return false;
  const authorization = getHeader(headers, 'authorization');
  return authorization === `Bearer ${token}`;
}

export async function dispatchRequest(request: ApiRequest, options: RouterOptions): Promise<ApiResponse> {
  if (!isAuthorized(request.headers, options.token)) return fail(401, 'UNAUTHORIZED', 'Missing or invalid bearer token');
  const method = request.method.toUpperCase();
  const path = request.path.split('?')[0];
  const handler = options.handlers[`${method} ${path}`];
  if (!handler) return fail(404, 'NOT_FOUND', 'Route not found');
  try {
    return await handler({ ...request, method, path });
  } catch (error) {
    if (error instanceof ApiError) return fail(error.status, error.code, error.message);
    return fail(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error');
  }
}
