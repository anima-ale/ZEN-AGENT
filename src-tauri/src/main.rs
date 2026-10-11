//! Zen Agent — backend Tauri v2.
//! - Goccia dal bordo superiore + pannello fluttuante (UI in frontend)
//! - Motore: opencode CLI già installato (rispetta il modello già messo dal CLI;
//!   se manca, imposta da solo il modello gratuito più potente)
//! - Sempre attivo anche a tutto chiuso: tray + autostart + opencode serve daemon
//! - Fa DA SOLA ciò che gli dice l'utente (task pianificati in background)

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};
use tauri::{Emitter, Manager};

// Modello gratuito più potente (Zen): lista in ordine di preferenza.
// Il primo è quello impostato di default se l'utente non ha già un modello dal CLI.
const FREE_MODEL_PRIORITY: &[&str] = &[
    "opencode/muse-spark-1.3-contributor-free",
    "opencode/big-pickle",
    "opencode/nemotron-3-ultra-free",
    "opencode/exo-free",
    "opencode/space-bunny-free",
    "opencode/longcat-2.5-preview-free",
    "opencode/step-5-preview-free",
];
const DEFAULT_FREE_MODEL: &str = "opencode/muse-spark-1.3-contributor-free";
const DEFAULT_FREE_SMALL_MODEL: &str = "opencode/nemotron-3.5-lightning-free";
const SERVE_PORT: u16 = 4096;

// ZENdate (come KOA Browser): manifest su GitHub raw + setup exe nelle Release.
// Canali: stable | beta | alpha -> zendate/<canale>/zendate.json
// Repo dedicato da impostare con: node scripts/set-zendate-repo.mjs <utente> <repo>
const ZENDATE_USER: &str = "anima-ale";
const ZENDATE_REPO: &str = "ZEN-AGENT";
const ZENDATE_DEFAULT_CHANNEL: &str = "stable";

#[derive(Clone)]
struct AppState {
    cwd: Arc<Mutex<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AgentStatus {
    opencode: bool,
    version: String,
    serve: bool,
    model: String,
    cwd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AgentTask {
    id: String,
    prompt: String,
    interval_secs: u64,
    next_run: u64,
}

// ---------- ZENdate: aggiornamenti via GitHub (stile KOA Browser) ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UpdateManifest {
    version: String,
    #[serde(default)]
    notes: String,
    url: String,
    sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UpdateInfo {
    available: bool,
    current: String,
    latest: String,
    notes: String,
    url: String,
    sha256: String,
    channel: String,
    #[serde(default)]
    message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UpdateProgress {
    received: u64,
    total: u64,
}

fn zendate_base() -> String {
    format!("https://raw.githubusercontent.com/{ZENDATE_USER}/{ZENDATE_REPO}/main/zendate/")
}

fn channel_file(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| home_dir().join(".zen-agent"))
        .join("update-channel.txt")
}

fn last_check_file(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| home_dir().join(".zen-agent"))
        .join("update-last-check.txt")
}

fn stored_channel(app: &tauri::AppHandle) -> String {
    std::fs::read_to_string(channel_file(app))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| ["stable", "beta", "alpha"].contains(&s.as_str()))
        .unwrap_or_else(|| ZENDATE_DEFAULT_CHANNEL.to_string())
}

fn fetch_manifest(channel: &str) -> Result<UpdateManifest, String> {
    let url = format!("{}{channel}/zendate.json", zendate_base());
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("client http: {e}"))?;
    let resp = client
        .get(&url)
        .send()
        .map_err(|e| format!("download manifest fallito ({url}): {e}"))?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err("NO_RELEASE_YET".into());
    }
    if !resp.status().is_success() {
        return Err(format!("manifest non trovato (http {})", resp.status()));
    }
    resp.json::<UpdateManifest>()
        .map_err(|e| format!("manifest non valido: {e}"))
}

