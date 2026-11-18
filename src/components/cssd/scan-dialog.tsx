'use client';

import { BarcodeIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';

type ScanState = { kind: 'idle' } | { kind: 'searching' } | { kind: 'error'; message: string };

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,31}$/;

/**
 * Pindai atau ketik kode batch/paket. Scanner barcode bekerja sebagai keyboard
 * yang mengakhiri kode dengan Enter, jadi cukup satu kolom yang langsung fokus.
 */
export function ScanDialog() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const inputId = useId();
  const errorId = useId();

  function open() {
    setState({ kind: 'idle' });
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  }

  function fail(message: string) {
    setState({ kind: 'error', message });
    // Kode salah tetap terpilih supaya pindaian berikutnya langsung menggantinya.
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === 'searching') return;
    const code = (inputRef.current?.value ?? '').trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      fail('Kode belum lengkap. Gunakan huruf, angka dan tanda hubung, misalnya BT-0021.');
      return;
    }

    setState({ kind: 'searching' });
    try {
      const response = await fetch(`/api/v1/cssd/scan/${encodeURIComponent(code)}`, { cache: 'no-store' });
      const body = await response.json();
      if (response.ok) {
        dialogRef.current?.close();
        if (inputRef.current) inputRef.current.value = '';
        router.push(body.nextActions[0].href);
        return;
      }
      if (response.status === 404) {
        fail(`Kode ${code} tidak ditemukan di fasilitas ini. Periksa label lalu pindai ulang.`);
      } else if (response.status === 401) {
        fail('Sesi Anda berakhir. Muat ulang halaman lalu masuk lagi.');
      } else {
        fail(body?.error?.message ?? 'Kode tidak bisa diperiksa. Coba lagi.');
      }
    } catch {
      fail('Tidak bisa menghubungi server. Periksa jaringan lalu coba lagi.');
    }
  }

  const searching = state.kind === 'searching';

  return (
    <>
      <button type="button" className="button button--primary button--large" onClick={open}>
        <BarcodeIcon aria-hidden size={20} weight="bold" />
        Pindai kode
      </button>

      <dialog ref={dialogRef} className="dialog" aria-labelledby={`${inputId}-judul`}>
        <form onSubmit={submit} noValidate>
          <h2 id={`${inputId}-judul`}>Pindai kode</h2>
          <p className="muted">Arahkan scanner ke label batch atau paket, atau ketik kodenya.</p>

          <label htmlFor={inputId}>Kode batch atau paket</label>
          <input
            ref={inputRef}
            id={inputId}
            name="code"
            type="text"
            className="dialog__input"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
            aria-invalid={state.kind === 'error'}
            aria-describedby={state.kind === 'error' ? errorId : undefined}
          />

          <div aria-live="assertive" className="dialog__feedback">
            {state.kind === 'error' ? (
              <p id={errorId} className="dialog__error">
                <WarningCircleIcon aria-hidden size={16} weight="bold" />
                {state.message}
              </p>
            ) : null}
            {searching ? <p className="muted">Mencari kode di antrean...</p> : null}
          </div>

          <div className="dialog__actions">
            <button type="button" className="button button--ghost" onClick={() => dialogRef.current?.close()}>
              Batal
            </button>
            <button type="submit" className="button button--primary" aria-disabled={searching}>
              Cari kode
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
