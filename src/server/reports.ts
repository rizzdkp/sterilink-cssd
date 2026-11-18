// Laporan operasional (PRD P-15) dan ekspor CSV (P-15, P-16). Setiap angka
// disajikan dengan pembilang dan penyebutnya, dalam periode zona fasilitas.
import { prisma } from './db';
import type { Actor } from './identity';
import { facilityDayStart, toFacilityLocal } from './time';
import { DomainError, requireCapability } from './workflow';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface Period {
  from: string;
  to: string;
  start: Date;
  end: Date;
}

/** Periode laporan: tanggal awal dan akhir (inklusif) di zona fasilitas. Bawaan 30 hari terakhir. */
export function resolvePeriod(timeZone: string, from?: string, to?: string): Period {
  const today = toFacilityLocal(new Date(), timeZone).slice(0, 10);
  const end = to && DATE.test(to) ? to : today;
  const startDefault = toFacilityLocal(new Date(facilityDayStart(end, timeZone).getTime() - 29 * DAY_MS), timeZone).slice(0, 10);
  const start = from && DATE.test(from) ? from : startDefault;
  const startAt = facilityDayStart(start, timeZone);
  const endAt = new Date(facilityDayStart(end, timeZone).getTime() + DAY_MS);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
    throw new DomainError('CSSD_VALIDATION', 'Periode tidak valid: tanggal awal harus sebelum tanggal akhir.');
  }
  if (endAt.getTime() - startAt.getTime() > 366 * DAY_MS) throw new DomainError('CSSD_VALIDATION', 'Periode maksimal satu tahun.');
  return { from: start, to: end, start: startAt, end: endAt };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)]!;
}

export interface Ratio {
  numerator: number;
  denominator: number;
}

/** Waktu putar per paket: tray diterima sampai batch-nya dilepas. */
async function turnaroundRows(facilityId: string, period: Period) {
  const packages = await prisma.package.findMany({
    where: { facilityId, load: { releasedAt: { gte: period.start, lt: period.end } }, case: { isNot: null } },
    include: { load: true, case: { include: { originUnit: true } }, setTemplate: true },
    orderBy: { code: 'asc' },
  });
  return packages
    .filter((item) => item.case && item.load?.releasedAt)
    .map((item) => ({
      packageCode: item.code,
      setName: item.setTemplate?.name ?? '',
      unit: item.case!.originUnit.code,
      caseCode: item.case!.code,
      loadCode: item.load!.code,
      receivedAt: item.case!.receivedAt,
      releasedAt: item.load!.releasedAt!,
      hours: (item.load!.releasedAt!.getTime() - item.case!.receivedAt.getTime()) / 3_600_000,
    }));
}