fn is_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| semver::Version::parse(v.trim_start_matches(['v', 'V']).trim());
    match (parse(latest), parse(current)) {
        (Ok(l), Ok(c)) => l > c,
        _ => latest.trim() != current.trim() && latest > current,
    }
}

// ---------- helpers paths ----------

fn home_dir() -> PathBuf {
    dirs_fallback_home()
}

fn dirs_fallback_home() -> PathBuf {
    std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("C:\\"))
}

fn opencode_config_path() -> PathBuf {
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| home_dir().join(".config"));
    base.join("opencode").join("opencode.jsonc")
}

fn opencode_data_dir() -> PathBuf {
    home_dir().join(".local").join("share").join("opencode")
}

fn tasks_file(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| home_dir().join(".zen-agent"))
        .join("tasks.json")
}

// ---------- helpers opencode ----------

/// Costruisce il comando opencode in modo che funzioni anche su Windows
/// dove opencode è uno shim npm (.cmd).
fn opencode_command() -> std::process::Command {
    #[cfg(target_os = "windows")]
    {
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", "opencode"]);
        c
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("opencode")
    }
}

fn run_opencode_args(args: &[&str], cwd: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let mut full: Vec<&str> = vec!["/C", "opencode"];
        full.extend_from_slice(args);
        let out = std::process::Command::new("cmd")
            .args(&full)
            .current_dir(cwd)
            .output()
            .map_err(|e| format!("avvio opencode fallito: {e}"))?;
        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        if out.status.success() {
            Ok(stdout)
        } else {
            Err(format!("opencode errore: {stderr}{stdout}"))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let out = std::process::Command::new("opencode")
            .args(args)
            .current_dir(cwd)
            .output()
            .map_err(|e| format!("avvio opencode fallito: {e}"))?;
        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        if out.status.success() {
            Ok(stdout)
        } else {
            Err(format!("opencode errore: {stderr}{stdout}"))
        }
    }
}

