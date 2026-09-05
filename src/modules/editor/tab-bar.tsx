import { useAtomValue, useSetAtom } from 'jotai';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  activePathAtom,
  buffersAtom,
  closeBufferAtom,
  isDirty,
} from '@/store/editor';

export default function TabBar() {
  const buffers = useAtomValue(buffersAtom);
  const activePath = useAtomValue(activePathAtom);
  const setActive = useSetAtom(activePathAtom);
  const close = useSetAtom(closeBufferAtom);

  if (buffers.length === 0) return null;

  return (
    <div className="border-border flex h-8.5 shrink-0 items-center gap-px overflow-x-auto border-b">
      {buffers.map((buffer) => {
        const active = buffer.path === activePath;
        const dirty = isDirty(buffer);
        return (
          <div
            key={buffer.path}
            className={cn(
              'group border-border flex h-full shrink-0 items-center gap-1.5 border-r pr-1 pl-3 text-xs transition-colors',
              active
                ? 'text-foreground bg-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <button
              type="button"
              title={buffer.path}
              onClick={() => setActive(buffer.path)}
              className="max-w-50 truncate outline-none"
            >
              {buffer.name}
            </button>
            <button
              type="button"
              title={dirty ? 'Unsaved changes' : 'Close'}
              onClick={() => void close(buffer.path)}
              className="hover:bg-accent flex size-4.5 items-center justify-center rounded outline-none"
            >
              {dirty ? (
                <>
                  <span className="bg-primary size-1.75 rounded-full group-hover:hidden" />
                  <X className="hidden size-3 group-hover:block" />
                </>
              ) : (
                <X className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
