import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { backupPath } from '@/server/backup';
import { prisma } from '@/server/db';
import { errorResponse, withActor } from '@/server/http';
import { DomainError } from '@/server/workflow';

export const dynamic = 'force-dynamic';

export function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  return withActor('backup:manage', async (actor, requestId) => {
    const { name } = await context.params;
    let path: string;
    try {
      path = backupPath(name);
    } catch (error) {
      if (error instanceof DomainError) return errorResponse(404, 'CSSD_NOT_FOUND', error.message, requestId);
      throw error;
    }
    // Unduhan backup berisi seluruh data: dicatat siapa yang mengambilnya.
    await prisma.auditEvent.create({
      data: {
        facilityId: actor.facilityId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.roleLabel,
        action: 'Backup diunduh',
        entityType: 'BACKUP',
        entityCode: name,
        related: ` ${name} `,
      },
    });
    const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
    return new Response(stream, {
      headers: {
        'content-type': 'application/vnd.sqlite3',
        'content-length': String(statSync(path).size),
        'content-disposition': `attachment; filename="${name}"`,
        'cache-control': 'no-store',
        'x-request-id': requestId,
      },
    });
  });
}
