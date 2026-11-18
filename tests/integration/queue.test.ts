import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import type { Actor } from '@/server/identity';
import { parseQueueQueryLenient } from '@/server/queue/params';
import { getLoadDetail, getQueue, getQueueSummary, resolveScan } from '@/server/queue/service';
import { actorByUsername } from './helpers';

// Route handler membaca sesi dari cookie permintaan; di tes, sesi diganti pelaku yang ditentukan.
const session = vi.hoisted(() => ({ actor: null as Actor | null }));
vi.mock('@/server/identity', async (original) => ({
  ...(await original<typeof import('@/server/identity')>()),
  getActor: async () => session.actor,
}));

const { GET: getQueueRoute } = await import('@/app/api/v1/cssd/queue/route');
const { GET: getScanRoute } = await import('@/app/api/v1/cssd/scan/[code]/route');

let actor: Actor;
let otherFacilityId: string;

beforeAll(async () => {
  actor = await actorByUsername('latihan.reviewer');

  // Fasilitas kedua untuk membuktikan isolasi cakupan (T06).
  const other = await prisma.facility.create({ data: { code: 'FAS-LAIN', name: 'Fasilitas Lain', timeZone: 'Asia/Makassar' } });
  otherFacilityId = other.id;
  const unit = await prisma.unit.create({ data: { facilityId: other.id, code: 'ICU', name: 'ICU' } });
  const set = await prisma.setTemplate.create({
    data: { facilityId: other.id, code: 'SET-RAHASIA', name: 'Set Rahasia', description: 'Milik fasilitas lain', shelfLifeDays: 30 },
  });
  await prisma.load.create({
    data: {
      facilityId: other.id,
      code: 'BT-9001',
      setTemplateId: set.id,
      originUnitId: unit.id,
      setCount: 1,
      method: 'STEAM',
      processStatus: 'RUNNING',
      queueStatus: 'RUNNING',
      packages: { create: [{ code: 'PK-9001', facilityId: other.id }] },
    },
  });
});

beforeEach(() => {
  session.actor = actor;
});

afterAll(async () => {
  await prisma.package.deleteMany({ where: { facilityId: otherFacilityId } });
  await prisma.load.deleteMany({ where: { facilityId: otherFacilityId } });
  await prisma.setTemplate.deleteMany({ where: { facilityId: otherFacilityId } });
  await prisma.unit.deleteMany({ where: { facilityId: otherFacilityId } });
  await prisma.facility.delete({ where: { id: otherFacilityId } });
  await prisma.$disconnect();
});

describe('getQueue', () => {
  it('halaman pertama memuat 10 batch terbaru dari 12, sesuai fixture', async () => {
    const queue = await getQueue(actor, parseQueueQueryLenient({}));
    expect(queue.total).toBe(12);
    expect(queue.items).toHaveLength(10);
    expect(queue.items[0]?.code).toBe('BT-0021');
    expect(queue.items.at(-1)?.code).toBe('BT-0012');
  });

  it('halaman kedua memuat dua batch sisanya', async () => {
    const queue = await getQueue(actor, parseQueueQueryLenient({ page: '2' }));
    expect(queue.items.map((item) => item.code)).toEqual(['BT-0011', 'BT-0010']);
  });

  it('hitungan tab saling lepas dan jumlahnya sama dengan Semua', async () => {
    const { tabs } = await getQueue(actor, parseQueueQueryLenient({}));
    expect(tabs).toEqual({ ALL: 12, WAITING_PROCESS: 3, STERILIZATION: 3, VERIFICATION: 3, DONE: 3 });
  });

  it('pencarian mencocokkan nama set tanpa membedakan huruf besar', async () => {
    const queue = await getQueue(actor, parseQueueQueryLenient({ q: 'KATARAK' }));
    expect(queue.items.map((item) => item.code)).toEqual(['BT-0012']);
  });

  it('filter metode dan status digabung, bukan saling menimpa', async () => {
    const queue = await getQueue(actor, parseQueueQueryLenient({ method: 'LOW_TEMP', status: 'RUNNING' }));
    expect(queue.items.map((item) => item.code)).toEqual(['BT-0017', 'BT-0013']);
  });

  it('urutan bisa dibalik dan tetap stabil', async () => {
    const queue = await getQueue(actor, parseQueueQueryLenient({ sort: 'code:asc', pageSize: '3' }));
    expect(queue.items.map((item) => item.code)).toEqual(['BT-0010', 'BT-0011', 'BT-0012']);
  });
});

