import { CheckCircleIcon, CircleIcon } from '@phosphor-icons/react/dist/ssr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { AdminNav } from '@/components/cssd/admin-nav';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { savePolicyAction, saveFacilityAction } from '@/server/actions';
import { getFacilityAdmin } from '@/server/admin-data';
import { can, getActor } from '@/server/identity';
import { setupChecklist } from '@/server/master';

export const metadata: Metadata = { title: 'Master' };

const METHODS = [
  { value: 'STEAM', label: 'Uap' },
  { value: 'LOW_TEMP', label: 'Suhu rendah' },
] as const;

export default async function AdminPage() {
  const actor = await getActor();
  if (!actor || !can(actor, 'master:manage')) return <NoAccess />;
  const [{ facility, policies }, checklist] = await Promise.all([getFacilityAdmin(actor), setupChecklist(actor.facilityId)]);
  const remaining = checklist.filter((item) => !item.done).length;

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Master']}
        title="Master"
        description="Data rumah sakit yang dipakai seluruh alur. Admin mengelola master dan akun, tetapi tidak memproses atau melepas paket."
      />
      <AdminNav active="overview" />
      <div className="stack">
        <section className="card" aria-labelledby="kesiapan-judul">
          <h2 id="kesiapan-judul">{remaining === 0 ? 'Siap dipakai operasional' : `Kesiapan operasional: ${remaining} hal belum diisi`}</h2>
          <ul className="checklist-status">
            {checklist.map((item) => (
              <li key={item.key} className={item.done ? 'is-done' : undefined}>
                {item.done ? <CheckCircleIcon aria-hidden size={18} weight="fill" /> : <CircleIcon aria-hidden size={18} />}
                <span>{item.label}</span>
                <span className="visually-hidden">{item.done ? ', sudah' : ', belum'}</span>
                {item.done ? null : <Link href={item.href}>Isi sekarang</Link>}
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="fasilitas-judul">
          <h2 id="fasilitas-judul">Fasilitas</h2>
          <ActionForm action={saveFacilityAction} className="grid-form" resetOnSuccess={false}>
            <label className="field">
              <span>Kode (tetap)</span>
              <input value={facility.code} readOnly disabled />
            </label>
            <label className="field">
              <span>Nama</span>
              <input name="name" defaultValue={facility.name} required minLength={3} maxLength={120} />
            </label>
            <label className="field">
              <span>Zona waktu</span>
              <select name="timeZone" defaultValue={facility.timeZone}>
                <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
              </select>
            </label>
            <div className="grid-form__submit">
              <SubmitButton>Simpan fasilitas</SubmitButton>
            </div>
          </ActionForm>
        </section>

        <section className="card" aria-labelledby="kebijakan-judul">
          <h2 id="kebijakan-judul">Kebijakan bukti per metode</h2>
          <p className="muted">
            Indikator yang wajib tercatat sebelum batch boleh dilepas, sesuai SOP dan IFU rumah sakit. Perubahan berlaku untuk siklus yang
            selesai setelah disimpan; batch lama tetap memakai kebijakan saat siklusnya selesai.
          </p>
          <div className="policy-grid">
            {METHODS.map((method) => {
              const policy = policies.find((item) => item.method === method.value);
              return (
                <ActionForm key={method.value} action={savePolicyAction} className="policy" resetOnSuccess={false}>
                  <input type="hidden" name="method" value={method.value} />
                  <h3>Metode {method.label.toLowerCase()}</h3>
                  {policy ? null : <p className="hint-hold">Belum diatur. Siklus metode ini tidak bisa diselesaikan.</p>}
                  <fieldset className="policy__kinds">
                    <legend>Indikator wajib</legend>
                    <label>
                      <input type="checkbox" name="requirePhysical" defaultChecked={policy?.requirePhysical ?? false} /> Fisik
                    </label>
                    <label>
                      <input type="checkbox" name="requireChemical" defaultChecked={policy?.requireChemical ?? false} /> Kimia
                    </label>
                    <label>
                      <input type="checkbox" name="requireBiological" defaultChecked={policy?.requireBiological ?? false} /> Biologis
                    </label>
                  </fieldset>
                  <label className="field">
                    <span>Rujukan SOP atau IFU</span>
                    <input name="reference" defaultValue={policy?.reference ?? ''} required minLength={3} maxLength={80} />
                  </label>
                  <SubmitButton variant="secondary">Simpan kebijakan {method.label.toLowerCase()}</SubmitButton>
                </ActionForm>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