fn opencode_installed() -> bool {
    opencode_command()
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn opencode_version() -> String {
    run_opencode_args(&["--version"], ".")
        .unwrap_or_default()
        .trim()
        .lines()
        .next()
        .unwrap_or("")
        .to_string()
}

fn serve_alive() -> bool {
    std::net::TcpStream::connect_timeout(
        &format!("127.0.0.1:{SERVE_PORT}").parse().unwrap(),
        std::time::Duration::from_millis(400),
    )
    .is_ok()
}

fn configured_model() -> String {
    let p = opencode_config_path();
    let Ok(text) = std::fs::read_to_string(&p) else {
        return String::new();
    };
    // jsonc minimale: chiave esatta "model" (non "small_model"), prima stringa dopo i due punti
    for line in text.lines() {
        let t = line.trim();
        if let Some(ki) = t.find("\"model\"") {
            let after_key = &t[ki + 7..];
            if let Some(ci) = after_key.find(':') {
                if let Some(s) = after_key[ci + 1..].trim().strip_prefix('"') {
                    if let Some(end) = s.find('"') {
                        return s[..end].to_string();
                    }
                }
            }
        }
    }
    String::new()
}

/// Ripara il DB corrotto di opencode ("Database is not empty and has no session table").
fn fix_corrupted_db() {
    let dir = opencode_data_dir();
    let probe = run_opencode_args(&["debug", "config"], ".").unwrap_or_default();
    // se run fallisce per il db, l'errore arriva come Err; riproviamo a leggerlo
    let err_text = match run_opencode_args(&["models"], ".") {
        Ok(_) => String::new(),
        Err(e) => e,
    };
    let _ = probe;
    if err_text.contains("no session table") {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let backup = dir.join(format!("backup-corruptdb-{ts}"));
        let _ = std::fs::create_dir_all(&backup);
        for name in ["opencode.db", "opencode.db-shm", "opencode.db-wal"] {
            let src = dir.join(name);
            if src.exists() {
                let _ = std::fs::rename(&src, backup.join(name));
            }
        }
    }
}

/// Scrive il modello gratuito più potente SOLO se l'utente non ne ha già uno dal CLI.
fn ensure_free_model() -> String {
    let existing = configured_model();
    if !existing.is_empty() {
        return existing; // rispetta il modello già messo dal CLI
    }
    let def: &str = FREE_MODEL_PRIORITY.first().copied().unwrap_or(DEFAULT_FREE_MODEL);
    let p = opencode_config_path();
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    // Se il file esiste già ma senza model, aggiungi il campo preservando il resto.
    let mut text = std::fs::read_to_string(&p).unwrap_or_else(|_| "{ \"$schema\": \"https://opencode.ai/config.json\" }".into());
    // Inserimento semplice prima della graffa finale
    let inject = format!(",\n  \"model\": \"{def}\",\n  \"small_model\": \"{DEFAULT_FREE_SMALL_MODEL}\"\n");
    if let Some(idx) = text.rfind('}') {
        text.insert_str(idx, &inject);
    } else {
        text = format!(
            "{{\n  \"$schema\": \"https://opencode.ai/config.json\",\n  \"model\": \"{def}\",\n  \"small_model\": \"{DEFAULT_FREE_SMALL_MODEL}\"\n}}"
        );
    }
    let _ = std::fs::write(&p, text);
    def.to_string()
}

fn ensure_serve_daemon() {
    static SERVE_ONCE: std::sync::Once = std::sync::Once::new();
    SERVE_ONCE.call_once(|| {
        std::thread::spawn(|| loop {
            if !SERVE_ENABLED.load(Ordering::SeqCst) {
                // Pausa riparazione: non rilanciare il serve (libera il lock sul DB)
                std::thread::sleep(std::time::Duration::from_secs(2));
                continue;
            }
            if serve_alive() {
                std::thread::sleep(std::time::Duration::from_secs(5));
                continue;
            }
            #[cfg(target_os = "windows")]
            let mut cmd = {
                let mut c = std::process::Command::new("cmd");
                c.args(["/C", "opencode", "serve", "--port", &SERVE_PORT.to_string()]);
                c
            };
            #[cfg(not(target_os = "windows"))]
            let mut cmd = {
                let mut c = std::process::Command::new("opencode");
                c.args(["serve", "--port", &SERVE_PORT.to_string()]);
                c
            };
            cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
            let _ = cmd.status();
            std::thread::sleep(std::time::Duration::from_secs(5));
        });
    });
}

static SERVE_ENABLED: AtomicBool = AtomicBool::new(true);

// ---------- tasks (fa da sola ciò che le dice l'utente) ----------

fn load_tasks(app: &tauri::AppHandle) -> Vec<AgentTask> {
    let f = tasks_file(app);
    let Ok(text) = std::fs::read_to_string(&f) else {
        return vec![];
    };
    serde_json::from_str(&text).unwrap_or_default()
}

fn save_tasks(app: &tauri::AppHandle, tasks: &[AgentTask]) {
    let f = tasks_file(app);
    if let Some(parent) = f.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(text) = serde_json::to_string_pretty(tasks) {
        let _ = std::fs::write(&f, text);
    }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn spawn_task_scheduler(app: tauri::AppHandle, state: AppState) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(30));
        let mut tasks = load_tasks(&app);
        if tasks.is_empty() {
            continue;
        }
        let now = now_secs();
        let mut changed = false;
        for t in tasks.iter_mut() {
            if now >= t.next_run {
                let cwd = state.cwd.lock().unwrap().clone();
                let prompt = t.prompt.clone();
                let res = run_opencode_args(
                    &[
                        "run",
                        "--format",
                        "default",
                        "--attach",
                        &format!("http://127.0.0.1:{SERVE_PORT}"),
                        "--dir",
                        &cwd,
                        &prompt,
                    ],
                    &cwd,
                );
                // se attach fallisce (serve giù), prova diretto
                if res.is_err() {
                    let _ = run_opencode_args(&["run", "--dir", &cwd, &prompt], &cwd);
                }
                t.next_run = now + t.interval_secs.max(60);
                changed = true;
            }
        }
        if changed {
            save_tasks(&app, &tasks);
        }
    });
}

