// Verifica veloce del progetto senza Rust: config, file, TS.
import { existsSync, readFileSync } from "node:fs";

const need = [
  "package.json",
  "vite.config.ts",
  "tsconfig.json",
  "index.html",
  "src/main.tsx",
  "src/api.ts",
  "src/drop/DropApp.tsx",
  "src/panel/PanelApp.tsx",
  "src/game/SnakeApp.tsx",
  "src/tasks/TasksApp.tsx",
  "src/settings/SettingsApp.tsx",
  "src/styles.css",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/build.rs",
  "src-tauri/capabilities/default.json",
  "src-tauri/src/main.rs",
  "scripts/install-prereqs.ps1",
  "scripts/bootstrap-opencode.ps1",
  "zendate/make-zendate.ps1",
  "pubblica-update.bat",
];
let ok = true;
for (const f of need) {
  if (!existsSync(f)) { console.error("MANCA:", f); ok = false; }
}
const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
console.log("windows:", conf.app.windows.map((w) => w.label).join(", "));
console.log("frontendDist:", conf.build.frontendDist);
const main = readFileSync("src-tauri/src/main.rs", "utf8");
for (const cmd of ["show_panel", "hide_panel", "minimize_to_drop", "show_game", "hide_game", "show_tasks", "hide_tasks", "show_settings", "hide_settings", "get_autostart", "set_autostart", "get_sound", "set_sound", "get_drop_position", "set_drop_position", "notify_response_ready", "clear_response_ready", "add_task", "list_tasks", "remove_task", "agent_run", "agent_status", "ensure_opencode_setup", "check_update", "install_update", "get_update_channel"]) {
  if (!main.includes(cmd)) { console.error("comando Rust mancante:", cmd); ok = false; }
}
console.log(ok ? "VERIFY OK" : "VERIFY FALLITO");
process.exit(ok ? 0 : 1);
