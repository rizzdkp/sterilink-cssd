/**
 * Pencatatan mundur saat sistem sempat mati (PRD P-18). Tertutup secara bawaan;
 * bila waktu diisi, alasan wajib dan server menolak lebih dari 72 jam ke belakang.
 */
export function BackdateFields({ max }: { max: string }) {
  return (
    <details className="backdate">
      <summary>Kejadian sudah lewat? Catat dengan waktu sebenarnya</summary>
      <div className="backdate__fields">
        <label className="field">
          <span>Waktu kejadian (zona fasilitas)</span>
          <input name="occurredAt" type="datetime-local" max={max} />
        </label>
        <label className="field field--grow">
          <span>Alasan pencatatan mundur</span>
          <input name="backdateReason" maxLength={300} placeholder="Contoh: jaringan putus 07.40 sampai 09.10" />
        </label>
      </div>
    </details>
  );
}
