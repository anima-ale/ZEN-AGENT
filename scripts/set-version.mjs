// Bump versione ovunque: package.json + tauri.conf.json
// Uso: node scripts/set-version.mjs 0.2.0
import { readFileSync, writeFileSync } from "node:fs";

const v = process.argv[2];
if (!v || !/^\d+\.\d+\.\d+$/.test(v)) {
  console.error("Uso: node scripts/set-version.mjs X.Y.Z");
  process.exit(1);
}
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = v;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
conf.version = v;
writeFileSync("src-tauri/tauri.conf.json", JSON.stringify(conf, null, 2) + "\n");
const cargo = readFileSync("src-tauri/Cargo.toml", "utf8").replace(
  /^version = ".*"/m,
  `version = "${v}"`,
);
writeFileSync("src-tauri/Cargo.toml", cargo);
console.log("Versione impostata:", v);
