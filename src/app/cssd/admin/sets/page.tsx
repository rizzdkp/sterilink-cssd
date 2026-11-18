import type { Metadata } from 'next';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { AdminNav } from '@/components/cssd/admin-nav';
import { ComponentsEditor } from '@/components/cssd/components-editor';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { Tag } from '@/components/cssd/status-tag';
import { createTrayAction, saveSetAction, updateTrayAction } from '@/server/actions';
import { getSetsAdmin } from '@/server/admin-data';
import { can, getActor } from '@/server/identity';

export const metadata: Metadata = { title: 'Set dan tray' };

type SetRow = Awaited<ReturnType<typeof getSetsAdmin>>['sets'][number];

function SetForm({ set }: { set?: SetRow }) {
  return (
    <ActionForm action={saveSetAction} className="stack stack--tight" resetOnSuccess={!set}>
      {set ? <input type="hidden" name="id" value={set.id} /> : null}
      <div className="grid-form">
        <label className="field">
          <span>Kode set</span>
          <input name="code" defaultValue={set?.code ?? ''} required maxLength={20} autoCapitalize="characters" spellCheck={false} />
        </label>
        <label className="field">
          <span>Nama set</span>
          <input name="name" defaultValue={set?.name ?? ''} required minLength={2} maxLength={80} />
        </label>
        <label className="field">
          <span>Masa simpan steril (hari)</span>
          <input name="shelfLifeDays" type="number" inputMode="numeric" min={1} max={3650} defaultValue={set?.shelfLifeDays ?? ''} required />
        </label>
        <label className="field field--wide">
          <span>Keterangan</span>
          <input name="description" defaultValue={set?.description ?? ''} maxLength={160} />
        </label>
        {set ? (
          <label className="check">
            <input type="checkbox" name="active" defaultChecked={set.active} />
            Aktif (dapat dipakai untuk tray dan permintaan)
          </label>
        ) : null}
      </div>
      <ComponentsEditor initial={set?.components.map((item) => ({ name: item.name, quantity: item.quantity })) ?? []} />
      <div>
        <SubmitButton variant={set ? 'secondary' : 'primary'}>{set ? `Simpan ${set.code}` : 'Tambah set'}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function SetsPage() {
  const actor = await getActor();
  if (!actor || !can(actor, 'master:manage')) return <NoAccess />;
  const { sets, trays, units } = await getSetsAdmin(actor);
  const activeSets = sets.filter((set) => set.active);

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Master', 'Set dan tray']}
        title="Set dan tray"
        description="Isi set per komponen menjadi dasar penerimaan dan inspeksi. Masa simpan menentukan tanggal kedaluwarsa paket saat dilepas."
      />
      <AdminNav active="sets" />
      <div className="stack">
        <section className="card" aria-labelledby="set-baru-judul">
          <h2 id="set-baru-judul">Tambah set</h2>
          <SetForm />
        </section>

        <section className="card" aria-labelledby="set-daftar-judul">
          <h2 id="set-daftar-judul">Set ({sets.length})</h2>
          {sets.length === 0 ? (
            <p className="muted">Belum ada set. Tambahkan set pertama di atas, lengkap dengan daftar komponennya.</p>
          ) : (
            <ul className="admin-list">
              {sets.map((set) => (
                <li key={set.id} className="admin-row">
                  <div className="admin-row__head">
                    <span className="strong">{set.name}</span>
                    <span className="muted num">{set.code}</span>
                    <span className="muted">
                      {set.components.length} jenis, {set.components.reduce((sum, item) => sum + item.quantity, 0)} buah, masa simpan {set.shelfLifeDays} hari,{' '}
                      {set._count.trays} tray
                    </span>
                    <span className="admin-row__tags">{set.active ? <Tag label="Aktif" tone="pass" /> : <Tag label="Nonaktif" tone="neutral" />}</span>
                  </div>
                  <details className="admin-row__edit">
                    <summary>Ubah {set.code}</summary>
                    <SetForm set={set} />
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="tray-judul">
          <h2 id="tray-judul">Tray ({trays.length})</h2>
          {activeSets.length === 0 || units.length === 0 ? (
            <p className="hint-hold">Tambahkan minimal satu set aktif dan satu unit sebelum mendaftarkan tray.</p>
          ) : (
            <ActionForm action={createTrayAction} className="grid-form">
              <label className="field">
                <span>Kode tray (sesuai label fisik)</span>
                <input name="code" required minLength={3} maxLength={20} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
              </label>
              <label className="field">
                <span>Jenis set</span>
                <select name="setTemplateId" required defaultValue="">
                  <option value="" disabled>Pilih set</option>
                  {activeSets.map((set) => (
                    <option key={set.id} value={set.id}>{set.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Unit pemilik</span>
                <select name="homeUnitId" required defaultValue="">
                  <option value="" disabled>Pilih unit</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.code}</option>
                  ))}
                </select>
              </label>
              <div className="grid-form__submit">
                <SubmitButton>Daftarkan tray</SubmitButton>
              </div>
            </ActionForm>
          )}
          {trays.length > 0 ? (
            <div className="picker__scroll admin-table" tabIndex={0} role="region" aria-label="Daftar tray">
              <table className="picker__table">
                <thead>
                  <tr>
                    <th scope="col">Tray</th>
                    <th scope="col">Set</th>
                    <th scope="col">Unit pemilik dan status</th>
                  </tr>
                </thead>
                <tbody>
                  {trays.map((tray) => (
                    <tr key={tray.id}>
                      <th scope="row" className="num">{tray.code}</th>
                      <td>{tray.setTemplate.name}</td>
                      <td>
                        <ActionForm action={updateTrayAction} className="row-form" resetOnSuccess={false}>
                          <input type="hidden" name="trayId" value={tray.id} />
                          <select name="homeUnitId" defaultValue={tray.homeUnitId} aria-label={`Unit pemilik ${tray.code}`}>
                            {units.map((unit) => (
                              <option key={unit.id} value={unit.id}>{unit.code}</option>
                            ))}
                          </select>
                          <label className="check">
                            <input type="checkbox" name="active" defaultChecked={tray.active} />
                            Aktif
                          </label>
                          <SubmitButton variant="ghost">Simpan</SubmitButton>
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