// ---------- commands ----------

#[tauri::command]
fn show_panel(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("panel") {
        w.show().map_err(|e| e.to_string())?;
        w.unminimize().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
    }
    // nascondi la goccia mentre il pannello è aperto? no, resta il sensore.
    Ok(())
}

#[tauri::command]
fn hide_panel(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("panel") {
        w.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn agent_status(state: tauri::State<AppState>) -> AgentStatus {
    AgentStatus {
        opencode: opencode_installed(),
        version: opencode_version(),
        serve: serve_alive(),
        model: {
            let m = configured_model();
            if m.is_empty() {
                DEFAULT_FREE_MODEL.to_string()
            } else {
                m
            }
        },
        cwd: state.cwd.lock().unwrap().clone(),
    }
}

#[tauri::command]
async fn agent_run(
    state: tauri::State<'_, AppState>,
    prompt: String,
    auto_approve: Option<bool>,
    files: Option<Vec<String>>,
) -> Result<String, String> {
    let cwd = state.cwd.lock().unwrap().clone();
    let prompt_owned = prompt.clone();
    let auto = auto_approve.unwrap_or(false);
    let attached = files.unwrap_or_default();
    tokio::task::spawn_blocking(move || {
        // Prova prima via serve (veloce, mantiene sessione), poi diretto.
        let attach = format!("http://127.0.0.1:{SERVE_PORT}");
        let mut owned: Vec<String> = vec![];
        owned.push(prompt_owned);
        owned.extend(attached);
        let nprompt = 1usize;
        // argv: flag fisse + (--file <path>)* + prompt posizionale per ultimo
        let build_argv = |with_attach: bool| -> Vec<String> {
            let mut v: Vec<String> = vec!["run".into(), "--format".into(), "default".into()];
            if with_attach {
                v.push("--attach".into());
                v.push(attach.clone());
            }
            v.push("--dir".into());
            v.push(cwd.clone());
            if auto {
                v.push("--auto".into());
            }
            for f in owned.iter().skip(nprompt) {
                v.push("--file".into());
                v.push(f.clone());
            }
            v.push(owned[0].clone());
            v
        };
        let run_with = |argv: Vec<String>| -> Result<String, String> {
            let refs: Vec<&str> = argv.iter().map(|s| s.as_str()).collect();
            run_opencode_args(&refs, &cwd)
        };
        match run_with(build_argv(true)) {
            Ok(out) => Ok(truncate(&out, 12000)),
            Err(_) => run_with(build_argv(false)).map(|o| truncate(&o, 12000)),
        }
    })
    .await
    .map_err(|e| format!("task fallito: {e}"))?
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    format!("{}…\n[output troncato, {} caratteri totali]", &s[..max], s.len())
}

#[tauri::command]
fn ensure_opencode_setup(state: tauri::State<AppState>) -> Result<String, String> {
    if !opencode_installed() {
        // Prova installazione automatica via npm (Node è prerequisito del setup).
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("cmd")
                .args(["/C", "npm", "i", "-g", "opencode-ai@latest"])
                .status();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::process::Command::new("npm")
                .args(["i", "-g", "opencode-ai@latest"])
                .status();
        }
    }
    fix_corrupted_db();
    let model = ensure_free_model();
    ensure_serve_daemon();
    let _ = &state.cwd;
    if opencode_installed() {
        Ok(format!("ok • modello: {model}"))
    } else {
        Err("opencode non trovato: installa Node LTS poi rilancia (il setup .exe lo fa da solo)".into())
    }
}

#[tauri::command]
fn add_task(app: tauri::AppHandle, prompt: String, interval_secs: u64) -> Result<AgentTask, String> {
    let mut tasks = load_tasks(&app);
    let t = AgentTask {
        id: format!("task-{}", now_secs()),
        prompt,
        interval_secs: interval_secs.max(60),
        next_run: now_secs() + interval_secs.max(60),
    };
    tasks.push(t.clone());
    save_tasks(&app, &tasks);
    Ok(t)
}

#[tauri::command]
fn list_tasks(app: tauri::AppHandle) -> Vec<AgentTask> {
    load_tasks(&app)
}

#[tauri::command]
fn remove_task(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut tasks = load_tasks(&app);
    tasks.retain(|t| t.id != id);
    save_tasks(&app, &tasks);
    Ok(())
}

// ---------- ZENdate commands ----------

#[tauri::command]
fn get_update_channel(app: tauri::AppHandle) -> String {
    stored_channel(&app)
}

#[tauri::command]
fn set_update_channel(app: tauri::AppHandle, channel: String) -> Result<(), String> {
    if !["stable", "beta", "alpha"].contains(&channel.as_str()) {
        return Err("canale non valido (stable|beta|alpha)".into());
    }
    let f = channel_file(&app);
    if let Some(parent) = f.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&f, &channel).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(last_check_file(&app)); // ricontrolla subito
    Ok(())
}

