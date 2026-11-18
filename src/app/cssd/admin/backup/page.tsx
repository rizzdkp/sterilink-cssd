import type { Metadata } from 'next';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { AdminNav } from '@/components/cssd/admin-nav';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { formatDate, formatTime } from '@/lib/format';
import { backupNowAction } from '@/server/admin-actions';
import { BACKUP_DIR, listBackups } from '@/server/backup';
import { can, getActor } from '@/server/identity';

export const metadata: Metadata = { title: 'Backup' };

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function BackupPage() {
  const actor = await getActor();
  if (!actor || !can(actor, 'backup:manage')) return <NoAccess />;
  const files = listBackups();

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Master', 'Backup']}
        title="Backup"
        description="Backup otomatis dibuat sekali sehari dan disimpan 14 hari. Simpan salinan juga di luar server sesuai kebijakan TI rumah sakit."
      />
      <AdminNav active="backup" />
      <div className="stack">
        <section className="card" aria-labelledby="buat-judul">
          <h2 id="buat-judul">Buat backup sekarang</h2>
          <p className="muted">
            Disarankan sebelum pembaruan aplikasi atau perubahan master besar. Aplikasi tetap bisa dipakai selama proses.
          </p>
          <ActionForm action={backupNowAction} className="button-row">
            <SubmitButton pendingLabel="Membuat backup...">Buat backup</SubmitButton>
          </ActionForm>
        </section>

        <section className="card" aria-labelledby="daftar-judul">
          <h2 id="daftar-judul">Berkas backup ({files.length})</h2>
          <p className="muted num">Lokasi di server: {BACKUP_DIR}</p>
          {files.length === 0 ? (
            <p className="muted">Belum ada backup. Backup otomatis pertama dibuat dalam satu jam setelah aplikasi berjalan.</p>
          ) : (
            <div className="picker__scroll admin-table" tabIndex={0} role="region" aria-label="Daftar berkas backup">
              <table className="picker__table">
                <thead>
                  <tr>
                    <th scope="col">Berkas</th>
                    <th scope="col">Dibuat</th>
                    <th scope="col">Ukuran</th>
                    <th scope="col">
                      <span className="visually-hidden">Unduh</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.name}>
                      <th scope="row" className="num">
                        {file.name}
                      </th>
                      <td className="num">
                        {formatDate(file.createdAt.toISOString(), actor.timeZone)},{' '}
                        {formatTime(file.createdAt.toISOString(), actor.timeZone)}
                      </td>
                      <td className="num">{size(file.size)}</td>
                      <td>
                        <a href={`/api/v1/cssd/backup/${file.name}`} download>
                          Unduh
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="pulih-judul">
          <h2 id="pulih-judul">Memulihkan dari backup</h2>
          <ol className="steps">
            <li>Hentikan aplikasi.</li>
            <li>Simpan berkas database yang sekarang (prisma/dev.db atau lokasi DATABASE_URL) ke tempat lain.</li>
            <li>Salin berkas backup ke lokasi database dan beri nama yang sama.</li>
            <li>
              Jalankan <code>pnpm db:migrate</code>, lalu nyalakan aplikasi.
            </li>
            <li>
              Cocokkan stok fisik dan paket yang beredar sejak waktu backup, lalu catat ulang kejadian setelahnya dengan pencatatan mundur.
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}
