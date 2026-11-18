import { redirect } from 'next/navigation';
import { isInstalled } from '@/server/identity';

export const dynamic = 'force-dynamic';

export default async function Home() {
  redirect((await isInstalled()) ? '/cssd' : '/setup');
}
