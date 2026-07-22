/**
 * Shared helpers for Dynaxis platform API routes.
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireOwnerFromRequest } from './ownership.js';
import { PlatformPersistenceError } from './db/client.js';

export function jsonOk(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(err) {
  if (err instanceof PlatformPersistenceError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status || 503 }
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: err.flatten() },
      { status: 400 }
    );
  }
  const status = err.status || 500;
  return NextResponse.json(
    {
      error: err.message || 'Internal error',
      code: err.code || 'INTERNAL_ERROR',
    },
    { status }
  );
}

/**
 * @param {Request} request
 * @param {(ctx: { ownerRef: string, apiKey: string, request: Request }) => Promise<Response>} handler
 */
export async function withPlatformAuth(request, handler) {
  try {
    const { ownerRef, apiKey } = requireOwnerFromRequest(request);
    return await handler({ ownerRef, apiKey, request });
  } catch (err) {
    return jsonError(err);
  }
}
