// Zen Agent — layer API condiviso (React + TS)
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AgentStatus {
  opencode: boolean;
  version: string;
  serve: boolean;
  model: string;
  cwd: string;
}

export interface UpdateInfo {
  available: boolean;
  current: string;
  latest: string;
  notes: string;
  url: string;
  sha256: string;
  channel: string;
  message: string;
}

export interface UpdateProgress {
  received: number;
  total: number;
}

export interface AgentTask {
  id: string;
  prompt: string;
  interval_secs: number;
  next_run: number;
  time_daily?: string | null;
}

export const api = {
  showPanel: () => invoke<void>("show_panel"),
  hidePanel: () => invoke<void>("hide_panel"),
  minimizeToDrop: () => invoke<void>("minimize_to_drop"),
  showGame: () => invoke<void>("show_game"),
  hideGame: () => invoke<void>("hide_game"),
  showTasks: () => invoke<void>("show_tasks"),
  hideTasks: () => invoke<void>("hide_tasks"),
  showSettings: () => invoke<void>("show_settings"),
  hideSettings: () => invoke<void>("hide_settings"),
  getAutostart: () => invoke<boolean>("get_autostart"),
  setAutostart: (enabled: boolean) => invoke<void>("set_autostart", { enabled }),
  getSound: () => invoke<string>("get_sound"),
  setSound: (sound: string) => invoke<void>("set_sound", { sound }),
  getDropPosition: () => invoke<string>("get_drop_position"),
  setDropPosition: (position: string) => invoke<void>("set_drop_position", { position }),
  getHotkey: () => invoke<string>("get_hotkey"),
  setHotkey: (seq: string) => invoke<string>("set_hotkey", { seq }),
  getDropHidden: () => invoke<boolean>("get_drop_hidden"),
  setDropHidden: (hidden: boolean) => invoke<void>("set_drop_hidden", { hidden }),
  panelGrow: (extra: number) => invoke<void>("panel_grow", { extra }),
  panelRest: () => invoke<void>("panel_rest"),
  fileInfo: (path: string) => invoke<FileDetails>("file_info", { path }),
  notifyReady: () => invoke<void>("notify_response_ready"),
  clearReady: () => invoke<void>("clear_response_ready"),
  addTask: (prompt: string, intervalSecs: number, timeDaily?: string | null) =>
    invoke<AgentTask>("add_task", { prompt, intervalSecs, timeDaily: timeDaily ?? null }),
  listTasks: () => invoke<AgentTask[]>("list_tasks"),
  removeTask: (id: string) => invoke<void>("remove_task", { id }),
  setDropPinned: (v: boolean) => invoke<void>("set_drop_pinned", { pinned: v }),
  setDropDragging: (v: boolean) => invoke<void>("set_drop_dragging", { dragging: v }),
  status: () => invoke<AgentStatus>("agent_status"),
  run: (prompt: string, autoApprove: boolean, files: string[]) =>
    invoke<string>("agent_run", { prompt, autoApprove, files }),
  ensureSetup: () => invoke<string>("ensure_opencode_setup"),
  checkUpdate: (channel?: string) =>
    invoke<UpdateInfo>("check_update", channel ? { channel } : {}),
  installUpdate: (info: UpdateInfo) =>
    invoke<string>("install_update", {
      url: info.url,
      sha256: info.sha256,
      version: info.latest,
    }),
  getChannel: () => invoke<string>("get_update_channel"),
  setChannel: (channel: string) =>
    invoke<void>("set_update_channel", { channel }),
  phoneStart: () => invoke<string>("phone_start"),
  phoneStop: () => invoke<void>("phone_stop"),
  phoneStatus: () => invoke<PhoneStatus>("phone_status"),
  phoneAnswer: (id: number, text: string) =>
    invoke<void>("phone_answer", { id, text }),
  phoneRemoteStart: () => invoke<string>("phone_remote_start"),
  phoneRemoteStop: () => invoke<void>("phone_remote_stop"),
  showVoice: () => invoke<void>("show_voice"),
  hideVoice: () => invoke<void>("hide_voice"),
  getVoiceListen: () => invoke<boolean>("get_voice_listen"),
  setVoiceListen: (enabled: boolean) => invoke<void>("set_voice_listen", { enabled }),
};

export interface PhoneStatus {
  running: boolean;
  url: string;
  public_url: string;
  remote: string;
}

export interface FileDetails {
  name: string;
  size: number;
  is_image: boolean;
  exists: boolean;
}

export function formatSize(n: number): string {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function onFilesDropped(cb: (paths: string[]) => void): Promise<UnlistenFn> {
  return listen<string[]>("zen-files-dropped", (e) => cb(e.payload));
}

export function onExpectFiles(cb: () => void): Promise<UnlistenFn> {
  return listen("zen-expect-files", () => cb());
}

export function notifyPanelFiles(paths: string[]): Promise<void> {
  return emitTo("panel", "zen-files-dropped", paths);
}

export function notifyPanelExpectFiles(): Promise<void> {
  return emitTo("panel", "zen-expect-files", null);
}

export function fileName(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

export function isImage(p: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg|ico|avif)$/i.test(p);
}
