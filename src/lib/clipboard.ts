import {
  readText,
  writeText,
} from '@tauri-apps/plugin-clipboard-manager';
import { debugLog } from './debugLog';

export async function writeClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await writeText(text);
    return true;
  } catch (e) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      debugLog(`clipboard write failed: ${e}`);
      return false;
    }
  }
}

export async function readClipboard(): Promise<string | null> {
  try {
    return await readText();
  } catch (e) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      debugLog(`clipboard read failed: ${e}`);
      return null;
    }
  }
}