#[tauri::command]
async fn check_update(app: tauri::AppHandle, channel: Option<String>) -> Result<UpdateInfo, String> {
    let ch = channel.unwrap_or_else(|| stored_channel(&app));
    let current = env!("CARGO_PKG_VERSION").to_string();
    let man = match tokio::task::spawn_blocking(move || fetch_manifest(&ch))
        .await
        .map_err(|e| format!("check fallito: {e}"))?
    {
        Ok(m) => m,
        Err(e) if e == "NO_RELEASE_YET" => {
            let ch2 = stored_channel(&app);
            return Ok(UpdateInfo {
                available: false,
                latest: current.clone(),
                current,
                notes: String::new(),
                url: String::new(),
                sha256: String::new(),
                channel: ch2,
                message: "no-release".into(),
            });
        }
        Err(e) => return Err(e),
    };
    Ok(UpdateInfo {
        available: is_newer(&man.version, &current),
        current,
        latest: man.version,
        notes: man.notes,
        url: man.url,
        sha256: man.sha256,
        channel: stored_channel(&app),
        message: String::new(),
    })
}

fn sha256_file(path: &std::path::Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    let mut f = std::fs::File::open(path).map_err(|e| format!("apertura file: {e}"))?;
    let mut h = Sha256::new();
    std::io::copy(&mut f, &mut h).map_err(|e| format!("lettura file: {e}"))?;
    Ok(hex::encode(h.finalize()))
}

