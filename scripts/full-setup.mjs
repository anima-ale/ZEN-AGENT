// Zen Agent — full setup: prerequisiti -> npm install -> icone -> build setup .exe
// Uso: npm run setup:full   (oppure: node scripts/full-setup.mjs)
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const run = (cmd, opts = {}) => {
  console.log("\n> " + cmd);
  execSync(cmd, { stdio: "inherit", shell: "cmd.exe", ...opts });
};

try {
  console.log("=== Zen Agent — full setup (.exe che scarica TUTTO) ===");
  run(`powershell -ExecutionPolicy Bypass -File scripts/install-prereqs.ps1`);
  run(`powershell -ExecutionPolicy Bypass -File scripts/bootstrap-opencode.ps1`);
  run(`cmd /c npm install`);
  // Genera le icone Tauri dalla SVG (se mancano i png/ico)
  if (!existsSync("src-tauri/icons/icon.ico")) {
    try {
      run(`cmd /c npx tauri icon src-tauri/icons/icon.svg`);
    } catch {
      console.warn("tauri icon fallito (serve Rust installato). Continua comunque.");
    }
  }
  run(`cmd /c npx tauri build`);
  console.log("\n=== BUILD OK ===");
  console.log("Setup .exe in: src-tauri/target/release/bundle/nsis/");
} catch (e) {
  console.error("\nSetup fallito:", e.message);
  console.error("Se manca Rust/MSVC: rilancia scripts/install-prereqs.ps1 e riprova.");
  process.exit(1);
}
