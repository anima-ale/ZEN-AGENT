// Punta ZENdate al tuo repo dedicato: riscrive gli URL ovunque.
// Uso: node scripts/set-zendate-repo.mjs <utente-github> <repo>
import { readFileSync, writeFileSync } from "node:fs";

const [user, repo] = process.argv.slice(2);
if (!user || !repo) {
  console.error("Uso: node scripts/set-zendate-repo.mjs <utente-github> <repo>");
  process.exit(1);
}
const edits = [
  ["src-tauri/src/main.rs", /const ZENDATE_USER: &str = "[^"]*";/, `const ZENDATE_USER: &str = "${user}";`],
  ["src-tauri/src/main.rs", /const ZENDATE_REPO: &str = "[^"]*";/, `const ZENDATE_REPO: &str = "${repo}";`],
  ["pubblica-update.bat", /set GH_REPO=[^\\r\\n]*/, `set GH_REPO=${user}/${repo}`],
];
for (const [file, re, rep] of edits) {
  const t = readFileSync(file, "utf8");
  if (!re.test(t)) {
    console.error("pattern non trovato in", file);
    process.exit(1);
  }
  writeFileSync(file, t.replace(re, rep));
  console.log("aggiornato:", file);
}
// Default anche nei psy di generazione manifest
for (const f of ["zendate/make-zendate.ps1"]) {
  let t = readFileSync(f, "utf8");
  t = t.replace(/\[string\]\$User = "[^"]*"/, `[string]$User = "${user}"`);
  t = t.replace(/\[string\]\$Repo = "[^"]*"/, `[string]$Repo = "${repo}"`);
  writeFileSync(f, t);
  console.log("aggiornato:", f);
}
console.log(`ZENdate ora punta a ${user}/${repo}`);
