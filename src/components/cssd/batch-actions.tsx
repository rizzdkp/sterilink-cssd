import { decisionAction, evidenceAction, loadTransitionAction, openRecallAction } from '@/server/actions';
import { can, type Actor } from '@/server/identity';
import type { LoadDetail } from '@/server/queue/service';
import { EVIDENCE_LABEL } from '@/lib/format';
import { ActionForm, SubmitButton } from './action-form';
import { BackdateFields } from './backdate-fields';
import { OutcomeTag } from './status-tag';

interface LoadFacts {
  code: string;
  version: number;
  processStatus: string;
  qualityStatus: string;
  startedBy: string | null;
  hasOpenRecall: boolean;
}

/** Alasan pelepasan belum boleh, dihitung dengan aturan yang sama dengan server. */
function releaseBlocker(detail: LoadDetail, facts: LoadFacts, actor: Actor): string | null {
  if (facts.hasOpenRecall) return 'Ada recall terbuka pada batch ini.';
  if (facts.startedBy === actor.id) return 'Anda menjalankan siklus batch ini; keputusan mutu harus oleh petugas lain.';
  const failed = detail.evidence.filter((item) => item.outcome === 'FAIL');
  if (failed.length > 0) return `Indikator ${failed.map((item) => EVIDENCE_LABEL[item.kind].toLowerCase()).join(', ')} tidak memenuhi.`;
  const pending = detail.evidence.filter((item) => item.outcome === 'PENDING');
  if (pending.length > 0 || detail.evidence.length === 0) {
    return `Hasil indikator ${pending.map((item) => EVIDENCE_LABEL[item.kind].toLowerCase()).join(', ') || 'wajib'} belum tercatat.`;
  }
  return null;
}

function Hidden({ facts }: { facts: LoadFacts }) {
  return (
    <>
      <input type="hidden" name="loadCode" value={facts.code} />
      <input type="hidden" name="version" value={facts.version} />
    </>
  );
}

