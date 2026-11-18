// Kerangka memakai ukuran yang sama dengan halaman jadi, sehingga lebar kolom
// dan posisi panel tidak bergeser saat data tiba.
export default function QueueLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="visually-hidden">Memuat antrean batch...</span>
      <div className="skeleton skeleton--header" />
      <div className="skeleton skeleton--banner" />
      <div className="workspace" data-explicit="false">
        <div className="queue">
          <div className="skeleton skeleton--tabs" />
          <div className="skeleton skeleton--toolbar" />
          <div className="skeleton skeleton--table" />
        </div>
        <div className="skeleton skeleton--panel" />
      </div>
    </div>
  );
}
