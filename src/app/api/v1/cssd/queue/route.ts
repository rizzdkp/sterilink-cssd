import type { NextRequest } from 'next/server';
import { errorResponse, okResponse, withActor } from '@/server/http';
import { parseQueueQuery } from '@/server/queue/params';
import { getQueue } from '@/server/queue/service';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return withActor('queue:read', async (actor, requestId) => {
    const parsed = parseQueueQuery(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.ok) {
      return errorResponse(400, 'CSSD_VALIDATION', 'Parameter antrean tidak valid.', requestId, parsed.fieldErrors);
    }
    return okResponse(await getQueue(actor, parsed.query), requestId);
  });
}
