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

export const api = {
  showPanel: () => invoke<void>("show_panel"),
  hidePanel: () => invoke<void>("hide_panel"),
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
};

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
