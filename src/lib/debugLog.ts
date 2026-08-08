import { invoke } from '@tauri-apps/api/core';

// Mirror a message to the console and the Rust-side log file (best-effort).
export function debugLog(message: string) {
  console.log(message);
  void invoke('frontend_log', { message }).catch(() => {});
}
