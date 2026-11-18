import type { Prisma } from '@/generated/prisma/client';
import type { EvidenceKind, EvidenceOutcome, QueueStatus, Stage, SterilizationMethod } from '@/generated/prisma/enums';
import { prisma } from '../db';
import type { Actor } from '../identity';
import type { QueueQuery } from './params';
import { QUEUE_TABS, STAGES, TAB_STATUSES, stageProgress, type QueueTab, type StepState } from './status';

export interface QueueItem {
  code: string;
  setName: string;
  setDescription: string;
  unitLabel: string;
  setCount: number;
  method: SterilizationMethod;
  startedAt: string | null;
  targetAt: string | null;
  status: QueueStatus;
  synthetic: boolean;
  version: number;
}

export interface QueueResponse {
  items: QueueItem[];
  page: number;
  pageSize: number;
  total: number;
  tabs: Record<QueueTab, number>;
  generatedAt: string;
}

export interface TimelineStep {
  stage: Stage;
  state: StepState;
  occurredAt: string | null;
}

export interface EvidenceItem {
  kind: EvidenceKind;
  outcome: EvidenceOutcome;
  source: string | null;
  requiredBy: string | null;
  observedAt: string | null;
}

export interface LoadDetail extends QueueItem {
  originLabel: string;
  packageCodes: string[];
  timeline: TimelineStep[];
  evidence: EvidenceItem[];
  note: string | null;
}

const loadInclude = { setTemplate: true, originUnit: true } satisfies Prisma.LoadInclude;
type LoadRow = Prisma.LoadGetPayload<{ include: typeof loadInclude }>;

function toItem(row: LoadRow): QueueItem {
  return {
    code: row.code,
    setName: row.setTemplate.name,
    setDescription: row.setTemplate.description,
    unitLabel: row.originUnit.code,
    setCount: row.setCount,
    method: row.method,
    startedAt: row.startedAt?.toISOString() ?? null,
    targetAt: row.targetAt?.toISOString() ?? null,
    status: row.queueStatus,
    synthetic: row.synthetic,
    version: row.version,
  };
}

// Setiap query dibatasi fasilitas pelaku. Entitas di luar cakupan tidak pernah
// terbaca, sehingga keberadaannya tidak bocor lewat hitungan atau pencarian.
function scopeWhere(actor: Actor, query: Pick<QueueQuery, 'q' | 'unitId' | 'setTypeId' | 'method'>) {
  const where: Prisma.LoadWhereInput = { facilityId: actor.facilityId };
  if (query.unitId) where.originUnitId = query.unitId;
  if (query.setTypeId) where.setTemplateId = query.setTypeId;
  if (query.method) where.method = query.method;
  if (query.q) {
    where.OR = [
      { code: { contains: query.q } },
      { setTemplate: { name: { contains: query.q } } },
      { setTemplate: { description: { contains: query.q } } },
      { originUnit: { code: { contains: query.q } } },
      { originUnit: { name: { contains: query.q } } },
    ];
  }
  return where;
}

function orderBy(sort: QueueQuery['sort']): Prisma.LoadOrderByWithRelationInput[] {
  const [field, direction] = sort.split(':') as ['code' | 'startedAt' | 'targetAt', 'asc' | 'desc'];
  // Urutan kedua menjaga hasil tetap stabil antarhalaman.
  return [{ [field]: direction }, { id: 'asc' }];
}

function countByTab(groups: { queueStatus: QueueStatus; _count: { _all: number } }[]) {
  const tabs = Object.fromEntries(QUEUE_TABS.map((tab) => [tab, 0])) as Record<QueueTab, number>;
  for (const group of groups) {
    tabs.ALL += group._count._all;
    for (const [tab, statuses] of Object.entries(TAB_STATUSES)) {
      if (statuses.includes(group.queueStatus)) tabs[tab as QueueTab] += group._count._all;
    }
  }
  return tabs;
}

