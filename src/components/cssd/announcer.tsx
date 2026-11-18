'use client';

import { CheckCircleIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

const EVENT = 'cssd:announce';

/** Umumkan hasil yang berhasil. Bertahan walau formulir pemicunya hilang setelah status berubah. */
export function announce(message: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

/**
 * Satu wilayah status untuk seluruh layar CSSD. Konfirmasi tetap terlihat 8 detik
 * (cukup untuk dibaca sambil bersarung tangan) dan bisa ditutup.
 */
export function Announcer() {
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    const onAnnounce = (event: Event) => setMessage({ text: (event as CustomEvent<string>).detail, id: Date.now() });
    window.addEventListener(EVENT, onAnnounce);
    return () => window.removeEventListener(EVENT, onAnnounce);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 8000);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <div className="announcer" role="status" aria-live="polite">
      {message ? (
        <p key={message.id} className="announcer__message">
          <CheckCircleIcon aria-hidden size={18} weight="bold" />
          <span>{message.text}</span>
          <button type="button" className="announcer__close" onClick={() => setMessage(null)} aria-label="Tutup pesan">
            <XIcon aria-hidden size={14} weight="bold" />
          </button>
        </p>
      ) : null}
    </div>
  );
}
