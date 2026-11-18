'use client';

import { PrinterIcon } from '@phosphor-icons/react';
import { useState, useTransition } from 'react';
import { recordLabelPrintAction } from '@/server/actions';
import { announce } from './announcer';

/** Catat cetak di server dulu, baru buka dialog cetak peramban. */
export function PrintLabelButton({ packageCode, printed }: { packageCode: string; printed: number }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function print() {
    startTransition(async () => {
      const result = await recordLabelPrintAction(packageCode);
      setMessage({ ok: result.status === 'ok', text: result.message });
      if (result.status === 'ok') {
        announce(result.message);
        window.print();
      }
    });
  }

  return (
    <div className="print-button">
      <button type="button" className="button button--primary" onClick={print} disabled={pending} aria-disabled={pending}>
        <PrinterIcon aria-hidden size={18} weight="bold" />
        {pending ? 'Mencatat...' : printed === 0 ? 'Cetak label' : 'Cetak ulang label'}
      </button>
      {message && !message.ok ? (
        <p role="alert" className="feedback feedback--error">
          {message.text}
        </p>
      ) : (
        <p className="muted">{printed > 0 ? `Sudah dicetak ${printed} kali.` : 'Belum pernah dicetak.'}</p>
      )}
    </div>
  );
}
