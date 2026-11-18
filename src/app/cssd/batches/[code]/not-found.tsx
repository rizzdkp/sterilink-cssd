import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

export default function BatchNotFound() {
  return (
    <div className="state-page" role="status">
      <MagnifyingGlassIcon aria-hidden size={32} />
      <h1>Batch tidak ditemukan</h1>
      <p>Kode ini tidak ada di fasilitas Anda. Periksa label fisiknya, lalu cari lagi dari antrean.</p>
      <Link className="button button--primary" href="/cssd">
        Buka Antrean Kerja
      </Link>
    </div>
  );
}
