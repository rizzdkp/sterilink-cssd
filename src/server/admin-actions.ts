'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from './actions';
import { manualBackup } from './backup';
import { getActor } from './identity';
import { DomainError } from './workflow';

export async function backupNowAction(): Promise<ActionResult> {
  const at = Date.now();
  const actor = await getActor();
  if (!actor) return { status: 'error', message: 'Sesi Anda berakhir. Masuk lagi.', at };
  try {
    const file = await manualBackup(actor);
    revalidatePath('/cssd/admin/backup');
    return { status: 'ok', message: `Backup ${file.name} dibuat.`, at };
  } catch (error) {
    if (error instanceof DomainError) return { status: 'error', message: error.message, at };
    console.error(JSON.stringify({ level: 'error', action: 'backup', message: (error as Error).message }));
    return { status: 'error', message: 'Backup gagal. Periksa ruang disk dan izin folder backup.', at };
  }
}
