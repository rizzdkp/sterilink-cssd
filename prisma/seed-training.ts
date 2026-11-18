// Data LATIHAN untuk pelatihan petugas, staging dan pengujian otomatis.
// Bukan bagian instalasi produksi: produksi dimulai kosong lewat wizard /setup.
//
// Pemakaian:  CSSD_TRAINING_PASSWORD="..." pnpm db:seed:training
// Kata sandi semua akun latihan diambil dari variabel itu (minimal 10 karakter,
// huruf dan angka); tidak ada kata sandi yang ditanam di kode.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword } from 'better-auth/crypto';
import { prisma } from '../src/server/db';
import { ROLES, type RoleKey } from '../src/server/identity';
import { projectQueueStatus } from '../src/server/queue/status';
import type { EvidenceKind, EvidenceOutcome, ProcessStatus, QualityStatus, QueueStatus, Stage } from '../src/generated/prisma/enums';

interface FixtureItem {
  code: string;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  method: 'STEAM' | 'LOW_TEMP';
  startedAt: string;
  targetAt: string;
  status: QueueStatus;
}

interface Fixture {
  synthetic: boolean;
  timeZone: string;
  items: FixtureItem[];
  selectedDetail: {
    code: string;
    originLabel: string;
    packageCodes: string[];
    timeline: [string, string | null][];
    evidence: { kind: 'FISIK' | 'KIMIA' | 'BIOLOGIS'; outcome: EvidenceOutcome; source?: string }[];
    notes: string;
  };
}

const KIND: Record<string, EvidenceKind> = { FISIK: 'PHYSICAL', KIMIA: 'CHEMICAL', BIOLOGIS: 'BIOLOGICAL' };
const STAGE_ORDER: Stage[] = ['RECEIVING', 'DECONTAMINATION', 'PACKING', 'STERILIZATION', 'VERIFICATION'];
const POLICY_REF = 'Kebijakan latihan';
const SOURCE = 'Data latihan';
const SEED_ACTOR = 'seed-latihan';
const DAY_MS = 24 * 60 * 60 * 1000;

const STATE: Record<string, { process: ProcessStatus; quality: QualityStatus; evidence: EvidenceOutcome | null }> = {
  WAITING_PROCESS: { process: 'LOADED', quality: 'PENDING', evidence: null },
  RUNNING: { process: 'RUNNING', quality: 'PENDING', evidence: null },
  AWAITING_EVIDENCE: { process: 'CYCLE_COMPLETED', quality: 'PENDING', evidence: null },
  READY_FOR_REVIEW: { process: 'CYCLE_COMPLETED', quality: 'PENDING', evidence: 'PASS' },
  RELEASED: { process: 'CYCLE_COMPLETED', quality: 'RELEASED', evidence: 'PASS' },
};

// Isi set latihan: instrumen bedah umum, cukup untuk berlatih inspeksi per komponen.
const BASE_COMPONENTS: [string, number][] = [
  ['Gagang pisau no. 3', 1],
  ['Gunting Metzenbaum', 1],
  ['Gunting Mayo lurus', 1],
  ['Pinset anatomis', 2],
  ['Pinset sirurgis', 2],
  ['Klem arteri Pean', 4],
  ['Needle holder', 1],
  ['Retraktor Langenbeck', 2],
];

const TRAINING_USERS: { role: RoleKey; username: string; name: string; unit?: string }[] = [
  { role: 'ADMIN', username: 'latihan.admin', name: 'Admin Latihan' },
  { role: 'RECEIVING', username: 'latihan.penerimaan', name: 'Operator Penerimaan Latihan' },
  { role: 'PACKING', username: 'latihan.pengemasan', name: 'Operator Pengemasan Latihan' },
  { role: 'MACHINE', username: 'latihan.mesin', name: 'Operator Mesin Latihan' },
  { role: 'REVIEWER', username: 'latihan.reviewer', name: 'Reviewer Mutu Latihan' },
  { role: 'WAREHOUSE', username: 'latihan.distribusi', name: 'Petugas Distribusi Latihan' },
  { role: 'UNIT', username: 'latihan.unit.ok', name: 'Petugas Unit OK Latihan', unit: 'OK' },
  { role: 'UNIT', username: 'latihan.unit.vk', name: 'Petugas Unit VK Latihan', unit: 'VK' },
  { role: 'SUPERVISOR', username: 'latihan.supervisor', name: 'Supervisor Latihan' },
  { role: 'AUDITOR', username: 'latihan.auditor', name: 'Auditor Latihan' },
];

function slug(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
}

