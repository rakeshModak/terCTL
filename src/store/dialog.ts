import { atom } from 'jotai';

// Tauri's macOS WebView doesn't implement window.prompt() (it returns null),
// so we provide in-app prompt/confirm dialogs with the same Promise-based
// ergonomics as the native ones.

export interface PromptRequest {
  title: string;
  placeholder: string;
  initialValue: string;
  confirmLabel: string;
  resolve: (value: string | null) => void;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (value: boolean) => void;
}

export const promptReqAtom = atom<PromptRequest | null>(null);
export const confirmReqAtom = atom<ConfirmRequest | null>(null);

// Write-atoms return the pending Promise, so callers — React components
// (`await useSetAtom(promptAtom)(...)`) and other action atoms
// (`await set(promptAtom, ...)`) — both get the same ergonomics.
export const promptAtom = atom(
  null,
  (
    _get,
    set,
    opts: {
      title: string;
      initialValue?: string;
      placeholder?: string;
      confirmLabel?: string;
    },
  ) =>
    new Promise<string | null>((resolve) => {
      set(promptReqAtom, {
        title: opts.title,
        placeholder: opts.placeholder ?? '',
        initialValue: opts.initialValue ?? '',
        confirmLabel: opts.confirmLabel ?? 'Save',
        resolve,
      });
    }),
);

export const confirmAtom = atom(
  null,
  (
    _get,
    set,
    opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
    },
  ) =>
    new Promise<boolean>((resolve) => {
      set(confirmReqAtom, {
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        danger: opts.danger ?? false,
        resolve,
      });
    }),
);

export const resolvePromptAtom = atom(
  null,
  (get, set, value: string | null) => {
    const req = get(promptReqAtom);
    if (req) req.resolve(value);
    set(promptReqAtom, null);
  },
);

export const resolveConfirmAtom = atom(null, (get, set, value: boolean) => {
  const req = get(confirmReqAtom);
  if (req) req.resolve(value);
  set(confirmReqAtom, null);
});
