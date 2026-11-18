import { beforeAll, describe, expect, it } from 'vitest';
import { createAccount, passwordProblem, resetPassword, updateAccount } from '@/server/accounts';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import type { Actor } from '@/server/identity';
import { actorFromUserId } from '@/server/identity';
import { savePolicy, saveSetTemplate, saveUnit, setupChecklist } from '@/server/master';
import { buildExport, csvCell, getReport, resolvePeriod } from '@/server/reports';
import { DomainError } from '@/server/workflow';
import { actorByUsername } from './helpers';

let admin: Actor;
let reviewer: Actor;

beforeAll(async () => {
  admin = await actorByUsername('latihan.admin');
  reviewer = await actorByUsername('latihan.reviewer');
});

async function rejects(promise: Promise<unknown>, code: DomainError['code']) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
}

async function signIn(username: string, password: string) {
  return auth.api.signInUsername({ body: { username, password } }).then(
    (result) => result?.user.id ?? null,
    () => null,
  );
}

describe('kebijakan kata sandi', () => {
  it('menolak sandi pendek, tanpa angka, atau memuat username', () => {
    expect(passwordProblem('pendek1', 'budi')).not.toBeNull();
    expect(passwordProblem('tanpaangkasama', 'budi')).not.toBeNull();
    expect(passwordProblem('budisantoso2026', 'budi')).not.toBeNull();
    expect(passwordProblem('SterilAman2026', 'budi')).toBeNull();
  });
});

describe('akun pengguna', () => {
  it('admin membuat akun; sandi di-hash; pengguna wajib ganti sandi', async () => {
    const username = await createAccount(admin, {
      name: 'Siti Rahma',
      username: 'Siti.Rahma',
      password: 'AwalSementara2026',
      role: 'PACKING',
      unitId: '',
    });
    expect(username).toBe('siti.rahma');
    const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { accounts: true } });
    expect(user.mustChangePassword).toBe(true);
    expect(user.accounts[0]!.password).not.toContain('AwalSementara2026');
    expect(await signIn('siti.rahma', 'AwalSementara2026')).toBe(user.id);
    expect(await signIn('siti.rahma', 'salah-sandi-2026')).toBeNull();
    await rejects(
      createAccount(admin, { name: 'Siti Lain', username: 'siti.rahma', password: 'AwalSementara2026', role: 'PACKING', unitId: '' }),
      'CSSD_INVALID_STATE',
    );
  });

  it('petugas unit wajib diikat ke unit; non-admin tidak bisa membuat akun', async () => {
    await rejects(
      createAccount(admin, { name: 'Tanpa Unit', username: 'tanpa.unit', password: 'AwalSementara2026', role: 'UNIT', unitId: '' }),
      'CSSD_VALIDATION',
    );
    await rejects(
      createAccount(reviewer, { name: 'Coba Coba', username: 'coba.coba', password: 'AwalSementara2026', role: 'ADMIN', unitId: '' }),
      'CSSD_FORBIDDEN',
    );
  });

  it('akun nonaktif tidak bisa masuk dan sesinya dicabut', async () => {
    await createAccount(admin, {
      name: 'Andi Pratama',
      username: 'andi.pratama',
      password: 'AwalSementara2026',
      role: 'MACHINE',
      unitId: '',
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { username: 'andi.pratama' } });
    expect(await signIn('andi.pratama', 'AwalSementara2026')).toBe(user.id);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    await updateAccount(admin, { userId: user.id, role: 'MACHINE', unitId: '', active: false });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await signIn('andi.pratama', 'AwalSementara2026')).toBeNull();
    expect(await actorFromUserId(user.id)).toBeNull();
  });

  it('atur ulang sandi mencabut sesi dan mewajibkan ganti sandi', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { username: 'siti.rahma' } });
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    await resetPassword(admin, { userId: user.id, password: 'BaruSementara2026' });
    expect(await signIn('siti.rahma', 'AwalSementara2026')).toBeNull();
    expect(await signIn('siti.rahma', 'BaruSementara2026')).toBe(user.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(true);
  });

  it('admin aktif terakhir tidak bisa diturunkan atau menonaktifkan diri sendiri', async () => {
    await rejects(updateAccount(admin, { userId: admin.id, role: 'AUDITOR', unitId: '', active: true }), 'CSSD_INVALID_STATE');
    await rejects(updateAccount(admin, { userId: admin.id, role: 'ADMIN', unitId: '', active: false }), 'CSSD_INVALID_STATE');
  });
});

