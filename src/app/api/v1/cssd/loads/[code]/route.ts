import { errorResponse, okResponse, withActor } from '@/server/http';
import { normalizeScanCode } from '@/server/queue/params';
import { getLoadDetail } from '@/server/queue/service';

export const dynamic = 'force-dynamic';

export function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  return withActor('batch:read', async (actor, requestId) => {
    const { code: rawCode } = await context.params;
    const code = normalizeScanCode(decodeURIComponent(rawCode));
    const detail = code ? await getLoadDetail(actor, code) : null;
    if (!detail) {
      return errorResponse(404, 'CSSD_NOT_FOUND', 'Batch tidak ditemukan.', requestId);
    }
    return okResponse(detail, requestId);
  });
}
