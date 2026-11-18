'use client';

import { WarningCircleIcon } from '@phosphor-icons/react';
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ActionResult } from '@/server/actions';
import { announce } from './announcer';

const IDLE: ActionResult = { status: 'idle', message: '', at: 0 };

type FormAction = (previous: ActionResult, form: FormData) => Promise<ActionResult>;

interface PendingState {
  pending: boolean;
  // name=value tombol yang ditekan, supaya hanya tombol itu yang menampilkan label proses.
  submitter: string | null;
}

const PendingContext = createContext<PendingState>({ pending: false, submitter: null });

/**
 * Formulir aksi dengan umpan balik. Hasil diumumkan ke pembaca layar, tombol
 * terkunci selama penyimpanan (mencegah kirim ganda), dan isian dikosongkan
 * hanya bila penyimpanan berhasil. Saat ditolak, isian tetap ada untuk dikoreksi.
 *
 * Pengiriman memakai onSubmit + transisi, bukan `action` langsung, karena React
 * mengosongkan formulir setelah setiap `action` selesai, termasuk yang ditolak.
 * Tanpa JavaScript, formulir tetap terkirim lewat atribut `action`.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  // Pengumuman sukses dikirim di sini, begitu server menjawab: formulir ini sering
  // sudah hilang pada render berikutnya karena status data berubah.
  const [state, formAction, pending] = useActionState(async (previous: ActionResult, form: FormData) => {
    const result = await action(previous, form);
    if (result.status === 'ok') announce(result.message);
    return result;
  }, IDLE);
  const [submitter, setSubmitter] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === 'ok' && resetOnSuccess) formRef.current?.reset();
    // Penolakan: fokus ke pesannya supaya pengguna keyboard langsung membacanya.
    if (state.status === 'error') feedbackRef.current?.focus();
  }, [state, resetOnSuccess]);

  function submit(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (pending) return;
    const button = event.nativeEvent.submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget, button);
    setSubmitter(button?.name ? `${button.name}=${button.value}` : null);
    startTransition(() => formAction(data));
  }

  return (
    <PendingContext value={{ pending, submitter }}>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={submit}
        aria-busy={pending}
        className={className ? `action-form ${className}` : 'action-form'}
      >
        {children}
        <div aria-live="polite" className="action-form__feedback">
          {state.status === 'error' ? (
            // Penolakan tampil di dekat isian yang perlu dikoreksi.
            <p key={state.at} ref={feedbackRef} tabIndex={-1} role="alert" className="feedback feedback--error">
              <WarningCircleIcon aria-hidden size={16} weight="bold" />
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </PendingContext>
  );
}

export function SubmitButton({
  children,
  variant = 'primary',
  name,
  value,
  pendingLabel = 'Menyimpan...',
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  name?: string;
  value?: string;
  pendingLabel?: string;
}) {
  const { pending, submitter } = useContext(PendingContext);
  const isThis = pending && (!name || submitter === `${name}=${value}`);
  return (
    <button type="submit" name={name} value={value} className={`button button--${variant}`} disabled={pending} aria-disabled={pending}>
      {isThis ? pendingLabel : children}
    </button>
  );
}
