import { getD1 } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getD1()
      .prepare('SELECT 1 AS ok')
      .first<{ ok: number }>();
    if (result?.ok !== 1) throw new Error('DATABASE_NOT_READY');
    return Response.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Health check failed', error);
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