export function BatchActions({ actor, detail, facts, nowLocal }: { actor: Actor; detail: LoadDetail; facts: LoadFacts; nowLocal: string }) {
  const sections: React.ReactNode[] = [];

  if (can(actor, 'load:manage') && facts.processStatus === 'LOADED') {
    sections.push(
      <ActionForm key="start" action={loadTransitionAction} className="button-row">
        <Hidden facts={facts} />
        <SubmitButton name="step" value="START">Mulai siklus</SubmitButton>
        <SubmitButton name="step" value="CANCEL" variant="ghost">Batalkan muatan</SubmitButton>
      </ActionForm>,
    );
  }

  if (can(actor, 'load:manage') && facts.processStatus === 'RUNNING') {
    sections.push(
      <ActionForm key="complete" action={loadTransitionAction} className="button-row">
        <Hidden facts={facts} />
        <SubmitButton name="step" value="COMPLETE">Catat siklus selesai</SubmitButton>
      </ActionForm>,
    );
  }

  const completed = facts.processStatus === 'CYCLE_COMPLETED';
  if (can(actor, 'evidence:record') && completed && facts.qualityStatus !== 'REJECTED') {
    sections.push(
      <div key="evidence" className="evidence-forms">
        <h3>Catat hasil pemantauan</h3>
        {detail.evidence.filter((item) => item.outcome !== 'NOT_REQUIRED').map((item) => (
          <ActionForm key={item.kind} action={evidenceAction} className="inline-form">
            <input type="hidden" name="loadCode" value={facts.code} />
            <input type="hidden" name="kind" value={item.kind} />
            <span className="inline-form__label">
              <span className="strong">{EVIDENCE_LABEL[item.kind]}</span>
              <OutcomeTag outcome={item.outcome} observedAt={item.observedAt} />
            </span>
            <label className="field field--grow">
              <span>Sumber hasil</span>
              <input name="source" required minLength={3} maxLength={80} defaultValue={item.source ?? ''} placeholder="Catatan mesin, pembacaan operator" />
            </label>
            <div className="inline-form__buttons">
              <SubmitButton name="outcome" value="PASS" variant="secondary">Memenuhi</SubmitButton>
              <SubmitButton name="outcome" value="FAIL" variant="danger">Tidak memenuhi</SubmitButton>
            </div>
            <BackdateFields max={nowLocal} />
          </ActionForm>
        ))}
      </div>,
    );
  }

  if (can(actor, 'quality:decide') && completed) {
    const blocker = facts.qualityStatus === 'PENDING' ? releaseBlocker(detail, facts, actor) : null;
    sections.push(
      <div key="decision" className="decision">
        <h3>Keputusan mutu</h3>
        {facts.qualityStatus === 'PENDING' ? (
          <>
            {blocker ? (
              <p className="hint-hold" role="note">Belum bisa dilepas: {blocker}</p>
            ) : (
              <ActionForm action={decisionAction} className="button-row">
                <Hidden facts={facts} />
                <SubmitButton name="decision" value="RELEASE">Setujui pelepasan</SubmitButton>
              </ActionForm>
            )}
            <ActionForm action={decisionAction} className="inline-form">
              <Hidden facts={facts} />
              <label className="field field--grow">
                <span>Alasan tahan atau tolak</span>
                <input name="reason" required minLength={3} maxLength={300} />
              </label>
              <div className="inline-form__buttons">
                <SubmitButton name="decision" value="HOLD" variant="secondary">Tahan</SubmitButton>
                <SubmitButton name="decision" value="REJECT" variant="danger">Tolak</SubmitButton>
              </div>
            </ActionForm>
          </>
        ) : null}
        {facts.qualityStatus === 'HOLD' ? (
          <ActionForm action={decisionAction} className="inline-form">
            <Hidden facts={facts} />
            <label className="field field--grow">
              <span>Dasar keputusan</span>
              <input name="reason" required minLength={3} maxLength={300} />
            </label>
            <div className="inline-form__buttons">
              <SubmitButton name="decision" value="RESUME" variant="secondary">Cabut penahanan</SubmitButton>
              <SubmitButton name="decision" value="REJECT" variant="danger">Tolak</SubmitButton>
            </div>
          </ActionForm>
        ) : null}
        {facts.qualityStatus === 'RELEASED' ? (
          <ActionForm action={decisionAction} className="inline-form">
            <Hidden facts={facts} />
            <label className="field field--grow">
              <span>Alasan menahan batch yang sudah dilepas</span>
              <input name="reason" required minLength={3} maxLength={300} />
            </label>
            <div className="inline-form__buttons">
              <SubmitButton name="decision" value="HOLD" variant="secondary">Tahan</SubmitButton>
            </div>
          </ActionForm>
        ) : null}
        {facts.qualityStatus === 'REJECTED' ? <p className="muted">Batch ditolak. Paket harus diterima ulang sebagai kasus baru.</p> : null}
      </div>,
    );
  }

  if (can(actor, 'recall:manage') && detail.packageCodes.length > 0 && !facts.hasOpenRecall && facts.processStatus === 'CYCLE_COMPLETED') {
    sections.push(
      <div key="recall" className="decision">
        <h3>Buka recall</h3>
        <ActionForm action={openRecallAction} className="inline-form">
          <input type="hidden" name="loadCode" value={facts.code} />
          <label className="field field--grow">
            <span>Sebab recall</span>
            <input name="reason" required minLength={3} maxLength={300} />
          </label>
          <div className="inline-form__buttons">
            <SubmitButton variant="danger">Buka recall dan blokir paket</SubmitButton>
          </div>
        </ActionForm>
      </div>,
    );
  }

  if (sections.length === 0) {
    return <p className="muted">Tidak ada tindakan untuk peran {actor.roleLabel} pada status batch ini.</p>;
  }
  return <div className="stack stack--tight">{sections}</div>;
}
