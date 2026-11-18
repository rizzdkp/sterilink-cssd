'use client';

import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useId, useState } from 'react';

interface Row {
  key: number;
  name: string;
  quantity: number;
}

/**
 * Daftar isi set yang bisa ditambah dan dihapus barisnya. Nilainya terkirim
 * sebagai componentName[] dan componentQty[] bersama formulir set.
 */
export function ComponentsEditor({ initial }: { initial: { name: string; quantity: number }[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    (initial.length > 0 ? initial : [{ name: '', quantity: 1 }]).map((item, index) => ({ key: index, ...item })),
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const id = useId();
  const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.quantity) ? row.quantity : 0), 0);

  function update(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="components-editor">
      <legend>
        Isi set ({rows.length} jenis, {total} buah)
      </legend>
      <table className="picker__table">
        <thead>
          <tr>
            <th scope="col">Komponen</th>
            <th scope="col" className="components-editor__qty">
              Jumlah
            </th>
            <th scope="col" className="picker__check">
              <span className="visually-hidden">Hapus</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key}>
              <td>
                <input
                  name="componentName"
                  aria-label={`Nama komponen ${index + 1}`}
                  value={row.name}
                  onChange={(event) => update(row.key, { name: event.target.value })}
                  required
                  maxLength={80}
                  placeholder="Contoh: Klem Kocher lurus 14 cm"
                />
              </td>
              <td className="components-editor__qty">
                <input
                  name="componentQty"
                  type="number"
                  inputMode="numeric"
                  aria-label={`Jumlah ${row.name || `komponen ${index + 1}`}`}
                  min={1}
                  max={99}
                  value={Number.isFinite(row.quantity) ? row.quantity : ''}
                  onChange={(event) => update(row.key, { quantity: event.target.valueAsNumber })}
                  required
                />
              </td>
              <td className="picker__check">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Hapus ${row.name || `komponen ${index + 1}`}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                >
                  <TrashIcon aria-hidden size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        id={`${id}-tambah`}
        className="button button--ghost"
        onClick={() => {
          setRows((current) => [...current, { key: nextKey, name: '', quantity: 1 }]);
          setNextKey((value) => value + 1);
        }}
      >
        <PlusIcon aria-hidden size={16} weight="bold" />
        Tambah komponen
      </button>
    </fieldset>
  );
}