#[tauri::command]
async fn install_update(
    app: tauri::AppHandle,
    url: String,
    sha256: String,
    version: String,
) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const DETACHED: u32 = 0x00000008;

    if url.trim().is_empty() {
        return Err("URL aggiornamento vuoto (repo ZENdate non ancora configurato)".into());
    }
    let tmpdir = std::env::temp_dir().join("ZEN-AGENT-update");
    let _ = std::fs::create_dir_all(&tmpdir);
    let setup_path = tmpdir.join(format!("ZEN-AGENT-{version}-setup.exe"));

    // Download con progresso (eventi zen-update-progress)
    let app_dl = app.clone();
    let setup_dl = setup_path.clone();
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(600))
            .build()
            .map_err(|e| format!("client http: {e}"))?;
        let mut resp = client
            .get(&url)
            .send()
            .map_err(|e| format!("download fallito: {e}"))?;
        if !resp.status().is_success() {
            return Err(format!("download http {}", resp.status()));
        }
        let total = resp.content_length().unwrap_or(0);
        let mut out =
            std::fs::File::create(&setup_dl).map_err(|e| format!("file temp: {e}"))?;
        let mut received: u64 = 0;
        let mut buf = [0u8; 65536];
        use std::io::Read;
        loop {
            let n = resp.read(&mut buf).map_err(|e| format!("lettura rete: {e}"))?;
            if n == 0 {
                break;
            }
            use std::io::Write;
            out.write_all(&buf[..n]).map_err(|e| format!("scrittura: {e}"))?;
            received += n as u64;
            let _ = app_dl.emit(
                "zen-update-progress",
                UpdateProgress { received, total },
            );
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("download fallito: {e}"))??;

    // Verifica SHA256 come fa ZENdate
    if !sha256.trim().is_empty() {
        let got = sha256_file(&setup_path)?;
        if got.to_lowercase() != sha256.trim().to_lowercase() {
            let _ = std::fs::remove_file(&setup_path);
            return Err(format!("sha256 non corrisponde (atteso {sha256}, ottenuto {got})"));
        }
    }

    // Bat di swap stile KOA: attende uscita, installa silenzioso, rilancia
    let me = std::process::id();
    let installed = std::env::current_exe().map_err(|e| e.to_string())?;
    let bat = tmpdir.join(format!("zen-update-{me}.bat"));
    let script = format!(
        "@echo off\r\nsetlocal\r\nset \"SETUP={setup}\"\r\nset \"EXE={exe}\"\r\n:wait_exit\r\ntasklist /FI \"PID eq {me}\" 2>nul | find \"{me}\" >nul\r\nif not errorlevel 1 ( timeout /t 1 /nobreak >nul & goto wait_exit )\r\n\"%SETUP%\" /S\r\nstart \"\" \"%EXE%\" --minimized\r\ndel \"%SETUP%\" >nul 2>&1\r\ndel \"%~f0\" >nul 2>&1\r\n",
        setup = setup_path.to_string_lossy(),
        exe = installed.to_string_lossy(),
    );
    std::fs::write(&bat, script).map_err(|e| e.to_string())?;
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &bat.to_string_lossy()])
        .creation_flags(DETACHED)
        .spawn()
        .map_err(|e| format!("avvio installer: {e}"))?;
    app.exit(0);
    #[allow(unreachable_code)]
    Ok(format!("installazione v{version} avviata"))
}

fn spawn_update_autocheck(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        // lascia avviare serve + UI, poi un check al giorno
        std::thread::sleep(std::time::Duration::from_secs(90));
        loop {
            let due = std::fs::read_to_string(last_check_file(&app))
                .ok()
                .and_then(|s| s.trim().parse::<u64>().ok())
                .map(|t| now_secs().saturating_sub(t) > 86400)
                .unwrap_or(true);
            if due {
                let ch = stored_channel(&app);
                if let Ok(man) = fetch_manifest(&ch) {
                    let current = env!("CARGO_PKG_VERSION").to_string();
                    let _ = std::fs::write(last_check_file(&app), now_secs().to_string());
                    if is_newer(&man.version, &current) {
                        if let Some(w) = app.get_webview_window("panel") {
                            let _ = w.emit(
                                "zen-update-available",
                                UpdateInfo {
                                    available: true,
                                    current,
                                    latest: man.version,
                                    notes: man.notes,
                                    url: man.url,
                                    sha256: man.sha256,
                                    channel: ch,
                                    message: String::new(),
                                },
                            );
                        }
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_secs(3600));
        }
    });
}

fn try_move_db() -> Result<usize, String> {
    let dir = opencode_data_dir();
    let backup = dir.join(format!("backup-corruptdb-{}", now_secs()));
    std::fs::create_dir_all(&backup).map_err(|e| format!("backup: {e}"))?;
    let mut moved = 0;
    for name in ["opencode.db", "opencode.db-shm", "opencode.db-wal"] {
        let src = dir.join(name);
        if src.exists() {
            std::fs::rename(&src, backup.join(name))
                .map_err(|e| format!("{name} bloccato: {e}"))?;
            moved += 1;
        }
    }
    Ok(moved)
}

