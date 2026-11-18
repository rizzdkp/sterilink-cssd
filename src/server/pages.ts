// Query baca untuk halaman alur kerja. Semuanya dibatasi fasilitas pelaku.
import { prisma } from './db';
import type { Actor } from './identity';
import { availableWhere } from './workflow';

export async function getReceivingData(actor: Actor) {
  const facilityId = actor.facilityId;
  const [units, cases, recentPackages] = await Promise.all([
    prisma.unit.findMany({ where: { facilityId, active: true }, orderBy: { code: 'asc' } }),
    prisma.reprocessingCase.findMany({
      where: { facilityId, status: { not: 'PACKAGED' } },
      include: {
        tray: { include: { setTemplate: { include: { components: { orderBy: { sortOrder: 'asc' } } } } } },
        originUnit: true,
        cleaningRuns: { orderBy: { attempt: 'desc' } },
        inspections: { orderBy: { occurredAt: 'desc' } },
      },
      orderBy: { receivedAt: 'asc' },
    }),
    prisma.package.findMany({
      where: { facilityId, caseId: { not: null }, loadId: null, position: 'CSSD' },
      include: { setTemplate: true, tray: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);
  return { units, cases, recentPackages };
}

export async function getBatchesData(actor: Actor) {
  const facilityId = actor.facilityId;
  const [devices, readyPackages, activeLoads] = await Promise.all([
    prisma.device.findMany({ where: { facilityId }, orderBy: { code: 'asc' } }),
    prisma.package.findMany({
      where: { facilityId, loadId: null, position: 'CSSD', qualityStatus: 'PENDING', blocked: false },
      include: { setTemplate: true, tray: true },
      orderBy: { code: 'asc' },
    }),
    prisma.load.findMany({
      where: { facilityId, processStatus: { in: ['LOADED', 'RUNNING', 'CYCLE_COMPLETED'] }, qualityStatus: { in: ['PENDING', 'HOLD'] } },
      include: { setTemplate: true, device: true },
      orderBy: { code: 'desc' },
    }),
  ]);
  return { devices, readyPackages, activeLoads };
}

export async function getBatchActivity(actor: Actor, loadCode: string) {
  const load = await prisma.load.findUnique({
    where: { facilityId_code: { facilityId: actor.facilityId, code: loadCode } },
    include: {
      device: true,
      decisions: { orderBy: { decidedAt: 'desc' } },
      recalls: { orderBy: { openedAt: 'desc' } },
    },
  });
  if (!load) return null;
  const audit = await prisma.auditEvent.findMany({
    where: { facilityId: actor.facilityId, related: { contains: ` ${loadCode} ` } },
    orderBy: { occurredAt: 'desc' },
    take: 50,
  });
  return { load, audit };
}

export async function getStockData(actor: Actor) {
  const facilityId = actor.facilityId;
  const now = new Date();
  const include = { setTemplate: true, location: true, load: true, destinationUnit: true } as const;
  const [available, expired, held, returned, locations] = await Promise.all([
    prisma.package.findMany({
      where: availableWhere(facilityId, now),
      include,
      orderBy: [{ expiresAt: 'asc' }, { code: 'asc' }],
    }),
    prisma.package.findMany({
      where: { facilityId, position: 'AVAILABLE', expiresAt: { lte: now } },
      include,
      orderBy: { expiresAt: 'asc' },
    }),
    prisma.package.findMany({
      where: {
        facilityId,
        OR: [{ blocked: true }, { qualityStatus: 'HOLD' }],
        position: { in: ['CSSD', 'AVAILABLE', 'DISPATCHED', 'RETURNED'] },
      },
      include,
      orderBy: { code: 'asc' },
    }),
    prisma.package.findMany({
      where: { facilityId, position: 'RETURNED', caseId: { not: null } },
      include,
      orderBy: { code: 'asc' },
      take: 50,
    }),
    prisma.location.findMany({ where: { facilityId, active: true }, orderBy: { code: 'asc' } }),
  ]);
  return { available, expired, held, returned, locations, asOf: now.getTime() };
}

export async function getDistributionData(actor: Actor) {
  const facilityId = actor.facilityId;
  // Petugas unit hanya melihat serah terima untuk unitnya sendiri.
  const scope = actor.unitId ? { destinationUnitId: actor.unitId } : {};
  const [units, available, handovers, requests] = await Promise.all([
    prisma.unit.findMany({ where: { facilityId, active: true }, orderBy: { code: 'asc' } }),
    prisma.package.findMany({
      where: availableWhere(facilityId),
      include: { setTemplate: true, location: true, load: true },
      orderBy: [{ expiresAt: 'asc' }, { code: 'asc' }],
    }),
    prisma.handover.findMany({
      where: { facilityId, ...scope },
      include: { destinationUnit: true, request: true, lines: { include: { package: { include: { setTemplate: true } } } } },
      orderBy: { dispatchedAt: 'desc' },
      take: 30,
    }),
    prisma.unitRequest.findMany({
      where: { facilityId, status: { in: ['OPEN', 'PARTIAL'] } },
      include: { unit: true, setTemplate: true },
      orderBy: [{ priority: 'desc' }, { neededBy: 'asc' }],
    }),
  ]);
  return { units, available, handovers, requests };
}

export async function getRequestsData(actor: Actor) {
  const facilityId = actor.facilityId;
  // Petugas unit hanya melihat permintaan unitnya.
  const scope = actor.unitId ? { unitId: actor.unitId } : {};
  const [requests, sets] = await Promise.all([
    prisma.unitRequest.findMany({
      where: { facilityId, ...scope },
      include: { unit: true, setTemplate: true },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { neededBy: 'asc' }],
      take: 100,
    }),
    prisma.setTemplate.findMany({ where: { facilityId, active: true }, orderBy: { name: 'asc' } }),
  ]);
  return { requests, sets };
}

export async function getRecalls(actor: Actor) {
  return prisma.recall.findMany({
    where: { facilityId: actor.facilityId },
    include: { load: true, items: true },
    orderBy: { openedAt: 'desc' },
  });
}

export async function getRecall(actor: Actor, code: string) {
  return prisma.recall.findUnique({
    where: { facilityId_code: { facilityId: actor.facilityId, code } },
    include: {
      load: true,
      items: { include: { package: { include: { destinationUnit: true, setTemplate: true } } }, orderBy: { package: { code: 'asc' } } },
    },
  });
}

export async function getTrace(actor: Actor, code: string) {
  const facilityId = actor.facilityId;
  const key = { facilityId_code: { facilityId, code } };
  const [pack, load, tray, found, audit] = await Promise.all([
    prisma.package.findUnique({
      where: key,
      include: { load: true, setTemplate: true, tray: true, location: true, destinationUnit: true, case: true },
    }),
    prisma.load.findUnique({ where: key, include: { setTemplate: true, packages: true } }),
    prisma.tray.findUnique({
      where: key,
      include: {
        setTemplate: true,
        homeUnit: true,
        packages: { orderBy: { createdAt: 'desc' } },
        cases: { orderBy: { receivedAt: 'desc' } },
      },
    }),
    prisma.reprocessingCase.findUnique({ where: key, include: { tray: true } }),
    prisma.auditEvent.findMany({
      where: { facilityId, related: { contains: ` ${code} ` } },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    }),
  ]);
  return { pack, load, tray, found, audit };
}

export async function getAdminData(actor: Actor) {
  const facilityId = actor.facilityId;
  const [devices, trays, units, sets] = await Promise.all([
    prisma.device.findMany({ where: { facilityId }, orderBy: { code: 'asc' } }),
    prisma.tray.findMany({ where: { facilityId }, include: { setTemplate: true, homeUnit: true }, orderBy: { code: 'desc' }, take: 40 }),
    prisma.unit.findMany({ where: { facilityId }, orderBy: { code: 'asc' } }),
    prisma.setTemplate.findMany({ where: { facilityId }, orderBy: { name: 'asc' } }),
  ]);
  return { devices, trays, units, sets };
}

export interface Attention {
  count: number;
  label: string;
  href: string;
}

/**
 * Pekerjaan yang menunggu peran ini, untuk penanda di kepala halaman. Selalu
 * menunjuk ke layar tempat pekerjaan itu diselesaikan.
 */
export async function getAttention(actor: Actor): Promise<Attention> {
  const facilityId = actor.facilityId;
  switch (actor.role) {
    case 'REVIEWER':
      return {
        count: await prisma.load.count({ where: { facilityId, queueStatus: { in: ['READY_FOR_REVIEW', 'HELD'] } } }),
        label: 'batch menunggu keputusan',
        href: '/cssd?tab=VERIFICATION',
      };
    case 'MACHINE':
      return {
        count: await prisma.package.count({
          where: { facilityId, loadId: null, position: 'CSSD', qualityStatus: 'PENDING', blocked: false },
        }),
        label: 'paket siap dimuat',
        href: '/cssd/batches',
      };
    case 'RECEIVING':
      return {
        count: await prisma.reprocessingCase.count({ where: { facilityId, status: 'RECEIVED' } }),
        label: 'tray menunggu dekontaminasi',
        href: '/cssd/receiving',
      };
    case 'PACKING':
      return {
        count: await prisma.reprocessingCase.count({ where: { facilityId, status: { in: ['INSPECTION', 'PACKING'] } } }),
        label: 'kasus menunggu inspeksi atau kemas',
        href: '/cssd/receiving',
      };
    case 'WAREHOUSE':
      return {
        count: await prisma.package.count({ where: { facilityId, position: 'AVAILABLE', qualityStatus: 'RELEASED', blocked: false } }),
        label: 'paket siap dikirim',
        href: '/cssd/distributions',
      };
    case 'UNIT':
      return {
        count: await prisma.handoverLine.count({
          where: { outcome: 'PENDING', handover: { facilityId, ...(actor.unitId ? { destinationUnitId: actor.unitId } : {}) } },
        }),
        label: 'paket menunggu konfirmasi',
        href: '/cssd/distributions',
      };
    case 'SUPERVISOR':
      return {
        count: await prisma.recall.count({ where: { facilityId, status: 'OPEN' } }),
        label: 'recall terbuka',
        href: '/cssd/recalls',
      };
    case 'AUDITOR':
      return {
        count: await prisma.recall.count({ where: { facilityId, status: 'OPEN' } }),
        label: 'recall terbuka',
        href: '/cssd/recalls',
      };
    case 'ADMIN':
      return {
        count: await prisma.device.count({ where: { facilityId, status: 'OUT_OF_SERVICE' } }),
        label: 'mesin tidak layak pakai',
        href: '/cssd/admin',
      };
  }
}
