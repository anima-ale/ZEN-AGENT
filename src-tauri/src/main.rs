//! Zen Agent — backend Tauri v2.
//! - Goccia dal bordo superiore + pannello fluttuante (UI in frontend)
//! - Motore: opencode CLI già installato (rispetta il modello già messo dal CLI;
//!   se manca, imposta da solo il modello gratuito più potente)
//! - Sempre attivo anche a tutto chiuso: tray + autostart + opencode serve daemon
//! - Fa DA SOLA ciò che gli dice l'utente (task pianificati in background)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
/// Pensiero sempre al minimo: reasoning effort ridotto (quasi istantaneo).
const FAST_VARIANT: &str = "minimal";
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
    /// Orario giornaliero "HH:MM" (attività a ora specifica), oppure None = intervallo.
    #[serde(default)]
    time_daily: Option<String>,
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

fn sound_file(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| home_dir().join(".zen-agent"))
        .join("notify-sound.txt")
}

fn stored_sound(app: &tauri::AppHandle) -> String {
    std::fs::read_to_string(sound_file(app))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| ["ding", "pop", "chime", "off"].contains(&s.as_str()))
        .unwrap_or_else(|| "ding".to_string())
}

static RESPONSE_PENDING: AtomicBool = AtomicBool::new(false);
static NOTIFY_PINNED: AtomicBool = AtomicBool::new(false);

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

/// Niente terminale in faccia: i processi figli girano nascosti in background.
#[cfg(target_os = "windows")]
fn silence(cmd: &mut std::process::Command) {
    use std::os::windows::process::CommandExt;
    const NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(NO_WINDOW);
}