#[tauri::command]
fn repair_opencode_db(app: tauri::AppHandle) -> Result<String, String> {
    // Ripara il DB corrotto ("no session table"): ferma il serve (nostro compreso,
    // che altrimenti riblocca il DB ogni 5s), chiude opencode, sposta il DB in backup.
    SERVE_ENABLED.store(false, Ordering::SeqCst);
    std::thread::sleep(std::time::Duration::from_secs(1));
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "taskkill", "/F", "/IM", "opencode.exe"])
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-f", "opencode serve"])
            .output();
    }
    let mut last_err = String::from("file sempre bloccati");
    for _ in 0..4 {
        std::thread::sleep(std::time::Duration::from_secs(2));
        match try_move_db() {
            Ok(moved) => {
                SERVE_ENABLED.store(true, Ordering::SeqCst);
                ensure_serve_daemon();
                let _ = &app;
                return Ok(format!("DB spostato in backup ({moved} file)."));
            }
            Err(e) => last_err = e,
        }
    }
    SERVE_ENABLED.store(true, Ordering::SeqCst);
    Err(format!(
        "riparazione non riuscita ({last_err}). Esci da ZEN-AGENT (tray), chiudi OpenCode e rilancia."
    ))
}

// ---------- window helpers ----------

fn show_panel_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("panel") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn size_drop_to_monitor(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("drop") {
        if let Ok(Some(m)) = w.current_monitor() {
            let size = m.size();
            // altezza fissa 140, larghezza = larghezza monitor
            let _ = w.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: size.width,
                height: (140.0 * m.scale_factor()) as u32,
            }));
            let _ = w.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: 0, y: 0 }));
        }
    }
}

// ---------- main ----------

fn main() {
    let cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| home_dir().to_string_lossy().to_string());
    let state = AppState {
        cwd: Arc::new(Mutex::new(cwd)),
    };
    let state_clone = state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_panel_window(app);
        }))
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            show_panel,
            hide_panel,
            agent_status,
            agent_run,
            ensure_opencode_setup,
            add_task,
            list_tasks,
            remove_task,
            get_update_channel,
            set_update_channel,
            check_update,
            install_update,
            repair_opencode_db
        ])
        .setup(move |app| {
            // Tray: resta attivo anche a tutto chiuso
            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
                let show = MenuItem::with_id(app, "show", "Mostra ZEN-AGENT", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "Esci", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show, &quit])?;
                let mut builder = TrayIconBuilder::with_id("main").menu(&menu);
                builder = builder.show_menu_on_left_click(false);
                if let Some(icon) = app.default_window_icon().cloned() {
                    builder = builder.icon(icon);
                }
                builder = builder.tooltip("ZEN-AGENT — sempre attivo");
                let _tray = builder
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => show_panel_window(app),
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            show_panel_window(app);
                        }
                    })
                    .build(app)?;
            }

            // Autostart: funziona sempre, anche dopo riavvio
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::ManagerExt;
                let _ = app.autolaunch().enable();
            }

            size_drop_to_monitor(app.handle());
            ensure_serve_daemon();
            // ripara db + imposta free model in background senza bloccare l'avvio
            std::thread::spawn(|| {
                fix_corrupted_db();
                ensure_free_model();
            });
            spawn_task_scheduler(app.handle().clone(), state_clone);
            spawn_update_autocheck(app.handle().clone());
            // Se lanciato con --minimized (autostart), resta solo tray+drop
            let minimized = std::env::args().any(|a| a == "--minimized");
            if !minimized {
                // il pannello resta nascosto finché non trascini giù la goccia
                if let Some(w) = app.get_webview_window("panel") {
                    let _ = w.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Chiudere il pannello con la X = nascondi, resta attivo in background
            if window.label() == "panel" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("errore avvio Zen Agent");
}