export async function getReport(actor: Actor, period: Period) {
  requireCapability(actor, 'report:read');
  const facilityId = actor.facilityId;
  const inPeriod = { gte: period.start, lt: period.end };
  const [
    received,
    packed,
    released,
    dispatched,
    cleaning,
    cleaningFail,
    inspections,
    inspectionFail,
    acks,
    rejectedAcks,
    recallsOpened,
    recallsClosed,
    turnaround,
    byUnit,
    rejectedLoads,
  ] = await Promise.all([
    prisma.reprocessingCase.count({ where: { facilityId, receivedAt: inPeriod } }),
    prisma.package.count({ where: { facilityId, caseId: { not: null }, createdAt: inPeriod } }),
    prisma.load.count({ where: { facilityId, releasedAt: inPeriod } }),
    prisma.handoverLine.count({ where: { handover: { facilityId, dispatchedAt: inPeriod } } }),
    prisma.cleaningRun.count({ where: { case: { facilityId }, occurredAt: inPeriod } }),
    prisma.cleaningRun.count({ where: { case: { facilityId }, occurredAt: inPeriod, outcome: 'FAIL' } }),
    prisma.inspection.count({ where: { case: { facilityId }, occurredAt: inPeriod } }),
    prisma.inspection.count({ where: { case: { facilityId }, occurredAt: inPeriod, outcome: 'FAIL' } }),
    prisma.handoverLine.count({ where: { handover: { facilityId }, ackAt: inPeriod } }),
    prisma.handoverLine.count({ where: { handover: { facilityId }, ackAt: inPeriod, outcome: 'REJECTED' } }),
    prisma.recall.count({ where: { facilityId, openedAt: inPeriod } }),
    prisma.recall.count({ where: { facilityId, closedAt: inPeriod } }),
    turnaroundRows(facilityId, period),
    prisma.reprocessingCase.groupBy({ by: ['originUnitId'], where: { facilityId, receivedAt: inPeriod }, _count: { _all: true } }),
    prisma.qualityDecision.count({ where: { load: { facilityId }, decidedAt: inPeriod, decision: 'REJECT' } }),
  ]);
  const units = await prisma.unit.findMany({ where: { id: { in: byUnit.map((row) => row.originUnitId) } } });
  const hours = turnaround.map((row) => row.hours).sort((a, b) => a - b);
  return {
    volume: { received, packed, released, dispatched, recallsOpened, recallsClosed, rejectedLoads },
    turnaround: { n: hours.length, median: percentile(hours, 50), p90: percentile(hours, 90) },
    cleaningFail: { numerator: cleaningFail, denominator: cleaning } satisfies Ratio,
    inspectionFail: { numerator: inspectionFail, denominator: inspections } satisfies Ratio,
    unitRejected: { numerator: rejectedAcks, denominator: acks } satisfies Ratio,
    byUnit: byUnit
      .map((row) => ({ unit: units.find((unit) => unit.id === row.originUnitId)?.code ?? '-', count: row._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

// ---------- Ekspor CSV ----------

export const EXPORT_KINDS = ['turnaround', 'nonconformity', 'audit'] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

/**
 * Sel CSV aman untuk Excel: sel yang diawali = + - @ diberi tanda kutip tunggal
 * supaya tidak dijalankan sebagai rumus (CSV/formula injection).
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: string[], rows: unknown[][]): string {
  // BOM supaya Excel membaca UTF-8 dengan benar.
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export async function buildExport(
  actor: Actor,
  kind: ExportKind,
  period: Period,
  filter: { code?: string } = {},
): Promise<{ filename: string; csv: string; rows: number }> {
  const facilityId = actor.facilityId;
  const inPeriod = { gte: period.start, lt: period.end };
  let header: string[];
  let rows: unknown[][];

  if (kind === 'turnaround') {
    requireCapability(actor, 'report:read');
    const data = await turnaroundRows(facilityId, period);
    header = ['paket', 'set', 'unit_asal', 'kasus', 'batch', 'diterima_utc', 'dilepas_utc', 'jam_terima_ke_lepas'];
    rows = data.map((row) => [
      row.packageCode,
      row.setName,
      row.unit,
      row.caseCode,
      row.loadCode,
      row.receivedAt,
      row.releasedAt,
      row.hours.toFixed(2),
    ]);
  } else if (kind === 'nonconformity') {
    requireCapability(actor, 'report:read');
    const [runs, inspections] = await Promise.all([
      prisma.cleaningRun.findMany({
        where: { case: { facilityId }, occurredAt: inPeriod, outcome: 'FAIL' },
        include: { case: { include: { tray: true } } },
      }),
      prisma.inspection.findMany({
        where: { case: { facilityId }, occurredAt: inPeriod, outcome: 'FAIL' },
        include: { case: { include: { tray: true } }, lines: true },
      }),
    ]);
    header = ['waktu_utc', 'jenis', 'kasus', 'tray', 'rincian'];
    rows = [
      ...runs.map((run) => [
        run.occurredAt,
        'Dekontaminasi gagal',
        run.case.code,
        run.case.tray.code,
        `Percobaan ${run.attempt}: ${run.note ?? ''}`,
      ]),
      ...inspections.map((item) => [
        item.occurredAt,
        'Inspeksi gagal',
        item.case.code,
        item.case.tray.code,
        item.lines
          .filter((line) => line.condition !== 'OK' || line.actual !== line.expected)
          .map((line) => `${line.name} ${line.actual}/${line.expected} ${line.condition} ${line.note ?? ''}`)
          .join('; '),
      ]),
    ].sort((a, b) => (a[0] as Date).getTime() - (b[0] as Date).getTime());
  } else {
    requireCapability(actor, 'audit:read');
    const events = await prisma.auditEvent.findMany({
      where: { facilityId, occurredAt: inPeriod, ...(filter.code ? { related: { contains: ` ${filter.code} ` } } : {}) },
      orderBy: { occurredAt: 'asc' },
      take: 50_000,
    });
    header = ['waktu_utc', 'kejadian', 'kode', 'pelaku', 'peran', 'keterangan'];
    rows = events.map((event) => [event.occurredAt, event.action, event.entityCode, event.actorName, event.actorRole, event.detail ?? '']);
  }

  // Ekspor data keluar dari aplikasi: dicatat siapa, apa, periode dan jumlah baris.
  await prisma.auditEvent.create({
    data: {
      facilityId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.roleLabel,
      action: 'Data diekspor',
      entityType: 'EXPORT',
      entityCode: kind,
      related: ` ${kind} `,
      detail: `Periode ${period.from} sampai ${period.to}${filter.code ? `, kode ${filter.code}` : ''}, ${rows.length} baris.`,
    },
  });
  return { filename: `cssd-${kind}-${period.from}-${period.to}.csv`, csv: toCsv(header, rows), rows: rows.length };
}

export async function getAuditPage(actor: Actor, period: Period, filter: { code?: string; actor?: string; page: number }) {
  requireCapability(actor, 'audit:read');
  const where = {
    facilityId: actor.facilityId,
    occurredAt: { gte: period.start, lt: period.end },
    ...(filter.code ? { related: { contains: ` ${filter.code} ` } } : {}),
    ...(filter.actor ? { actorName: { contains: filter.actor } } : {}),
  };
  const pageSize = 50;
  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({ where, orderBy: { occurredAt: 'desc' }, skip: (filter.page - 1) * pageSize, take: pageSize }),
    prisma.auditEvent.count({ where }),
  ]);
  return { events, total, pageSize };
}
