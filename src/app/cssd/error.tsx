'use client';

import { ArrowClockwiseIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { startTransition, useEffect } from 'react';

export default function QueueError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  function retry() {
    // Muat ulang data server, lalu lepas batas galat.
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="state-page" role="alert">
      <WarningCircleIcon aria-hidden size={32} />
      <h1>Antrean tidak bisa dimuat</h1>
      <p>
        Server tidak menjawab atau data belum siap. Pekerjaan yang sudah tersimpan tidak berubah. Coba muat ulang; bila masih gagal,
        lanjutkan dengan prosedur downtime CSSD dan laporkan kode di bawah ke tim TI.
      </p>
      {error.digest ? <p className="muted num">Kode galat: {error.digest}</p> : null}
      <button type="button" className="button button--primary" onClick={retry}>
        <ArrowClockwiseIcon aria-hidden size={16} weight="bold" />
        Muat ulang antrean
      </button>
    </div>
  );
}
