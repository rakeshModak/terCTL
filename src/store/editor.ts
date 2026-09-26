import { atom } from 'jotai';
import { toast } from 'sonner';
import { editorService } from '@/services/editor.service';
import { confirmAtom } from '@/store/dialog';
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '@/store/settings';
import type {
  BufferType,
  FileStatType,
  FileClipboardType,
} from '@/types/editor';

export const editorHostIdAtom = atom<string | null>(null);
export const editorRootAtom = atom<string | null>(null);
export const buffersAtom = atom<BufferType[]>([]);
export const activePathAtom = atom<string | null>(null);

export const editorZoomAtom = atom(0);

export const fileClipboardAtom = atom<FileClipboardType | null>(null);

export function editorFontSize(base: number, zoom: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, base + zoom));
}

export const activeBufferAtom = atom((get) => {
  const path = get(activePathAtom);
  return get(buffersAtom).find((b) => b.path === path) ?? null;
});

export function isDirty(buffer: BufferType): boolean {
  return buffer.draft !== buffer.content;
}

function baseName(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx < 0 ? path : path.slice(idx + 1);
}

function replaceBuffer(
  buffers: BufferType[],
  path: string,
  update: (b: BufferType) => BufferType,
): BufferType[] {
  return buffers.map((b) => (b.path === path ? update(b) : b));
}

export const openWorkspaceAtom = atom(
  null,
  (get, set, hostId: string, root: string) => {
    const previous = get(editorHostIdAtom);
    if (previous !== hostId) {
      set(buffersAtom, []);
      set(activePathAtom, null);
      // Language servers are processes on someone's machine; leaving them
      // running for a host nobody is editing any more is a leak on their box.
      //
      // Imported here rather than at the top: this store is loaded during
      // boot, and reaching the LSP client statically would drag it — and the
      // editor with it — in front of every launch. Changing workspace is rare
      // enough to pay for the fetch.
      if (previous) {
        void import('@/lib/lsp').then((lsp) =>
          lsp.releaseLanguageServers(previous),
        );
      }
    }
    set(editorHostIdAtom, hostId);
    set(editorRootAtom, root);
  },
);

export const openFileAtom = atom(null, async (get, set, path: string) => {
  const hostId = get(editorHostIdAtom);
  if (!hostId) return;

  if (get(buffersAtom).some((b) => b.path === path)) {
    set(activePathAtom, path);
    return;
  }

  try {
    const file = await editorService.read(hostId, path);
    if (!get(buffersAtom).some((b) => b.path === file.path)) {
      set(buffersAtom, [
        ...get(buffersAtom),
        {
          ...file,
          name: baseName(file.path),
          draft: file.content,
          saving: false,
        },
      ]);
    }
    set(activePathAtom, file.path);
  } catch (e) {
    toast.error(String(e));
  }
});

export const setDraftAtom = atom(
  null,
  (get, set, path: string, draft: string) => {
    set(
      buffersAtom,
      replaceBuffer(get(buffersAtom), path, (b) => ({ ...b, draft })),
    );
  },
);

export const saveBufferAtom = atom(null, async (get, set, path: string) => {
  const hostId = get(editorHostIdAtom);
  const buffer = get(buffersAtom).find((b) => b.path === path);
  if (!hostId || !buffer || buffer.saving) return;

  const draft = buffer.draft;
  const settle = (saving: boolean) =>
    set(
      buffersAtom,
      replaceBuffer(get(buffersAtom), path, (b) => ({ ...b, saving })),
    );

  settle(true);

  const write = async (expected: FileStatType | null) => {
    const stat = await editorService.write(
      hostId,
      path,
      draft,
      buffer.eol,
      buffer.bom,
      expected,
    );
    set(
      buffersAtom,
      replaceBuffer(get(buffersAtom), path, (b) => ({
        ...b,
        content: draft,
        stat,
        saving: false,
      })),
    );
  };

  try {
    await write(buffer.stat);
  } catch (e) {
    const message = String(e);
    if (!message.includes('changed on the server')) {
      settle(false);
      toast.error(message);
      return;
    }

    const overwrite = await set(confirmAtom, {
      title: 'File changed on the server',
      message: `${buffer.name} was modified since you opened it. Saving now replaces those changes.`,
      confirmLabel: 'Overwrite',
      danger: true,
    });

    if (!overwrite) {
      settle(false);
      return;
    }

    try {
      await write(null);
    } catch (err) {
      settle(false);
      toast.error(String(err));
    }
  }
});

export const reloadBufferAtom = atom(null, async (get, set, path: string) => {
  const hostId = get(editorHostIdAtom);
  const buffer = get(buffersAtom).find((b) => b.path === path);
  if (!hostId || !buffer) return;

  if (isDirty(buffer)) {
    const discard = await set(confirmAtom, {
      title: 'Discard changes?',
      message: `Reloading ${buffer.name} throws away your unsaved edits.`,
      confirmLabel: 'Discard',
      danger: true,
    });
    if (!discard) return;
  }

  try {
    const file = await editorService.read(hostId, path);
    set(
      buffersAtom,
      replaceBuffer(get(buffersAtom), path, (b) => ({
        ...b,
        ...file,
        draft: file.content,
      })),
    );
  } catch (e) {
    toast.error(String(e));
  }
});

export const closeBufferAtom = atom(null, async (get, set, path: string) => {
  const buffers = get(buffersAtom);
  const buffer = buffers.find((b) => b.path === path);
  if (!buffer) return;

  if (isDirty(buffer)) {
    const discard = await set(confirmAtom, {
      title: 'Unsaved changes',
      message: `${buffer.name} has edits that have not been saved to the server.`,
      confirmLabel: 'Close without saving',
      danger: true,
    });
    if (!discard) return;
  }

  const index = buffers.findIndex((b) => b.path === path);
  const remaining = buffers.filter((b) => b.path !== path);
  set(buffersAtom, remaining);

  if (get(activePathAtom) === path) {
    set(activePathAtom, remaining[Math.max(0, index - 1)]?.path ?? null);
  }
});
