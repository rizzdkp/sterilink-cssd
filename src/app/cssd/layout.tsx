import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { CssdWorkspaceShell } from '@/components/cssd/workspace-shell';
import { getActor, isInstalled } from '@/server/identity';
import './cssd.css';
import './workflow.css';
import './admin.css';

export const dynamic = 'force-dynamic';

export default async function CssdLayout({ children }: { children: React.ReactNode }) {
  if (!(await isInstalled())) redirect('/setup');
  const actor = await getActor();
  if (!actor) {
    // Kembali ke halaman yang diminta setelah masuk.
    const path = (await headers()).get('x-cssd-path') ?? '/cssd';
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (actor.mustChangePassword) redirect('/account?wajib=1');
  return <CssdWorkspaceShell actor={actor}>{children}</CssdWorkspaceShell>;
}