describe('master', () => {
  it('set baru wajib punya komponen dan masa simpan; komponen dobel ditolak', async () => {
    const base = { code: 'SET-TES', name: 'Set tes', description: '', active: true };
    await rejects(saveSetTemplate(admin, { ...base, shelfLifeDays: 30, components: [] }), 'CSSD_VALIDATION');
    await rejects(saveSetTemplate(admin, { ...base, shelfLifeDays: 0, components: [{ name: 'Klem', quantity: 2 }] }), 'CSSD_VALIDATION');
    await rejects(
      saveSetTemplate(admin, {
        ...base,
        shelfLifeDays: 30,
        components: [
          { name: 'Klem', quantity: 2 },
          { name: 'klem', quantity: 1 },
        ],
      }),
      'CSSD_VALIDATION',
    );
    await saveSetTemplate(admin, {
      ...base,
      shelfLifeDays: 30,
      components: [
        { name: 'Klem', quantity: 2 },
        { name: 'Gunting', quantity: 1 },
      ],
    });
    const set = await prisma.setTemplate.findFirstOrThrow({ where: { code: 'SET-TES' }, include: { components: true } });
    expect(set.components.map((item) => [item.name, item.quantity])).toEqual([
      ['Klem', 2],
      ['Gunting', 1],
    ]);
  });

  it('unit yang masih dipakai akun aktif tidak bisa dinonaktifkan', async () => {
    const unit = await prisma.unit.findFirstOrThrow({ where: { facilityId: admin.facilityId, code: 'OK' } });
    await rejects(saveUnit(admin, { id: unit.id, code: 'OK', name: unit.name, active: false }), 'CSSD_INVALID_STATE');
  });

  it('kebijakan wajib minimal satu indikator dan rujukan SOP', async () => {
    await rejects(
      savePolicy(admin, { method: 'STEAM', requirePhysical: false, requireChemical: false, requireBiological: false, reference: 'SOP' }),
      'CSSD_VALIDATION',
    );
    await rejects(
      savePolicy(admin, { method: 'STEAM', requirePhysical: true, requireChemical: true, requireBiological: true, reference: '' }),
      'CSSD_VALIDATION',
    );
  });

  it('daftar kesiapan menandai data latihan sebagai lengkap', async () => {
    const checklist = await setupChecklist(admin.facilityId);
    expect(checklist.filter((item) => !item.done).map((item) => item.key)).toEqual([]);
  });
});

describe('laporan dan ekspor', () => {
  it('sel CSV yang diawali tanda rumus dinetralkan', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+62')).toBe("'+62");
    expect(csvCell('Klem, lurus')).toBe('"Klem, lurus"');
    expect(csvCell(null)).toBe('');
  });

  it('periode salah ditolak; laporan menghitung rasio dengan penyebut', async () => {
    expect(() => resolvePeriod('Asia/Jakarta', '2026-11-10', '2026-11-01')).toThrow(DomainError);
    const supervisor = await actorByUsername('latihan.supervisor');
    const report = await getReport(supervisor, resolvePeriod('Asia/Jakarta'));
    expect(report.cleaningFail.denominator).toBeGreaterThanOrEqual(report.cleaningFail.numerator);
    await rejects(getReport(await actorByUsername('latihan.mesin'), resolvePeriod('Asia/Jakarta')), 'CSSD_FORBIDDEN');
  });

  it('ekspor audit tercatat sebagai kejadian audit', async () => {
    const auditor = await actorByUsername('latihan.auditor');
    const result = await buildExport(auditor, 'audit', resolvePeriod('Asia/Jakarta'));
    expect(result.csv.startsWith('﻿waktu_utc,kejadian')).toBe(true);
    expect(await prisma.auditEvent.count({ where: { action: 'Data diekspor', actorId: auditor.id } })).toBe(1);
  });
});