const pad = (value: number) => String(value).padStart(4, '0');

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Data latihan ditolak di production.');
  const password = process.env.CSSD_TRAINING_PASSWORD ?? '';
  if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error('Isi CSSD_TRAINING_PASSWORD (minimal 10 karakter, huruf dan angka) untuk kata sandi akun latihan.');
  }
  if ((await prisma.facility.count()) > 0) {
    throw new Error('Database sudah berisi fasilitas. Data latihan hanya dimuat ke database kosong.');
  }

  const fixture = JSON.parse(readFileSync(resolve('CSSD-Master/fixtures/queue.visual.json'), 'utf8')) as Fixture;
  const hash = await hashPassword(password);

  // Satu transaksi: bila gagal di tengah, database tetap kosong dan wizard /setup tetap terbuka,
  // bukan setengah terisi tanpa akun yang bisa masuk.
  const trayTotal = await prisma.$transaction(
    async (db) => {
      const facility = await db.facility.create({ data: { code: 'LATIHAN', name: 'Fasilitas Latihan', timeZone: fixture.timeZone } });
      const facilityId = facility.id;
      const detail = fixture.selectedDetail;
      const originName = /\((.+)\)/.exec(detail.originLabel)?.[1];
      const detailUnit = fixture.items.find((item) => item.code === detail.code)?.unit;

      const unitIds = new Map<string, string>();
      for (const label of new Set(fixture.items.map((item) => item.unit))) {
        const unit = await db.unit.create({
          data: { facilityId, code: slug(label), name: label === detailUnit && originName ? originName : label },
        });
        unitIds.set(label, unit.id);
      }

      const sets = new Map<string, { id: string; total: number }>();
      for (const [index, item] of fixture.items.entries()) {
        if (sets.has(item.name)) continue;
        // Variasi kecil per set supaya latihan selisih tidak seragam.
        const components = BASE_COMPONENTS.map(([name, quantity], position) => ({
          name,
          quantity: position === index % BASE_COMPONENTS.length ? quantity + 1 : quantity,
          sortOrder: position,
        }));
        const set = await db.setTemplate.create({
          data: {
            facilityId,
            code: slug(item.name),
            name: item.name,
            description: item.description,
            shelfLifeDays: 30,
            components: { create: components },
          },
        });
        sets.set(item.name, { id: set.id, total: components.reduce((sum, row) => sum + row.quantity, 0) });
      }

      const devices = {
        STEAM: await db.device.create({ data: { facilityId, code: 'UAP-01', name: 'Sterilisator uap 1', method: 'STEAM' } }),
        LOW_TEMP: await db.device.create({ data: { facilityId, code: 'SR-01', name: 'Sterilisator suhu rendah 1', method: 'LOW_TEMP' } }),
      };
      await db.device.create({ data: { facilityId, code: 'UAP-02', name: 'Sterilisator uap 2', method: 'STEAM' } });
      for (const method of ['STEAM', 'LOW_TEMP'] as const) {
        await db.monitoringPolicy.create({
          data: { facilityId, method, requirePhysical: true, requireChemical: true, requireBiological: true, reference: POLICY_REF },
        });
      }
      const shelf = await db.location.create({ data: { facilityId, code: 'RAK-A', name: 'Rak steril A' } });
      await db.location.create({ data: { facilityId, code: 'RAK-B', name: 'Rak steril B' } });

      const snapshotDate = fixture.items[0]!.startedAt.slice(0, 10);
      let packageNumber = Math.max(...detail.packageCodes.map((code) => Number(code.slice(3))));
      let trayNumber = 0;

      for (const item of [...fixture.items].reverse()) {
        const state = STATE[item.status];
        if (!state) throw new Error(`Status fixture tidak dikenal: ${item.status}`);
        const isDetail = item.code === detail.code;
        const cycleDone = state.process === 'CYCLE_COMPLETED';
        const sterilizedAt = detail.timeline.find(([stage]) => stage === 'Sterilisasi')?.[1];
        const resultAt = isDetail && sterilizedAt ? new Date(`${snapshotDate}T${sterilizedAt}:00+07:00`) : new Date(item.targetAt);

        const evidence = isDetail
          ? detail.evidence.map((entry) => ({
              kind: KIND[entry.kind]!,
              outcome: entry.outcome,
              source: entry.source ?? null,
              requiredBy: POLICY_REF,
              observedAt: entry.outcome === 'PENDING' ? null : resultAt,
              recordedBy: entry.outcome === 'PENDING' ? null : SEED_ACTOR,
            }))
          : cycleDone
            ? (['PHYSICAL', 'CHEMICAL', 'BIOLOGICAL'] as EvidenceKind[]).map((kind) => ({
                kind,
                outcome: state.evidence ?? ('PENDING' as EvidenceOutcome),
                source: state.evidence ? SOURCE : null,
                requiredBy: POLICY_REF,
                observedAt: state.evidence ? resultAt : null,
                recordedBy: state.evidence ? SEED_ACTOR : null,
              }))
            : [];

        const queueStatus = projectQueueStatus({ processStatus: state.process, qualityStatus: state.quality, evidence });
        if (queueStatus !== item.status) throw new Error(`${item.code}: proyeksi ${queueStatus} tidak sama dengan fixture ${item.status}`);

        const set = sets.get(item.name)!;
        const originUnitId = unitIds.get(item.unit)!;
        const packageCodes = isDetail ? detail.packageCodes : Array.from({ length: item.quantity }, () => `PK-${pad(++packageNumber)}`);
        const released = state.quality === 'RELEASED';
        const releasedAt = released ? new Date() : null;

        const packages = [];
        for (const code of packageCodes) {
          const tray = await db.tray.create({
            data: { facilityId, code: `TR-${pad(++trayNumber)}`, setTemplateId: set.id, homeUnitId: originUnitId },
          });
          packages.push({
            facilityId,
            code,
            trayId: tray.id,
            setTemplateId: set.id,
            originUnitId,
            materialLot: 'LOT-LATIHAN',
            qualityStatus: state.quality,
            position: released ? ('AVAILABLE' as const) : ('CSSD' as const),
            locationId: released ? shelf.id : null,
            expiresAt: releasedAt ? new Date(releasedAt.getTime() + 30 * DAY_MS) : null,
            printCount: 1,
          });
        }

        await db.load.create({
          data: {
            facilityId,
            code: item.code,
            setTemplateId: set.id,
            originUnitId,
            setCount: item.quantity,
            method: item.method,
            deviceId: devices[item.method].id,
            processStatus: state.process,
            qualityStatus: state.quality,
            queueStatus,
            startedAt: new Date(item.startedAt),
            targetAt: new Date(item.targetAt),
            startedBy: state.process === 'LOADED' ? null : SEED_ACTOR,
            completedAt: cycleDone ? new Date(item.targetAt) : null,
            releasedAt,
            policyRef: cycleDone ? POLICY_REF : null,
            note: isDetail ? detail.notes : null,
            synthetic: true,
            monitoringResults: { create: evidence },
            packages: { create: packages },
            stageEvents: isDetail
              ? {
                  create: detail.timeline.flatMap(([, time], index) =>
                    time ? [{ stage: STAGE_ORDER[index]!, occurredAt: new Date(`${snapshotDate}T${time}:00+07:00`) }] : [],
                  ),
                }
              : undefined,
          },
        });
      }

      // Tray kosong di unit, untuk berlatih alur Penerimaan.
      for (const [name, set] of [...sets.entries()].slice(0, 5)) {
        const unit = fixture.items.find((item) => item.name === name)!.unit;
        await db.tray.create({
          data: { facilityId, code: `TR-${pad(++trayNumber)}`, setTemplateId: set.id, homeUnitId: unitIds.get(unit)! },
        });
      }

      const lastBatch = Math.max(...fixture.items.map((item) => Number(item.code.slice(3))));
      await db.counter.createMany({
        data: [
          { facilityId, kind: 'BT', value: lastBatch },
          { facilityId, kind: 'PK', value: packageNumber },
        ],
      });

      for (const user of TRAINING_USERS) {
        const id = randomUUID();
        await db.user.create({
          data: {
            id,
            name: user.name,
            username: user.username,
            displayUsername: user.username,
            email: `${user.username}@latihan.cssd.invalid`,
            emailVerified: true,
            role: user.role,
            facilityId,
            unitId: user.unit ? (unitIds.get(user.unit) ?? null) : null,
            mustChangePassword: false,
          },
        });
        await db.account.create({ data: { id: randomUUID(), userId: id, accountId: id, providerId: 'credential', password: hash } });
      }

      await db.auditEvent.create({
        data: {
          facilityId,
          actorId: SEED_ACTOR,
          actorName: 'Pemuat data latihan',
          actorRole: 'Sistem',
          action: 'Data latihan dimuat',
          entityType: 'FACILITY',
          entityCode: 'LATIHAN',
          related: ' LATIHAN ',
          detail: `${fixture.items.length} batch dan ${TRAINING_USERS.length} akun latihan. Bukan kejadian nyata.`,
        },
      });

      return trayNumber;
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  console.log(`Data latihan dimuat: ${fixture.items.length} batch, ${trayTotal} tray, ${TRAINING_USERS.length} akun.`);
  console.log(`Akun: ${TRAINING_USERS.map((user) => `${user.username} (${ROLES[user.role].label})`).join(', ')}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
