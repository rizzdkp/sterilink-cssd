import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { changePasswordAction } from '@/server/actions';
import { getActor } from '@/server/identity';

export const metadata: Metadata = { title: 'Akun' };
export const dynamic = 'force-dynamic';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ wajib?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect('/login?next=/account');
  const required = actor.mustChangePassword || (await searchParams).wajib === '1';

  return (
    <AuthShell
      title={required ? 'Ganti kata sandi awal' : 'Ganti kata sandi'}
      description={
        required
          ? `${actor.name}, kata sandi Anda diberikan admin. Ganti dengan kata sandi pribadi sebelum mulai bekerja.`
          : `${actor.name} (${actor.username}), ${actor.roleLabel}. Sesi di perangkat lain akan dikeluarkan setelah kata sandi diganti.`
      }
    >
      <ActionForm action={changePasswordAction}>
        <input type="text" name="username" value={actor.username} autoComplete="username" readOnly hidden />
        <label className="field">
          <span>Kata sandi saat ini</span>
          <input name="currentPassword" type="password" required autoComplete="current-password" maxLength={128} />
        </label>
        <label className="field">
          <span>Kata sandi baru (minimal 10 karakter, huruf dan angka)</span>
          <input name="newPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
        </label>
        <label className="field">
          <span>Ulangi kata sandi baru</span>
          <input name="confirmPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
        </label>
        <SubmitButton>Simpan kata sandi baru</SubmitButton>
      </ActionForm>
      {required ? null : <Link href="/cssd">Kembali ke ruang kerja</Link>}
    </AuthShell>
  );
}
