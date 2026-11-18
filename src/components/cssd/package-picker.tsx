/**
 * Pilih paket untuk dimuat atau dikirim. Tabel dengan kepala silver yang sama
 * dengan antrean, supaya kode, set, tray dan lokasi terbaca utuh tanpa terpotong.
 */
export interface PickerRow {
  code: string;
  setName: string;
  details: string[];
}

export function PackagePicker({ legend, columns, rows }: { legend: string; columns: string[]; rows: PickerRow[] }) {
  return (
    <fieldset className="picker">
      <legend>{legend}</legend>
      <div className="picker__scroll" tabIndex={0} role="region" aria-label={legend}>
        <table className="picker__table">
          <thead>
            <tr>
              <th scope="col" className="picker__check">
                <span className="visually-hidden">Pilih</span>
              </th>
              <th scope="col">Paket</th>
              <th scope="col">Set</th>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = `pilih-${row.code}`;
              return (
                <tr key={row.code}>
                  <td className="picker__check">
                    <input id={id} type="checkbox" name="packageCodes" value={row.code} />
                  </td>
                  <th scope="row">
                    <label htmlFor={id} className="strong num">
                      {row.code}
                    </label>
                  </th>
                  <td>
                    <label htmlFor={id}>{row.setName}</label>
                  </td>
                  {row.details.map((detail, index) => (
                    <td key={columns[index]} className="num">
                      {detail}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}
