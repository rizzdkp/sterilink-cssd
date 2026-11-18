import { NextResponse } from 'next/server';
import { getActor, can, type Actor, type Capability } from './identity';

export type ErrorCode =
  | 'CSSD_UNAUTHENTICATED'
  | 'CSSD_FORBIDDEN'
  | 'CSSD_VALIDATION'
  | 'CSSD_NOT_FOUND'
  | 'CSSD_SCAN_UNKNOWN'
  | 'CSSD_SETUP_REQUIRED'
  | 'CSSD_INTERNAL';

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
  };
}

/** Envelope galat baku: {error:{code,message,requestId,fieldErrors?}}. */
export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  requestId: string,
  fieldErrors?: Record<string, string[]>,
) {
  const body: ErrorBody = { error: { code, message, requestId, ...(fieldErrors ? { fieldErrors } : {}) } };
  return NextResponse.json(body, {
    status,
    headers: { 'x-request-id': requestId, 'cache-control': 'no-store' },
  });
}

export function okResponse<T>(data: T, requestId: string) {
  return NextResponse.json(data, {
    headers: { 'x-request-id': requestId, 'cache-control': 'no-store' },
  });
}

type Handler = (actor: Actor, requestId: string) => Promise<Response>;

/**
 * Pembungkus setiap endpoint: pastikan ada pelaku, cek kapabilitas, dan ubah
 * galat tak terduga menjadi 500 tanpa membocorkan detail internal.
 */
export async function withActor(capability: Capability, handler: Handler): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const actor = await getActor();
    if (!actor) {
      return errorResponse(401, 'CSSD_UNAUTHENTICATED', 'Sesi tidak ditemukan. Masuk lagi untuk melanjutkan.', requestId);
    }
    if (!can(actor, capability)) {
      return errorResponse(403, 'CSSD_FORBIDDEN', 'Peran Anda tidak memiliki izin untuk tindakan ini.', requestId);
    }
    return await handler(actor, requestId);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', requestId, message: (error as Error).message }));
    return errorResponse(500, 'CSSD_INTERNAL', 'Terjadi gangguan di server. Coba lagi sebentar lagi.', requestId);
  }
}
