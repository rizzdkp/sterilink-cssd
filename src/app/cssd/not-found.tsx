import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

export default function CssdNotFound() {
  return (
    <div className="state-page" role="status">
      <MagnifyingGlassIcon aria-hidden size={32} />
      <h1>Data tidak ditemukan</h1>
      <p>Kode atau halaman ini tidak ada di fasilitas Anda. Periksa label fisiknya, lalu telusuri lagi.</p>
      <Link className="button button--primary" href="/cssd/trace">
        Buka Pelacakan
      </Link>
    </div>
  );
}
