import type { NextRequest } from 'next/server';
import { errorResponse, withActor } from '@/server/http';
import { can } from '@/server/identity';
import { normalizeScanCode } from '@/server/queue/params';
import { EXPORT_KINDS, buildExport, resolvePeriod, type ExportKind } from '@/server/reports';
import { DomainError } from '@/server/workflow';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return withActor('report:read', async (actor, requestId) => {
    const params = request.nextUrl.searchParams;
    const kind = params.get('kind') ?? '';
    if (!(EXPORT_KINDS as readonly string[]).includes(kind)) {
      return errorResponse(400, 'CSSD_VALIDATION', 'Jenis ekspor tidak dikenal.', requestId);
    }
    if (kind === 'audit' && !can(actor, 'audit:read')) {
      return errorResponse(403, 'CSSD_FORBIDDEN', 'Peran Anda tidak dapat mengekspor audit.', requestId);
    }
    const rawCode = params.get('code');
    const code = rawCode ? normalizeScanCode(rawCode) : null;
    try {
      const period = resolvePeriod(actor.timeZone, params.get('from') ?? undefined, params.get('to') ?? undefined);
      const result = await buildExport(actor, kind as ExportKind, period, { code: code ?? undefined });
      return new Response(result.csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${result.filename}"`,
          'cache-control': 'no-store',
          'x-request-id': requestId,
        },
      });
    } catch (error) {
      if (error instanceof DomainError) return errorResponse(error.status, 'CSSD_VALIDATION', error.message, requestId);
      throw error;
    }
  });
}