/// File integrato nel setup (cartella vendor accanto all'exe).
fn bundled_vendor(name: &str) -> Option<PathBuf> {
    if let Ok(me) = std::env::current_exe() {
        if let Some(dir) = me.parent() {
            let p = dir.join("vendor").join(name);
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn vcredist_present() -> bool {
    let windir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into());
    PathBuf::from(windir)
        .join("System32")
        .join("vcruntime140.dll")
        .is_file()
}

/// Primo avvio su PC freschi: installa da solo il runtime C++ integrato
/// (può chiedere una conferma di Windows una volta sola).
#[cfg(target_os = "windows")]
fn ensure_windows_deps() {
    if vcredist_present() {
        return;
    }
    if let Some(redist) = bundled_vendor("vc_redist.x64.exe") {
        let mut c = std::process::Command::new(redist);
        c.args(["/install", "/quiet", "/norestart"]);
        c.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
        silence(&mut c);
        let _ = c.status();
    }
}

/// EXE reale di opencode, senza passare da cmd.exe.
/// cmd tratta gli a capo come separatori di comando e taglia i prompt
/// multilinea alla prima riga (il resto muore lì).
/// Scelta SEMPRE la versione più nuova tra sistema e integrato:
/// se l'utente ha già opencode, quello resta e viene usato (mai
/// sovrascritto né disinstallato); il vendor è solo fallback offline.
fn opencode_version_of(path: &std::path::Path) -> Option<String> {
    let mut c = std::process::Command::new(path);
    #[cfg(target_os = "windows")]
    silence(&mut c);
    c.arg("--version")
        .stdin(Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output()
        .ok()
        .and_then(|o| {
            if !o.status.success() {
                return None;
            }
            let s = String::from_utf8_lossy(&o.stdout)
                .trim()
                .lines()
                .next()
                .unwrap_or("")
                .to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        })
}

/// "1.19.0" (o "opencode 1.19.0") -> (1,19,0). Sconosciuto -> (0,0,0).
fn parse_semver_triplet(s: &str) -> (u64, u64, u64) {
    let mut tok = String::new();
    for ch in s.chars() {
        if ch.is_ascii_digit() || ch == '.' {
            tok.push(ch);
        } else if !tok.is_empty() && tok.contains('.') {
            break;
        } else {
            tok.clear();
        }
    }
    let mut n = [0u64; 3];
    for (i, p) in tok.split('.').take(3).enumerate() {
        n[i] = p.parse().unwrap_or(0);
    }
    (n[0], n[1], n[2])
}

/// Copie di sistema (npm global + PATH). Esclude le nostre cartelle vendor:
/// quelle sono fallback, non "già messo nel PC".
fn system_opencode_exes() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = vec![];
    if let Ok(appdata) = std::env::var("APPDATA") {
        let p = PathBuf::from(appdata)
            .join("npm")
            .join("node_modules")
            .join("opencode-ai")
            .join("bin")
            .join("opencode.exe");
        if p.is_file() {
            v.push(p);
        }
    }
    if let Ok(out) = {
        let mut c = std::process::Command::new("cmd");
        #[cfg(target_os = "windows")]
        silence(&mut c);
        c.args(["/C", "where", "opencode"]).output()
    } {
        let txt = String::from_utf8_lossy(&out.stdout);
        for line in txt.lines() {
            let t = line.trim();
            let low = t.to_lowercase();
            if !low.ends_with(".exe") {
                continue;
            }
            // mai la nostra copia integrata
            if low.contains("zen-agent") {
                continue;
            }
            let pb = PathBuf::from(t);
            if pb.is_file() && !v.contains(&pb) {
                v.push(pb);
            }
        }
    }
    v
}

fn vendor_opencode_exes() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = vec![];
    if let Ok(me) = std::env::current_exe() {
        if let Some(dir) = me.parent() {
            for cand in [dir.join("vendor").join("opencode.exe"), dir.join("opencode.exe")] {
                if cand.is_file() {
                    v.push(cand);
                }
            }
        }
    }
    v
}

/// La più nuova tra sistema e integrato. A pari versione vince il sistema
/// (quello dell'utente non si tocca).
fn best_opencode_exe() -> Option<PathBuf> {
    let mut ranked: Vec<(PathBuf, bool, (u64, u64, u64))> = vec![];
    for p in system_opencode_exes() {
        let s = opencode_version_of(&p).unwrap_or_default();
        ranked.push((p, true, parse_semver_triplet(&s)));
    }
    for p in vendor_opencode_exes() {
        let s = opencode_version_of(&p).unwrap_or_default();
        ranked.push((p, false, parse_semver_triplet(&s)));
    }
    ranked.sort_by(|a, b| b.2.cmp(&a.2).then_with(|| b.1.cmp(&a.1)));
    ranked.into_iter().next().map(|(p, _, _)| p)
}

fn direct_opencode_exe() -> Option<PathBuf> {
    best_opencode_exe()
}

/// Costruisce il comando opencode: diretto all'exe quando possibile
/// (preserva a capo e caratteri speciali), shim npm via cmd come fallback.
/// Sempre nascosto: niente console che lampeggia (lo status polla ogni 8s).
fn opencode_command() -> std::process::Command {
    let mut c = match direct_opencode_exe() {
        Some(exe) => std::process::Command::new(exe),
        None => fallback_opencode_command(),
    };
    #[cfg(target_os = "windows")]
    silence(&mut c);
    c
}

#[cfg(target_os = "windows")]
fn fallback_opencode_command() -> std::process::Command {
    let mut c = std::process::Command::new("cmd");
    c.args(["/C", "opencode"]);
    c
}

#[cfg(not(target_os = "windows"))]
fn fallback_opencode_command() -> std::process::Command {
    std::process::Command::new("opencode")
}

static STATUS_CACHE: Mutex<(bool, String, u64)> = Mutex::new((false, String::new(), 0));

/// Stato opencode in cache (60s): evita di rilanciare l'exe a ogni poll.
fn cached_opencode() -> (bool, String) {
    let now = now_secs();
    {
        let c = STATUS_CACHE.lock().unwrap();
        if now.saturating_sub(c.2) < 60 {
            return (c.0, c.1.clone());
        }
    }
    let inst = opencode_installed();
    let ver = if inst { opencode_version() } else { String::new() };
    {
        let mut c = STATUS_CACHE.lock().unwrap();
        *c = (inst, ver.clone(), now);
    }
    (inst, ver)
}

fn run_opencode_args(args: &[&str], cwd: &str) -> Result<String, String> {
    let out = opencode_command()
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("avvio opencode fallito: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if out.status.success() {
        // Mai più "(nessun output)" muto: se lo stdout è vuoto ma c'è
        // qualcosa su stderr (login mancato, modello, rete) lo mostriamo.
        if stdout.trim().is_empty() {
            if !stderr.trim().is_empty() {
                return Err(format!("opencode risposta vuota: {}", stderr.trim()));
            }
            if !args.contains(&"--version") {
                return Err("opencode ha risposto vuoto: rifai il login (Zen usa i modelli gratis, serve un OAuth) e riprova."
                    .to_string());
            }
        }
        Ok(stdout)
    } else {
        Err(format!("opencode errore: {stderr}{stdout}"))
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
            let mut cmd = opencode_command();
            cmd.args(["serve", "--port", &SERVE_PORT.to_string()]);
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

fn parse_hm(s: &str) -> Option<(u16, u16)> {
    let (h, m) = s.split_once(':')?;
    let h: u16 = h.trim().parse().ok()?;
    let m: u16 = m.trim().parse().ok()?;
    if h < 24 && m < 60 {
        Some((h, m))
    } else {
        None
    }
}

fn local_hm() -> (u16, u16) {
    #[cfg(target_os = "windows")]
    {
        winmouse::local_hm()
    }
    #[cfg(not(target_os = "windows"))]
    {
        (0, 0)
    }
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
            // Attività a ora specifica: scatta quando l'orologio locale
            // è su quell'ora+minuto (guardia 23h anti-doppio scatto).
            let due = match t.time_daily.as_deref().map(str::trim) {
                Some(hm) if parse_hm(hm).is_some() => {
                    let (h, m) = parse_hm(hm).unwrap();
                    let (ch, cm) = local_hm();
                    ch == h && cm == m && now >= t.next_run
                }
                _ => now >= t.next_run,
            };
            if due {
                let cwd = state.cwd.lock().unwrap().clone();
                let prompt = t.prompt.clone();
                // Diretto prima (l'attach costa ~2,5s), attach solo di scorta.
                let res = run_opencode_args(
                    &[
                        "run",
                        "--format",
                        "default",
                        "--variant",
                        FAST_VARIANT,
                        "--dir",
                        &cwd,
                        &prompt,
                    ],
                    &cwd,
                );
                if res.is_err() {
                    let r2 = run_opencode_args(
                        &[
                            "run",
                            "--format",
                            "default",
                            "--attach",
                            &format!("http://127.0.0.1:{SERVE_PORT}"),
                            "--variant",
                            FAST_VARIANT,
                            "--dir",
                            &cwd,
                            &prompt,
                        ],
                        &cwd,
                    );
                    if r2.is_err() {
                        let _ = run_opencode_args(&["run", "--dir", &cwd, &prompt], &cwd);
                    }
                }
                t.next_run = if t.time_daily.is_some() {
                    now + 82800 // 23h: non riscattare nello stesso minuto
                } else {
                    now + t.interval_secs.max(60)
                };
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
    clear_response_flag(&app);
    if let Some(w) = app.get_webview_window("panel") {
        w.show().map_err(|e| e.to_string())?;
        w.unminimize().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
    }
    // nascondi la goccia mentre il pannello è aperto? no, resta il sensore.
    Ok(())
}

fn clear_response_flag(app: &tauri::AppHandle) {
    RESPONSE_PENDING.store(false, Ordering::SeqCst);
    NOTIFY_PINNED.store(false, Ordering::SeqCst);
    let _ = app.emit("zen-response-cleared", ());
}

fn show_aux_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(label) {
        w.show().map_err(|e| e.to_string())?;
        w.unminimize().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn hide_aux_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(label) {
        w.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_tasks(app: tauri::AppHandle) -> Result<(), String> {
    show_aux_window(&app, "tasks")
}

#[tauri::command]
fn hide_tasks(app: tauri::AppHandle) -> Result<(), String> {
    hide_aux_window(&app, "tasks")
}

#[tauri::command]
fn show_settings(app: tauri::AppHandle) -> Result<(), String> {
    show_aux_window(&app, "settings")
}

#[tauri::command]
fn hide_settings(app: tauri::AppHandle) -> Result<(), String> {
    hide_aux_window(&app, "settings")
}

#[tauri::command]
fn get_autostart(app: tauri::AppHandle) -> bool {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch().is_enabled().unwrap_or(true)
    }
    #[cfg(not(desktop))]
    {
        let _ = &app;
        true
    }
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        if enabled {
            app.autolaunch().enable().map_err(|e| e.to_string())
        } else {
            app.autolaunch().disable().map_err(|e| e.to_string())
        }
    }
    #[cfg(not(desktop))]
    {
        let _ = (&app, enabled);
        Ok(())
    }
}

#[tauri::command]
fn get_sound(app: tauri::AppHandle) -> String {
    stored_sound(&app)
}

#[tauri::command]
fn set_sound(app: tauri::AppHandle, sound: String) -> Result<(), String> {
    if !["ding", "pop", "chime", "off"].contains(&sound.as_str()) {
        return Err("suono non valido (ding|pop|chime|off)".into());
    }
    let f = sound_file(&app);
    if let Some(parent) = f.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&f, &sound).map_err(|e| e.to_string())
}

/// ZEN Nebula ha risposto mentre il pannello era chiuso: la goccia scende
/// con pallino rosso + suono (scelto nelle impostazioni).
#[tauri::command]
fn notify_response_ready(app: tauri::AppHandle) -> Result<(), String> {
    RESPONSE_PENDING.store(true, Ordering::SeqCst);
    NOTIFY_PINNED.store(true, Ordering::SeqCst);
    if let Some(w) = app.get_webview_window("drop") {
        let _ = w.show();
        let _ = w.emit("zen-drop-state", true);
    }
    let _ = app.emit("zen-response-ready", stored_sound(&app));
    Ok(())
}

#[tauri::command]
fn clear_response_ready(app: tauri::AppHandle) -> Result<(), String> {
    clear_response_flag(&app);
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
    let (inst, ver) = cached_opencode();
    AgentStatus {
        opencode: inst,
        version: ver,
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

/// Dettaglio breve per la riga OK: primo campo utile dell'input tool.
fn tool_detail(input: &serde_json::Value) -> String {
    for k in ["filePath", "command", "pattern", "query", "prompt", "url", "path", "message"] {
        if let Some(s) = input.get(k).and_then(|v| v.as_str()) {
            let t = s.trim().replace('\n', " ");
            if !t.is_empty() {
                let short = t.rsplit(['/', '\\']).next().unwrap_or(&t).to_string();
                return truncate(&short, 80);
            }
        }
    }
    String::new()
}

/// Run in streaming JSON: conferma di inizio, riga OK numerata per ogni
/// attività completata e pensieri live (eventi al pannello). Il reasoning
/// vero del provider è cifrato, quindi i "pensieri" sono tracce di attività
/// (cosa sta facendo), non il testo interno del modello.
fn run_streamed(
    app: &tauri::AppHandle,
    argv: Vec<String>,
    cwd: &str,
) -> Result<String, String> {
    use std::io::BufRead;
    let mut cmd = opencode_command();
    cmd.args(&argv).current_dir(cwd);
    cmd.stdin(Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(Stdio::null());
    let mut child = cmd.spawn().map_err(|e| format!("avvio opencode fallito: {e}"))?;
    let stdout = child.stdout.take().ok_or("stdout mancante")?;
    let mut final_text = String::new();
    let mut acts: u32 = 0;
    let mut started = false;
    let mut saw_content = false;
    for line in std::io::BufReader::new(stdout).lines() {
        let Ok(line) = line else { break };
        let t = line.trim();
        if t.is_empty() || !t.starts_with('{') {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(t) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let kind = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
        let part = v.get("part");
        match kind {
            "step_start" => {
                if !started {
                    started = true;
                    let _ = app.emit("zen-run-started", "▶ ZEN ha iniziato…");
                    let _ = app.emit("zen-thinking", "Analizzo la richiesta…");
                }
            }
            "reasoning" => {
                if let Some(s) = part
                    .and_then(|p| p.get("text"))
                    .and_then(|x| x.as_str())
                {
                    if !s.trim().is_empty() {
                        saw_content = true;
                        let _ = app.emit("zen-thinking", truncate(s.trim(), 300));
                    }
                }
            }
            "tool_use" => {
                let done = part
                    .and_then(|p| p.get("state"))
                    .and_then(|s| s.get("status"))
                    .and_then(|x| x.as_str())
                    == Some("completed");
                if done {
                    acts += 1;
                    saw_content = true;
                    let tool = part
                        .and_then(|p| p.get("tool"))
                        .and_then(|x| x.as_str())
                        .unwrap_or("attività");
                    let det = part
                        .and_then(|p| p.get("state"))
                        .and_then(|s| s.get("input"))
                        .map(tool_detail)
                        .unwrap_or_default();
                    let line = if det.is_empty() {
                        format!("OK \"ATTIVITÀ {acts}\" COMPLETATA — {tool}")
                    } else {
                        format!("OK \"ATTIVITÀ {acts}\" COMPLETATA — {tool}: {det}")
                    };
                    let _ = app.emit("zen-run-progress", line);
                    let _ = app.emit("zen-thinking", format!("{tool} fatto, continuo…"));
                }
            }
            "text" => {
                if let Some(s) = part.and_then(|p| p.get("text")).and_then(|x| x.as_str()) {
                    if !s.is_empty() {
                        saw_content = true;
                        final_text.push_str(s);
                    }
                }
            }
            _ => {}
        }
    }
    let st = child.wait().map_err(|e| format!("attesa opencode fallita: {e}"))?;
    if !st.success() {
        return Err("opencode errore (stream)".into());
    }
    if !saw_content {
        return Err("opencode risposta vuota (stream)".into());
    }
    Ok(final_text)
}

#[tauri::command]
async fn agent_run(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    prompt: String,
    auto_approve: Option<bool>,
    files: Option<Vec<String>>,
) -> Result<String, String> {
    let cwd = state.cwd.lock().unwrap().clone();
    let prompt_owned = prompt.clone();
    let _auto_flag = auto_approve.unwrap_or(false);
    let attached = files.unwrap_or_default();
    // Nessun contesto chat: il modello riceve solo la richiesta così com'è.
    let app_in = app.clone();
    tokio::task::spawn_blocking(move || {
        let attach = format!("http://127.0.0.1:{SERVE_PORT}");
        let run_with = |argv: Vec<String>| -> Result<String, String> {
            let refs: Vec<&str> = argv.iter().map(|s| s.as_str()).collect();
            run_opencode_args(&refs, &cwd)
        };
        // Argv streaming JSON (pensieri + OK live) oppure default (fallback).
        let build_args =
            |json: bool, with_attach: bool, fast: bool, text: &str, files: &[String]| -> Vec<String> {
                let mut v: Vec<String> = vec!["run".into()];
                if json {
                    v.push("--format".into());
                    v.push("json".into());
                    v.push("--thinking".into());
                } else {
                    v.push("--format".into());
                    v.push("default".into());
                }
                if with_attach {
                    v.push("--attach".into());
                    v.push(attach.clone());
                }
                if fast {
                    // Pensiero SEMPRE al minimo: reasoning effort ridotto,
                    // risposta quasi istantanea.
                    v.push("--variant".into());
                    v.push(FAST_VARIANT.into());
                }
                v.push("--dir".into());
                v.push(cwd.clone());
                v.push("--auto".into());
                for f in files {
                    v.push("--file".into());
                    v.push(f.clone());
                }
                v.push(text.to_string());
                v
            };
        let build_run = |with_attach: bool, fast: bool, text: &str, files: &[String]| -> Vec<String> {
            build_args(false, with_attach, fast, text, files)
        };
        let mut files = attached.clone();
        let mut temp_path: Option<std::path::PathBuf> = None;
        // Prompt enormi (>6000 caratteri): via file allegato. La riga di
        // comando di cmd.exe ha un limite (~8191 char) e le virgolette nei
        // testi lunghi rompono il parsing: il modello legge il file con --file.
        let prompt_text: String = if prompt_owned.chars().count() > 6000 {
            let path = std::env::temp_dir().join(format!("zen-prompt-{}.txt", now_secs()));
            match std::fs::write(&path, prompt_owned.as_bytes()) {
                Ok(_) => {
                    files.push(path.to_string_lossy().to_string());
                    temp_path = Some(path);
                    String::from(
                        "La richiesta completa è nel file allegato: leggilo integralmente ed eseguilo passo passo.",
                    )
                }
                Err(_) => prompt_owned.clone(),
            }
        } else {
            prompt_owned.clone()
        };
        // Messaggi lunghi: NESSUN piano intermedio. Il modello pianifica già
        // da solo nel suo loop agente; ogni header in più diventa solo un
        // pretesto per chiedere all'utente invece di eseguire.
        let final_prompt = prompt_text;
        // Corsia veloce: cache disco, poi streaming live diretto (l'attach
        // costa ~2,5s e resta solo come fallback). Ordine: diretto+veloce,
        // diretto, attach+veloce, attach. Poi fallback classico stesso ordine.
        let cacheable = attached.is_empty() && prompt_owned.chars().count() <= 500;
        if cacheable {
            if let Some(hit) = cache_get(prompt_owned.trim()) {
                if let Some(p) = temp_path {
                    let _ = std::fs::remove_file(&p);
                }
                return Ok(hit);
            }
        }
        let mut out = run_streamed(&app_in, build_args(true, false, true, &final_prompt, &files), &cwd)
            .map(|o| truncate(&o, 12000));
        for (att, fast) in [(false, false), (true, true), (true, false)] {
            if out.is_ok() {
                break;
            }
            out = run_streamed(&app_in, build_args(true, att, fast, &final_prompt, &files), &cwd)
                .map(|o| truncate(&o, 12000));
        }
        if out.is_err() {
            out = run_with(build_run(false, true, &final_prompt, &files))
                .map(|o| truncate(&o, 12000));
            for (att, fast) in [(false, false), (true, true), (true, false)] {
                if out.is_ok() {
                    break;
                }
                out = run_with(build_run(att, fast, &final_prompt, &files))
                    .map(|o| truncate(&o, 12000));
            }
        }
        if cacheable {
            if let Ok(o) = &out {
                cache_put(prompt_owned.trim(), o);
            }
        }
        if let Some(p) = temp_path {
            let _ = std::fs::remove_file(&p);
        }
        out
    })
    .await
    .map_err(|e| format!("task fallito: {e}"))?
}

#[tauri::command]
fn show_game(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("game") {
        w.show().map_err(|e| e.to_string())?;
        w.unminimize().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_game(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("game") {
        w.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Chiudi il pannello animandolo verso l'alto: diventa il rettangolino ZEN.
/// Nasconde il panel, mostra la drop per ~2.5s come feedback visivo.
#[tauri::command]
fn minimize_to_drop(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(p) = app.get_webview_window("panel") {
        let _ = p.hide();
    }
    if let Some(w) = app.get_webview_window("drop") {
        let _ = w.show();
        let _ = w.emit("zen-drop-state", true);
        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(2500));
            // Chiudi solo se l'utente non l'ha pinnato nel frattempo
            // (e non c'è una notifica di risposta in attesa)
            if !DROP_PINNED.load(Ordering::SeqCst)
                && !DROP_DRAGGING.load(Ordering::SeqCst)
                && !NOTIFY_PINNED.load(Ordering::SeqCst)
            {
                if let Some(ww) = handle.get_webview_window("drop") {
                    let _ = ww.emit("zen-drop-state", false);
                }
            }
        });
    }
    Ok(())
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    // Taglio su boundary di carattere: i byte multi-byte (à, è, emoji)
    // altrimenti fanno panico con &s[..max].
    let mut end = max.min(s.len());
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…\n[output troncato, {} caratteri totali]", &s[..end], s.len())
}

/// Cache risposte (motore di cache): prompt identico e breve, senza
/// allegati -> risposta istantanea da disco, zero rete. TTL 24h, tetto 100 voci.
fn cache_dir() -> PathBuf {
    home_dir().join(".zen-agent").join("cache")
}

fn fnv1a(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

fn cache_get(prompt: &str) -> Option<String> {
    let f = cache_dir().join(format!("{:016x}.json", fnv1a(prompt)));
    let text = std::fs::read_to_string(&f).ok()?;
    let v: serde_json::Value = serde_json::from_str(&text).ok()?;
    if now_secs().saturating_sub(v.get("t")?.as_u64()?) > 86400 {
        let _ = std::fs::remove_file(&f);
        return None;
    }
    v.get("r")?.as_str().map(|s| s.to_string())
}

fn cache_put(prompt: &str, resp: &str) {
    let dir = cache_dir();
    let _ = std::fs::create_dir_all(&dir);
    if let Ok(list) = std::fs::read_dir(&dir) {
        let mut files: Vec<PathBuf> = list.filter_map(|e| e.ok().map(|x| x.path())).collect();
        if files.len() >= 100 {
            files.sort_by_key(|p| {
                std::fs::metadata(p)
                    .and_then(|m| m.modified())
                    .ok()
            });
            if let Some(old) = files.first() {
                let _ = std::fs::remove_file(old);
            }
        }
    }
    let v = serde_json::json!({"t": now_secs(), "r": resp});
    let _ = std::fs::write(dir.join(format!("{:016x}.json", fnv1a(prompt))), v.to_string());
}

/// Warm-up gratis all'avvio (modelli free, costo zero): scalda exe,
/// TLS e prompt-cache così la prima domanda vera non paga l'avvio a freddo.
fn warm_engine(cwd: String) {
    std::thread::spawn(move || {
        let _ = run_opencode_args(
            &[
                "run",
                "--format",
                "json",
                "--variant",
                FAST_VARIANT,
                "--dir",
                &cwd,
                "--auto",
                "rispondi OK",
            ],
            &cwd,
        );
    });
}

#[tauri::command]
fn ensure_opencode_setup(state: tauri::State<AppState>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    ensure_windows_deps();
    // Se c'è già quello di sistema: NON si installa e NON si disinstalla
    // nulla. Lo si usa così com'è (è sempre il più nuovo a vincere).
    let system_hit = !system_opencode_exes().is_empty();
    if !opencode_installed() {
        // Niente da nessuna parte: scarica SEMPRE l'ultima via npm.
        #[cfg(target_os = "windows")]
        {
            let mut c = std::process::Command::new("cmd");
            c.args(["/C", "npm", "i", "-g", "opencode-ai@latest"]);
            silence(&mut c);
            let _ = c.status();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::process::Command::new("npm")
                .args(["i", "-g", "opencode-ai@latest"])
                .status();
        }
        // cache status da buttare: il mondo è cambiato
        if let Ok(mut c) = STATUS_CACHE.lock() {
            *c = (false, String::new(), 0);
        }
    }
    fix_corrupted_db();
    let model = ensure_free_model();
    ensure_serve_daemon();
    let cwd_now = state.cwd.lock().unwrap().clone();
    let _ = &state.cwd;
    if opencode_installed() {
        // Scalda il motore in background: la prima domanda non paga il freddo.
        warm_engine(cwd_now);
        let ver = opencode_version();
        if system_hit {
            Ok(format!("ok • usa il tuo opencode {ver} (non toccato) • modello: {model}"))
        } else {
            Ok(format!("ok • motore integrato {ver} (sistema assente) • modello: {model}"))
        }
    } else {
        Err("opencode non trovato: installa Node LTS poi rilancia (il setup .exe lo fa da solo)".into())
    }
}

#[tauri::command]
fn add_task(
    app: tauri::AppHandle,
    prompt: String,
    interval_secs: u64,
    time_daily: Option<String>,
) -> Result<AgentTask, String> {
    let daily = time_daily
        .map(|s| s.trim().to_string())
        .filter(|s| parse_hm(s).is_some());
    let mut tasks = load_tasks(&app);
    let now = now_secs();
    let iv = interval_secs.max(60);
    let t = AgentTask {
        id: format!("task-{now}"),
        prompt,
        interval_secs: iv,
        next_run: if daily.is_some() { 0 } else { now + iv },
        time_daily: daily,
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
    const HIDDEN: u32 = 0x00000008 | 0x08000000; // DETACHED + NO_WINDOW

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
        .args(["/C", "start", "/MIN", "", &bat.to_string_lossy()])
        .creation_flags(HIDDEN)
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
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", "taskkill", "/F", "/IM", "opencode.exe"]);
        silence(&mut c);
        let _ = c.output();
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
    clear_response_flag(app);
    if let Some(w) = app.get_webview_window("panel") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn size_drop_to_monitor(app: &tauri::AppHandle) {
    // Finestrella piccola sul bordo scelto: il resto dello schermo resta cliccabile.
    let pos = stored_drop_position(app);
    if let Some(w) = app.get_webview_window("drop") {
        if let Ok(Some(m)) = w.current_monitor() {
            let scale = m.scale_factor();
            let ww = (280.0 * scale) as u32;
            let wh = (150.0 * scale) as u32;
            let sw = m.size().width;
            let sh = m.size().height;
            let (x, y) = match pos.as_str() {
                // Sopra la barra delle applicazioni, spazio libero a sinistra
                "bottom" => (
                    (40.0 * scale) as i32,
                    sh.saturating_sub(wh).saturating_sub((70.0 * scale) as u32) as i32,
                ),
                "left" => (0, (sh.saturating_sub(wh)) as i32 / 2),
                "right" => ((sw.saturating_sub(ww)) as i32, (sh.saturating_sub(wh)) as i32 / 2),
                _ => ((sw.saturating_sub(ww)) as i32 / 2, 0),
            };
            let _ = w.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: ww,
                height: wh,
            }));
            let _ = w.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }
    }
}

fn drop_position_file(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| home_dir().join(".zen-agent"))
        .join("drop-position.txt")
}

fn stored_drop_position(app: &tauri::AppHandle) -> String {
    std::fs::read_to_string(drop_position_file(app))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| ["top", "bottom", "left", "right"].contains(&s.as_str()))
        .unwrap_or_else(|| "top".to_string())
}

#[tauri::command]
fn get_drop_position(app: tauri::AppHandle) -> String {
    stored_drop_position(&app)
}

#[tauri::command]
fn set_drop_position(app: tauri::AppHandle, position: String) -> Result<(), String> {
    if !["top", "bottom", "left", "right"].contains(&position.as_str()) {
        return Err("posizione non valida (top|bottom|left|right)".into());
    }
    let f = drop_position_file(&app);
    if let Some(parent) = f.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&f, &position).map_err(|e| e.to_string())?;
    DROP_PINNED.store(false, Ordering::SeqCst);
    size_drop_to_monitor(&app);
    let _ = app.emit("zen-drop-position", position);
    Ok(())
}

#[cfg(target_os = "windows")]
mod winmouse {
    #[repr(C)]
    struct Point {
        x: i32,
        y: i32,
    }
    #[repr(C)]
    struct SysTime {
        year: u16,
        month: u16,
        dow: u16,
        day: u16,
        hour: u16,
        min: u16,
        sec: u16,
        ms: u16,
    }
    #[link(name = "user32")]
    extern "system" {
        fn GetCursorPos(pt: *mut Point) -> i32;
        fn GetAsyncKeyState(vkey: i32) -> i16;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn GetLocalTime(st: *mut SysTime);
    }
    pub fn cursor() -> (i32, i32) {
        let mut p = Point { x: 0, y: 0 };
        unsafe {
            GetCursorPos(&mut p);
        }
        (p.x, p.y)
    }
    pub fn lbutton_held() -> bool {
        unsafe { (GetAsyncKeyState(0x01) as u16 & 0x8000) != 0 }
    }
    pub fn local_hm() -> (u16, u16) {
        let mut st = SysTime {
            year: 0, month: 0, dow: 0, day: 0,
            hour: 0, min: 0, sec: 0, ms: 0,
        };
        unsafe {
            GetLocalTime(&mut st);
        }
        (st.hour, st.min)
    }
}

static DROP_PINNED: AtomicBool = AtomicBool::new(false);
static DROP_DRAGGING: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn set_drop_pinned(pinned: bool) {
    DROP_PINNED.store(pinned, Ordering::SeqCst);
}

#[tauri::command]
fn set_drop_dragging(dragging: bool) {
    DROP_DRAGGING.store(dragging, Ordering::SeqCst);
}

/// La fascia non intercetta mai i click: la finestra resta nascosta finche
/// il cursore non sfiora il bordo superiore, e resta click-through ovunque
/// tranne sulla pill (o durante un trascinamento file).
fn setup_drop_tracker(app: &tauri::AppHandle) {
    size_drop_to_monitor(app);
    let handle = app.clone();
    std::thread::spawn(move || {
        let mut far_ticks: u32 = 0;
        let mut last_ignore: Option<bool> = None;
        loop {
        std::thread::sleep(std::time::Duration::from_millis(120));
        let Some(w) = handle.get_webview_window("drop") else {
            continue;
        };
        #[cfg(target_os = "windows")]
        let (cx, cy) = winmouse::cursor();
        #[cfg(not(target_os = "windows"))]
        let (cx, cy) = (0i32, 9999i32);
        #[cfg(target_os = "windows")]
        let held = winmouse::lbutton_held();
        #[cfg(not(target_os = "windows"))]
        let held = false;
        // Bordo assegnato a ZEN (dalle impostazioni): distanza del cursore da lì
        let pos = stored_drop_position(&handle);
        let (mw, mh) = w
            .current_monitor()
            .ok()
            .flatten()
            .map(|m| (m.size().width as i32, m.size().height as i32))
            .unwrap_or((1920, 1080));
        let edge_dist: i32 = match pos.as_str() {
            "bottom" => mh - cy,
            "left" => cx,
            "right" => mw - cx,
            _ => cy,
        };
        // Watchdog anti-stuck: cursore lontano per piu di ~3s -> forza chiusura
        // (mai durante una notifica di risposta: resta finché non la apri)
        if edge_dist > 320 && !DROP_DRAGGING.load(Ordering::SeqCst) && !NOTIFY_PINNED.load(Ordering::SeqCst) {
            far_ticks += 1;
            if far_ticks > 36 {
                DROP_PINNED.store(false, Ordering::SeqCst);
                far_ticks = 0;
            }
        } else {
            far_ticks = 0;
        }
        let pinned = DROP_PINNED.load(Ordering::SeqCst) || DROP_DRAGGING.load(Ordering::SeqCst);
        let notify = NOTIFY_PINNED.load(Ordering::SeqCst);
        // Zona larga sul bordo assegnato: la goccia resta finché il cursore
        // è nei ~120px, così si fa in tempo a prenderla e trascinarla.
        // La finestra resta click-through tranne sulla pill: nessun click rubato.
        let want_visible = edge_dist <= 120 || pinned || notify || (held && edge_dist <= 220);
        let is_visible = w.is_visible().unwrap_or(true);
        if want_visible && !is_visible {
            let _ = w.show();
            let _ = w.emit("zen-drop-state", true);
            last_ignore = None;
        } else if !want_visible && is_visible {
            let _ = w.hide();
            let _ = w.emit("zen-drop-state", false);
            last_ignore = None;
        }
        if want_visible {
            // Coordinate cursore relative alla finestra (pixel fisici)
            let scale = w.scale_factor().unwrap_or(1.0) as f64;
            let (wx, wy) = w
                .outer_position()
                .map(|p| (p.x as f64, p.y as f64))
                .unwrap_or((0.0, 0.0));
            let lx = cx as f64 - wx;
            let ly = cy as f64 - wy;
            let ww = 280.0 * scale;
            let wh = 150.0 * scale;
            // Rettangolo pill (coerente col CSS: 232x36 a 10px dal top, centrata)
            let in_pill = lx >= ww / 2.0 - 120.0 * scale
                && lx <= ww / 2.0 + 120.0 * scale
                && ly >= 8.0 * scale
                && ly <= 52.0 * scale;
            let in_win = lx >= 0.0 && ly >= 0.0 && lx <= ww && ly <= wh;
            // Interattiva solo sulla pill, o su tutta la finestrella mentre trascini
            // (drag di file o gesto drag-down): un drag non fa mai click accidentali.
            let interactive = in_pill || ((held || DROP_DRAGGING.load(Ordering::SeqCst)) && in_win);
            // Applica il cambio solo quando cambia davvero: toccare gli stili
            // della finestra a ogni giro forza il ricompositing e lagga il PC.
            if last_ignore != Some(!interactive) {
                let _ = w.set_ignore_cursor_events(!interactive);
                last_ignore = Some(!interactive);
            }
        }
        }
    });
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
            show_tasks,
            hide_tasks,
            show_settings,
            hide_settings,
            get_drop_position,
            set_drop_position,
            get_autostart,
            set_autostart,
            get_sound,
            set_sound,
            notify_response_ready,
            clear_response_ready,
            agent_status,
            agent_run,
            show_game,
            hide_game,
            minimize_to_drop,
            ensure_opencode_setup,
            add_task,
            list_tasks,
            remove_task,
            get_update_channel,
            set_update_channel,
            check_update,
            install_update,
            repair_opencode_db,
            set_drop_pinned,
            set_drop_dragging
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

            setup_drop_tracker(app.handle());
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
