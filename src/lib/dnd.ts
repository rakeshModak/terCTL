import type { FileEntryType } from '@/types/file';
import type { TransferSideType } from '@/types/transfer';

/**
 * One MIME type per source side.
 *
 * The drag payload itself is unreadable during `dragover` — browsers only
 * expose `dataTransfer.types` until the drop fires. Encoding the origin in the
 * type is therefore what lets a pane decide whether to accept a drag while it
 * is still in flight, without any shared "currently dragging" state.
 *
 * Must stay lowercase: the DnD API lowercases custom types on the way in.
 */
export const TRANSFER_MIME: Record<TransferSideType, string> = {
  local: 'application/x-terctl-local',
  remote: 'application/x-terctl-remote',
};

/**
 * Swap the browser's default drag image for a compact chip.
 *
 * The default is a snapshot of the dragged element — and a table row spans the
 * full width of its table, so dragging a file appeared to drag the entire
 * pane. A purpose-built preview also lets a multi-file drag say how many
 * items it carries.
 *
 * The node must exist in the document when setDragImage reads it, so it is
 * parked offscreen and removed on the next frame.
 */
function setDragPreview(dataTransfer: DataTransfer, entries: FileEntryType[]): void {
  const chip = document.createElement('div');
  chip.className =
    'pointer-events-none fixed -top-96 -left-96 z-50 rounded-md border border-border ' +
    'bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-lg';
  chip.textContent =
    entries.length === 1 ? entries[0].name : `${entries.length} items`;

  document.body.append(chip);
  dataTransfer.setDragImage(chip, 12, 12);
  requestAnimationFrame(() => chip.remove());
}

/** Attach the dragged entries, tagged with the pane they came from. */
export function setDragPayload(
  dataTransfer: DataTransfer,
  side: TransferSideType,
  entries: FileEntryType[],
): void {
  dataTransfer.effectAllowed = 'copy';
  dataTransfer.setData(TRANSFER_MIME[side], JSON.stringify(entries));
  // Plain-text fallback so dropping outside the app degrades sensibly.
  dataTransfer.setData('text/plain', entries.map((e) => e.path).join('\n'));
  setDragPreview(dataTransfer, entries);
}

/** True when the in-flight drag originated from `side`. Safe during dragover. */
export function isDragFrom(dataTransfer: DataTransfer, side: TransferSideType): boolean {
  return Array.from(dataTransfer.types).includes(TRANSFER_MIME[side]);
}

/** Read the entries on drop. Returns [] when the payload isn't ours. */
export function readDragPayload(
  dataTransfer: DataTransfer,
  side: TransferSideType,
): FileEntryType[] {
  const raw = dataTransfer.getData(TRANSFER_MIME[side]);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FileEntryType[]) : [];
  } catch {
    return [];
  }
}
