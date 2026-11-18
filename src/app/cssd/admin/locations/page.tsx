import type { Metadata } from 'next';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { AdminNav } from '@/components/cssd/admin-nav';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { Tag } from '@/components/cssd/status-tag';
import { METHOD_LABEL } from '@/lib/format';
import { deviceStatusAction, saveDeviceAction, saveLocationAction, saveUnitAction } from '@/server/actions';
import type { ActionResult } from '@/server/actions';
import { getPlacesAdmin } from '@/server/admin-data';
import { can, getActor } from '@/server/identity';

export const metadata: Metadata = { title: 'Unit, rak, mesin' };

type FormAction = (previous: ActionResult, form: FormData) => Promise<ActionResult>;

interface Item {
  id: string;
  code: string;
  name: string;
  active: boolean;
  method?: 'STEAM' | 'LOW_TEMP';
}

function MethodSelect({ value }: { value?: string }) {
  return (
    <label className="field">
      <span>Metode</span>
      <select name="method" defaultValue={value ?? ''} required>
        <option value="" disabled>Pilih metode</option>
        <option value="STEAM">Uap</option>
        <option value="LOW_TEMP">Suhu rendah</option>
      </select>
    </label>
  );
}

/** Daftar master sederhana: tambah di atas, ubah per baris. */
function MasterSection({
  id,
  title,
  noun,
  items,
  action,
  withMethod = false,
}: {
  id: string;
  title: string;
  noun: string;
  items: Item[];
  action: FormAction;
  withMethod?: boolean;
}) {
  return (
    <section className="card" aria-labelledby={id}>
      <h2 id={id}>{title} ({items.length})</h2>
      <ActionForm action={action} className="inline-form">
        <label className="field">
          <span>Kode {noun}</span>
          <input name="code" required maxLength={20} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        </label>
        <label className="field field--grow">
          <span>Nama {noun}</span>
          <input name="name" required minLength={2} maxLength={80} />
        </label>
        {withMethod ? <MethodSelect /> : null}
        <div className="inline-form__buttons">
          <SubmitButton>Tambah {noun}</SubmitButton>
        </div>
      </ActionForm>
      {items.length > 0 ? (
        <ul className="admin-list">
          {items.map((item) => (
            <li key={item.id} className="admin-row">
              <ActionForm action={action} className="inline-form" resetOnSuccess={false}>
                <input type="hidden" name="id" value={item.id} />
                <label className="field">
                  <span>Kode</span>
                  <input name="code" defaultValue={item.code} required maxLength={20} autoCapitalize="characters" spellCheck={false} />
                </label>
                <label className="field field--grow">
                  <span>Nama</span>
                  <input name="name" defaultValue={item.name} required minLength={2} maxLength={80} />
                </label>
                {withMethod ? <MethodSelect value={item.method} /> : null}
                <label className="check">
                  <input type="checkbox" name="active" defaultChecked={item.active} />
                  Aktif
                </label>
                <div className="inline-form__buttons">
                  <SubmitButton variant="ghost">Simpan {item.code}</SubmitButton>
                </div>
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default async function PlacesPage() {
  const actor = await getActor();
  if (!actor || !can(actor, 'master:manage')) return <NoAccess />;
  const { units, locations, devices } = await getPlacesAdmin(actor);

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Master', 'Unit, rak, mesin']}
        title="Unit, rak, mesin"
        description="Unit pengguna yang meminta dan menerima set, rak penyimpanan steril, dan mesin sterilisasi beserta kelayakannya."
      />
      <AdminNav active="places" />
      <div className="stack">
        <MasterSection id="unit-judul" title="Unit pengguna" noun="unit" items={units} action={saveUnitAction} />
        <MasterSection id="rak-judul" title="Rak penyimpanan steril" noun="rak" items={locations} action={saveLocationAction} />
        <MasterSection id="mesin-judul" title="Mesin sterilisasi" noun="mesin" items={devices} action={saveDeviceAction} withMethod />

        {devices.some((device) => device.active) ? (
          <section className="card" aria-labelledby="kelayakan-judul">
            <h2 id="kelayakan-judul">Kelayakan mesin</h2>
            <p className="muted">Mesin tidak layak pakai tidak bisa dipilih untuk muatan sampai ditandai layak lagi oleh admin atau teknisi.</p>
            <ul className="admin-list">
              {devices.filter((device) => device.active).map((device) => (
                <li key={device.id} className="handover__line">
                  <span className="handover__package">
                    <span className="strong num">{device.code}</span>
                    <span className="muted">{device.name}, {METHOD_LABEL[device.method]}</span>
                  </span>
                  {device.status === 'ACTIVE' ? <Tag label="Layak pakai" tone="pass" /> : <Tag label="Tidak layak pakai" tone="hold" />}
                  <ActionForm action={deviceStatusAction} className="inline-form">
                    <input type="hidden" name="deviceId" value={device.id} />
                    <input type="hidden" name="status" value={device.status === 'ACTIVE' ? 'OUT_OF_SERVICE' : 'ACTIVE'} />
                    <label className="field field--grow">
                      <span>Alasan</span>
                      <input name="reason" required minLength={3} maxLength={200} />
                    </label>
                    <div className="inline-form__buttons">
                      <SubmitButton variant={device.status === 'ACTIVE' ? 'danger' : 'secondary'}>
                        {device.status === 'ACTIVE' ? 'Tandai tidak layak' : 'Tandai layak pakai'}
                      </SubmitButton>
                    </div>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
