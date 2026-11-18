// Memeriksa pesan commit mengikuti Conventional Commits, dipakai oleh hook commit-msg lokal dan CI.
//   node scripts/check-commit-msg.mjs <berkas-pesan>      (hook)
//   node scripts/check-commit-msg.mjs --range <a>..<b>    (CI, semua commit di rentang)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
const PATTERN = new RegExp(String.raw`^(${TYPES.join('|')})(\([a-z0-9-]+\))?!?: \S.{0,99}$`);

function problem(subject) {
  if (/^(Merge|Revert) /.test(subject)) return null;
  if (!PATTERN.test(subject)) {
    return `"${subject}"\n  Format: <tipe>(<area opsional>): <ringkasan>, maksimal 100 karakter.\n  Tipe: ${TYPES.join(', ')}.\n  Contoh: feat(stok): tarik paket kedaluwarsa dari rak`;
  }
  return null;
}

const args = process.argv.slice(2);
let subjects;
if (args[0] === '--range') {
  const out = execFileSync('git', ['log', '--format=%s', args[1]], { encoding: 'utf8' });
  subjects = out.split('\n').filter(Boolean);
} else {
  subjects = [readFileSync(args[0], 'utf8').split('\n')[0].trim()];
}

const failures = subjects.map(problem).filter(Boolean);
if (failures.length > 0) {
  console.error(
    `Pesan commit tidak sesuai Conventional Commits:\n\n${failures.join('\n\n')}\n\nLihat CONTRIBUTING.md bagian Pesan commit.`,
  );
  process.exit(1);
}
