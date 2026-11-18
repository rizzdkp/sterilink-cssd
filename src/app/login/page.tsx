import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { loginAction } from '@/server/actions';
import { getActor, isInstalled } from '@/server/identity';

export const metadata: Metadata = { title: 'Masuk' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await isInstalled())) redirect('/setup');
  if (await getActor()) redirect('/cssd');
  const { next } = await searchParams;

  return (
    <AuthShell title="Masuk" description="Gunakan akun yang diberikan admin CSSD. Setiap tindakan tercatat atas nama Anda.">
      <ActionForm action={loginAction} resetOnSuccess={false}>
        <input type="hidden" name="next" value={next ?? '/cssd'} />
        <label className="field">
          <span>Username</span>
          <input name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={32} autoFocus />
        </label>
        <label className="field">
          <span>Kata sandi</span>
          <input name="password" type="password" required autoComplete="current-password" maxLength={128} />
        </label>
        <SubmitButton pendingLabel="Memeriksa...">Masuk</SubmitButton>
      </ActionForm>
      <p className="auth__hint">Lupa kata sandi? Minta admin CSSD mengatur ulang dari menu Master, Pengguna.</p>
    </AuthShell>
  );
}
