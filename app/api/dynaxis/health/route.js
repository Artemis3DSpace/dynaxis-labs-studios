import { NextResponse } from 'next/server';
import { isPlatformDbConfigured, isMemoryDriverAllowed } from '@/lib/dynaxis/db/client.js';

export async function GET() {
  const configured = isPlatformDbConfigured();
  const memory = isMemoryDriverAllowed();
  return NextResponse.json({
    ok: configured || memory,
    persistence: memory ? 'memory' : configured ? 'postgresql' : 'unavailable',
    message: configured
      ? 'Dynaxis platform PostgreSQL is configured'
      : memory
        ? 'Memory store active (test/dev explicit only)'
        : 'DATABASE_URL is not set — platform APIs will return 503',
  });
}
