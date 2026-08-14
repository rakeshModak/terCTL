import { useCallback, useState, type FormEvent } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { TriangleAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  confirmReqAtom,
  promptReqAtom,
  resolveConfirmAtom,
  resolvePromptAtom,
  type PromptRequest,
} from '../store/dialog';

export function Dialogs() {
  const promptReq = useAtomValue(promptReqAtom);
  const confirmReq = useAtomValue(confirmReqAtom);
  const resolvePrompt = useSetAtom(resolvePromptAtom);
  const resolveConfirm = useSetAtom(resolveConfirmAtom);

  return (
    <>
      <Dialog
        open={promptReq !== null}
        onOpenChange={(open) => {
          if (!open) resolvePrompt(null);
        }}
      >
        <DialogContent>
          {promptReq && (
            <PromptForm
              key={promptReq.title + promptReq.initialValue}
              req={promptReq}
              onSubmit={resolvePrompt}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmReq !== null}
        onOpenChange={(open) => {
          if (!open) resolveConfirm(false);
        }}
      >
        <AlertDialogContent>
          {confirmReq && (
            <>
              <AlertDialogHeader>
                {confirmReq.danger && (
                  <AlertDialogMedia className="bg-destructive/10 text-destructive">
                    <TriangleAlert />
                  </AlertDialogMedia>
                )}
                <AlertDialogTitle>{confirmReq.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmReq.message}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant={confirmReq.danger ? 'destructive' : 'default'}
                  onClick={() => resolveConfirm(true)}
                >
                  {confirmReq.confirmLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PromptForm({
  req,
  onSubmit,
}: {
  req: PromptRequest;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(req.initialValue);

  const focusRef = useCallback((el: HTMLInputElement | null) => {
    if (!el) return;
    el.focus();
    const dot = el.value.lastIndexOf('.');
    el.setSelectionRange(0, dot > 0 ? dot : el.value.length, 'backward');
    el.scrollLeft = 0;
  }, []);

  const trimmed = value.trim();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="contents">
      <DialogHeader>
        <DialogTitle className="wrap-anywhere">{req.title}</DialogTitle>
      </DialogHeader>

      <Input
        ref={focusRef}
        value={value}
        placeholder={req.placeholder}
        aria-label={req.placeholder || req.title}
        onChange={(e) => setValue(e.currentTarget.value)}
      />

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={!trimmed}>
          {req.confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