describe('isolasi fasilitas (T06)', () => {
  it('batch fasilitas lain tidak ikut terhitung atau tercari', async () => {
    const queue = await getQueue(actor, parseQueueQueryLenient({ q: 'Rahasia' }));
    expect(queue.total).toBe(0);
    expect((await getQueueSummary(actor)).total).toBe(12);
  });

  it('detail dan pindaian kode fasilitas lain dijawab seperti tidak ada', async () => {
    expect(await getLoadDetail(actor, 'BT-9001')).toBeNull();
    expect(await resolveScan(actor, 'BT-9001')).toBeNull();
    expect(await resolveScan(actor, 'PK-9001')).toBeNull();
  });
});

describe('getLoadDetail', () => {
  it('BT-0021: siklus selesai, indikator biologis tertunda, hasil lain punya waktu hasil', async () => {
    const detail = (await getLoadDetail(actor, 'BT-0021'))!;
    expect(detail.status).toBe('AWAITING_EVIDENCE');
    expect(detail.originLabel).toBe('OK (Instalasi Bedah Sentral)');
    expect(detail.packageCodes).toHaveLength(6);
    expect(detail.evidence.map((item) => [item.kind, item.outcome, Boolean(item.observedAt)])).toEqual([
      ['PHYSICAL', 'PASS', true],
      ['CHEMICAL', 'PASS', true],
      ['BIOLOGICAL', 'PENDING', false],
    ]);
    expect(detail.timeline.map((step) => step.state)).toEqual(['done', 'done', 'done', 'done', 'current']);
  });
});

describe('resolveScan', () => {
  it('mengenali kode paket dan menunjuk batch-nya', async () => {
    expect(await resolveScan(actor, 'PK-0047')).toEqual({ type: 'PACKAGE', code: 'PK-0047', batchCode: 'BT-0021', href: '/cssd?batch=BT-0021' });
  });

  it('mengenali kode tray dan mengarahkannya ke pelacakan', async () => {
    expect(await resolveScan(actor, 'TR-0001')).toEqual({ type: 'TRAY', code: 'TR-0001', href: '/cssd/trace?code=TR-0001' });
  });
});

describe('API /api/v1/cssd', () => {
  const url = (path: string) => new NextRequest(`http://localhost/api/v1/cssd${path}`);

  it('GET /queue menjawab {items,page,pageSize,total} dengan x-request-id', async () => {
    const response = await getQueueRoute(url('/queue?tab=DONE'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).toMatchObject({ page: 1, pageSize: 10, total: 3 });
  });

  it('GET /queue menolak parameter salah dengan 400 dan envelope galat', async () => {
    const response = await getQueueRoute(url('/queue?pageSize=1000'));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe('CSSD_VALIDATION');
    expect(body.error.fieldErrors).toHaveProperty('pageSize');
  });

  it('tanpa sesi yang sah API menjawab 401, tanpa data', async () => {
    session.actor = null;
    const response = await getQueueRoute(url('/queue'));
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error.code).toBe('CSSD_UNAUTHENTICATED');
    expect(body.items).toBeUndefined();
  });

  it('peran tanpa hak baca antrean mendapat 403', async () => {
    session.actor = await actorByUsername('latihan.unit.ok');
    const response = await getQueueRoute(url('/queue'));
    expect(response.status).toBe(403);
  });

  it('GET /scan/{code} menjawab 404 CSSD_SCAN_UNKNOWN untuk kode tak dikenal', async () => {
    const response = await getScanRoute(url('/scan/BT-0000'), { params: Promise.resolve({ code: 'BT-0000' }) });
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('CSSD_SCAN_UNKNOWN');
  });
});
