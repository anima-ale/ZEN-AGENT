import fs from 'node:fs';
const files = ['pubblica-update.bat', 'scripts/build-exe.bat', 'scripts/full-setup.bat',
  'scripts/install-rust.bat', 'scripts/install-msvc.bat', 'scripts/install-msvc2.bat',
  'scripts/bootstrap-opencode.ps1', 'scripts/install-prereqs.ps1',
  'scripts/dl-rust.ps1', 'scripts/dl-vsbt.ps1', 'scripts/parsecheck.ps1',
  'zendate/make-zendate.ps1'];
let bad = 0;
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const hits = [...new Set([...t.matchAll(/[^\x00-\x7F]/g)].map((m) => m[0]))];
  if (hits.length) { console.log('NON-ASCII in', f, JSON.stringify(hits)); bad++; }
}
console.log(bad ? 'ASCII-CHECK FALLITO' : 'ASCII-CHECK OK');
process.exit(bad ? 1 : 0);
