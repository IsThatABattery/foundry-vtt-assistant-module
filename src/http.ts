import type { ApiResponse } from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function json(status: number, body: unknown): ApiResponse {
  return { status, body, headers: { 'content-type': 'application/json' } };
}

export function fail(status: number, code: string, message: string): ApiResponse {
  return json(status, { error: { code, message } });
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ApiError(400, 'BAD_REQUEST', `${name} is required`);
  return value;
}

export function requireExplicitIntent(body: Record<string, unknown>, action: string): void {
  if (body.requireExplicitUserIntent !== true) {
    throw new ApiError(403, 'EXPLICIT_INTENT_REQUIRED', `${action} requires requireExplicitUserIntent: true`);
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'BAD_REQUEST', 'JSON object body is required');
  return value as Record<string, unknown>;
}

export function optionalStringArray(value: unknown, name: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) throw new ApiError(400, 'BAD_REQUEST', `${name} must be an array of strings`);
  return value;
}
