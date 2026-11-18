import { LockKeyIcon } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

export function NoAccess() {
  return (
    <div className="state-page" role="status">
      <LockKeyIcon aria-hidden size={32} />
      <h1>Halaman ini bukan untuk peran Anda</h1>
      <p>
        Akses di SIMRS CSSD mengikuti peran yang diberikan admin. Bila Anda memerlukan halaman ini untuk tugas Anda, minta admin CSSD
        memeriksa peran akun Anda.
      </p>
      <Link className="button button--primary" href="/cssd">
        Kembali ke ruang kerja
      </Link>
    </div>
  );
}
