import type { Metadata } from 'next';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { AdminNav } from '@/components/cssd/admin-nav';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { Tag } from '@/components/cssd/status-tag';
import { formatDate, formatTime } from '@/lib/format';
import { createUserAction, resetPasswordAction, updateUserAction } from '@/server/actions';
import { getUsersAdmin } from '@/server/admin-data';
import { ROLES, ROLE_KEYS, can, getActor, isRoleKey } from '@/server/identity';

export const metadata: Metadata = { title: 'Pengguna' };

function RoleOptions() {
  return (
    <>
      {ROLE_KEYS.map((key) => (
        <option key={key} value={key}>
          {ROLES[key].label}
        </option>
      ))}
    </>
  );
}

export default async function UsersPage() {
  const actor = await getActor();
  if (!actor || !can(actor, 'user:manage')) return <NoAccess />;
  const { users, units } = await getUsersAdmin(actor);

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Master', 'Pengguna']}
        title="Pengguna"
        description="Satu akun per orang. Kata sandi awal diberikan langsung kepada pengguna dan wajib diganti saat masuk pertama."
      />
      <AdminNav active="users" />
      <div className="stack">
        <section className="card" aria-labelledby="baru-judul">
          <h2 id="baru-judul">Tambah akun</h2>
          <ActionForm action={createUserAction} className="grid-form">
            <label className="field">
              <span>Nama lengkap</span>
              <input name="name" required minLength={3} maxLength={80} autoComplete="off" />
            </label>
            <label className="field">
              <span>Username</span>
              <input name="username" required minLength={3} maxLength={32} autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="field">
              <span>Kata sandi awal (minimal 10, huruf dan angka)</span>
              <input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
            </label>
            <label className="field">
              <span>Peran</span>
              <select name="role" required defaultValue="">
                <option value="" disabled>
                  Pilih peran
                </option>
                <RoleOptions />
              </select>
            </label>
            <label className="field">
              <span>Unit (wajib untuk Petugas Unit)</span>
              <select name="unitId" defaultValue="">
                <option value="">Tanpa unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code}, {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid-form__submit">
              <SubmitButton>Buat akun</SubmitButton>
            </div>
          </ActionForm>
        </section>

        <section className="card" aria-labelledby="daftar-judul">
          <h2 id="daftar-judul">Akun ({users.length})</h2>
          <ul className="admin-list">
            {users.map((user) => {
              const lastSeen = user.sessions[0]?.updatedAt;
              const role = isRoleKey(user.role) ? ROLES[user.role].label : user.role;
              const self = user.id === actor.id;
              return (
                <li key={user.id} className="admin-row">
                  <div className="admin-row__head">
                    <span className="strong">{user.name}</span>
                    <span className="muted num">{user.username}</span>
                    <span className="muted">
                      {role}
                      {user.unit ? `, unit ${user.unit.code}` : ''}
                      {lastSeen
                        ? `. Aktif terakhir ${formatDate(lastSeen.toISOString(), actor.timeZone)}, ${formatTime(lastSeen.toISOString(), actor.timeZone)}`
                        : '. Belum pernah masuk'}
                    </span>
                    <span className="admin-row__tags">
                      {user.active ? <Tag label="Aktif" tone="pass" /> : <Tag label="Nonaktif" tone="neutral" />}
                      {user.mustChangePassword ? <Tag label="Wajib ganti sandi" tone="wait" /> : null}
                    </span>
                  </div>
                  <details className="admin-row__edit">
                    <summary>Ubah {self ? 'akun Anda' : `akun ${user.username}`}</summary>
                    <ActionForm action={updateUserAction} className="inline-form" resetOnSuccess={false}>
                      <input type="hidden" name="userId" value={user.id} />
                      <label className="field">
                        <span>Peran</span>
                        <select name="role" defaultValue={user.role}>
                          <RoleOptions />
                        </select>
                      </label>
                      <label className="field">
                        <span>Unit</span>
                        <select name="unitId" defaultValue={user.unitId ?? ''}>
                          <option value="">Tanpa unit</option>
                          {units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.code}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="check">
                        <input type="checkbox" name="active" defaultChecked={user.active} disabled={self} />
                        Aktif
                        {self ? <input type="hidden" name="active" value="on" /> : null}
                      </label>
                      <div className="inline-form__buttons">
                        <SubmitButton variant="secondary">Simpan perubahan</SubmitButton>
                      </div>
                    </ActionForm>
                    <ActionForm action={resetPasswordAction} className="inline-form">
                      <input type="hidden" name="userId" value={user.id} />
                      <label className="field field--grow">
                        <span>Kata sandi sementara baru</span>
                        <input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
                      </label>
                      <div className="inline-form__buttons">
                        <SubmitButton variant="danger">Atur ulang kata sandi</SubmitButton>
                      </div>
                    </ActionForm>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
