import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { setupAction } from '@/server/actions';
import { isInstalled } from '@/server/identity';

export const metadata: Metadata = { title: 'Pemasangan' };
export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  // Wizard hanya ada sebelum fasilitas pertama dibuat; setelah itu tertutup permanen.
  if (await isInstalled()) redirect('/login');

  return (
    <AuthShell
      title="Pasang SIMRS CSSD"
      description="Langkah sekali saja: data rumah sakit dan akun admin pertama. Unit, set, mesin, kebijakan dan akun petugas diatur admin setelah ini."
    >
      <ActionForm action={setupAction} resetOnSuccess={false}>
        <fieldset>
          <legend>Fasilitas</legend>
          <label className="field">
            <span>Nama rumah sakit atau fasilitas</span>
            <input name="facilityName" required minLength={3} maxLength={120} autoComplete="organization" />
          </label>
          <label className="field">
            <span>Kode fasilitas (huruf, angka, tanda hubung)</span>
            <input name="facilityCode" required minLength={2} maxLength={20} autoCapitalize="characters" spellCheck={false} />
          </label>
          <label className="field">
            <span>Zona waktu</span>
            <select name="timeZone" required defaultValue="Asia/Jakarta">
              <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
              <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
              <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>Admin pertama</legend>
          <label className="field">
            <span>Nama lengkap</span>
            <input name="adminName" required minLength={3} maxLength={80} autoComplete="name" />
          </label>
          <label className="field">
            <span>Username</span>
            <input name="adminUsername" required minLength={3} maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </label>
          <label className="field">
            <span>Kata sandi (minimal 10 karakter, huruf dan angka)</span>
            <input name="adminPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
          </label>
          <label className="field">
            <span>Ulangi kata sandi</span>
            <input name="adminPasswordConfirm" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
          </label>
        </fieldset>
        <SubmitButton pendingLabel="Memasang...">Pasang dan masuk sebagai admin</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
