import { errorResponse, okResponse, withActor } from '@/server/http';
import { normalizeScanCode } from '@/server/queue/params';
import { resolveScan } from '@/server/queue/service';

export const dynamic = 'force-dynamic';

export function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  return withActor('queue:read', async (actor, requestId) => {
    const { code: rawCode } = await context.params;
    const code = normalizeScanCode(decodeURIComponent(rawCode));
    if (!code) {
      return errorResponse(400, 'CSSD_VALIDATION', 'Format kode tidak dikenali. Gunakan huruf, angka dan tanda hubung.', requestId);
    }
    const result = await resolveScan(actor, code);
    if (!result) {
      // Kode di luar cakupan dan kode yang tidak ada dijawab sama.
      return errorResponse(404, 'CSSD_SCAN_UNKNOWN', `Kode ${code} tidak ditemukan di fasilitas ini.`, requestId);
    }
    return okResponse({ ...result, nextActions: [{ kind: 'OPEN', href: result.href }] }, requestId);
  });
}