export async function getQueue(actor: Actor, query: QueueQuery): Promise<QueueResponse> {
  const scope = scopeWhere(actor, query);
  const statusFilters: Prisma.LoadWhereInput[] = [];
  if (query.tab !== 'ALL') statusFilters.push({ queueStatus: { in: [...TAB_STATUSES[query.tab]] } });
  if (query.status) statusFilters.push({ queueStatus: query.status });
  const where: Prisma.LoadWhereInput = { ...scope, AND: statusFilters };

  const [rows, total, groups] = await Promise.all([
    prisma.load.findMany({
      where,
      include: loadInclude,
      orderBy: orderBy(query.sort),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.load.count({ where }),
    // Hitungan tab mengikuti pencarian dan filter, tetapi tidak mengikuti tab aktif.
    prisma.load.groupBy({ by: ['queueStatus'], where: scope, _count: { _all: true } }),
  ]);

  return {
    items: rows.map(toItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
    tabs: countByTab(groups),
    generatedAt: new Date().toISOString(),
  };
}

export interface QueueSummary {
  total: number;
  awaitingEvidence: number;
  readyForReview: number;
  held: number;
  synthetic: boolean;
}

/** Ringkasan banner: seluruh cakupan fasilitas, tanpa filter. */
export async function getQueueSummary(actor: Actor): Promise<QueueSummary> {
  const [groups, syntheticCount] = await Promise.all([
    prisma.load.groupBy({
      by: ['queueStatus'],
      where: { facilityId: actor.facilityId },
      _count: { _all: true },
    }),
    prisma.load.count({ where: { facilityId: actor.facilityId, synthetic: true } }),
  ]);
  const count = (status: QueueStatus) => groups.find((group) => group.queueStatus === status)?._count._all ?? 0;
  return {
    total: groups.reduce((sum, group) => sum + group._count._all, 0),
    awaitingEvidence: count('AWAITING_EVIDENCE'),
    readyForReview: count('READY_FOR_REVIEW'),
    held: count('HELD'),
    synthetic: syntheticCount > 0,
  };
}

export interface FilterOption {
  id: string;
  label: string;
}

export async function getFilterOptions(actor: Actor): Promise<{ units: FilterOption[]; setTypes: FilterOption[] }> {
  const [units, setTypes] = await Promise.all([
    prisma.unit.findMany({ where: { facilityId: actor.facilityId }, orderBy: { code: 'asc' } }),
    prisma.setTemplate.findMany({ where: { facilityId: actor.facilityId }, orderBy: { name: 'asc' } }),
  ]);
  return {
    units: units.map((unit) => ({ id: unit.id, label: unit.code })),
    setTypes: setTypes.map((set) => ({ id: set.id, label: set.name })),
  };
}

const EVIDENCE_ORDER: EvidenceKind[] = ['PHYSICAL', 'CHEMICAL', 'BIOLOGICAL'];

/** Detail satu batch dalam cakupan pelaku, atau null bila tidak ditemukan. */
export async function getLoadDetail(actor: Actor, code: string): Promise<LoadDetail | null> {
  const row = await prisma.load.findUnique({
    where: { facilityId_code: { facilityId: actor.facilityId, code } },
    include: {
      ...loadInclude,
      packages: { orderBy: { code: 'asc' } },
      stageEvents: true,
      monitoringResults: true,
    },
  });
  if (!row) return null;

  const progress = stageProgress(row.queueStatus);
  const timeline = STAGES.map((stage, index): TimelineStep => {
    const event = row.stageEvents.find((item) => item.stage === stage);
    const state: StepState = index < progress.done ? 'done' : index === progress.current ? 'current' : 'upcoming';
    return { stage, state, occurredAt: event?.occurredAt.toISOString() ?? null };
  });

  const evidence = [...row.monitoringResults]
    .sort((a, b) => EVIDENCE_ORDER.indexOf(a.kind) - EVIDENCE_ORDER.indexOf(b.kind))
    .map((result): EvidenceItem => ({
      kind: result.kind,
      outcome: result.outcome,
      source: result.source,
      requiredBy: result.requiredBy,
      observedAt: result.observedAt?.toISOString() ?? null,
    }));

  const unit = row.originUnit;
  return {
    ...toItem(row),
    originLabel: unit.name === unit.code ? unit.code : `${unit.code} (${unit.name})`,
    packageCodes: row.packages.map((item) => item.code),
    timeline,
    evidence,
    note: row.note,
  };
}

export type ScanResult =
  | { type: 'BATCH'; code: string; status: QueueStatus; href: string }
  | { type: 'PACKAGE'; code: string; batchCode: string | null; href: string }
  | { type: 'TRAY'; code: string; href: string }
  | { type: 'CASE'; code: string; href: string };

const traceHref = (code: string) => `/cssd/trace?code=${encodeURIComponent(code)}`;

/**
 * Kenali jenis kode hasil pindai dalam cakupan pelaku: batch, paket, tray atau
 * kasus. Kode di luar fasilitas pelaku dijawab null, sama dengan kode yang tidak ada.
 */
export async function resolveScan(actor: Actor, code: string): Promise<ScanResult | null> {
  const key = { facilityId_code: { facilityId: actor.facilityId, code } };
  const [load, pack, tray, found] = await Promise.all([
    prisma.load.findUnique({ where: key }),
    prisma.package.findUnique({ where: key, include: { load: true } }),
    prisma.tray.findUnique({ where: key }),
    prisma.reprocessingCase.findUnique({ where: key }),
  ]);
  if (load) return { type: 'BATCH', code: load.code, status: load.queueStatus, href: `/cssd?batch=${encodeURIComponent(load.code)}` };
  if (pack) {
    return {
      type: 'PACKAGE',
      code: pack.code,
      batchCode: pack.load?.code ?? null,
      href: pack.load ? `/cssd?batch=${encodeURIComponent(pack.load.code)}` : traceHref(pack.code),
    };
  }
  if (tray) return { type: 'TRAY', code: tray.code, href: traceHref(tray.code) };
  if (found) return { type: 'CASE', code: found.code, href: '/cssd/receiving' };
  return null;
}
