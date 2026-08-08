import { useCallback, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Check, PencilLine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PathBreadcrumb from './path-breadcrumb';

interface PathBarProps {
  path: string;
  onNavigate: (path: string) => void;
}

/**
 * Breadcrumb by default; switches to a text field for typing a path directly,
 * the way a file manager's Ctrl+L does. Enter navigates, Escape cancels.
 */
export default function PathBar({ path, onNavigate }: PathBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(path);

  // The field only mounts while editing, so selecting on mount via a callback
  // ref avoids an effect that would setState during render.
  const selectOnMount = useCallback((el: HTMLInputElement | null) => {
    el?.select();
  }, []);

  const startEditing = () => {
    setDraft(path); // seed here, not in an effect
    setEditing(true);
  };

  const commit = (e: FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    if (next && next !== path) onNavigate(next);
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <form onSubmit={commit} className="flex items-center gap-1">
        <Input
          ref={selectOnMount}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          aria-label="Path"
          className="h-7 font-mono text-xs"
        />
        <Button type="submit" variant="ghost" size="icon-sm" title="Go">
          <Check />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Cancel"
          onClick={() => setEditing(false)}
        >
          <X />
        </Button>
      </form>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <PathBreadcrumb path={path} onNavigate={onNavigate} />
      <Button
        variant="ghost"
        size="icon-xs"
        title="Type a path"
        className="shrink-0"
        onClick={startEditing}
      >
        <PencilLine />
      </Button>
    </div>
  );
}
