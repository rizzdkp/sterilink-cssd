'use client';

import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

/**
 * Form GET yang langsung menerapkan filter saat pilihan dropdown berubah.
 * Tanpa JavaScript form tetap bekerja lewat tombol kirimnya.
 */
export function AutoSubmitForm({ children, action, ...rest }: ComponentProps<'form'> & { action: string }) {
  const router = useRouter();

  function navigate(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === 'string' && value.trim() !== '') params.set(key, value.trim());
    }
    const search = params.toString();
    router.push(search ? `${action}?${search}` : action);
  }

  return (
    <form
      {...rest}
      action={action}
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(event.currentTarget);
      }}
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) navigate(event.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
