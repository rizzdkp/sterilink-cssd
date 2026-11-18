// Mengaktifkan hook git di .githooks saat pnpm install. Dilewati bila bukan repo git (misalnya di server produksi).
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
} catch {
  // Bukan repo git atau git tidak tersedia.
}
