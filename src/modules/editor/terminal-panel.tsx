import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Terminal } from '@/components/Terminal';
import { sshService } from '@/services/ssh.service';
import { settingsAtom } from '@/store/settings';

interface TerminalPanelProps {
  hostId: string;
  /** The workspace folder, so the shell starts where the file tree is. */
  cwd: string | null;
}

export default function TerminalPanel({ hostId, cwd }: TerminalPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { termScheme } = useAtomValue(settingsAtom);
  // Frozen at mount. Opening a different folder later must not reach into a
  // shell that may have a program running in it and type a `cd` at it.
  const [startDir] = useState(cwd);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    sshService
      .connect(hostId, startDir)
      .then((id) => {
        created = id;
        if (cancelled) {
          void sshService.disconnect(id);
          return;
        }
        setSessionId(id);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
      if (created) void sshService.disconnect(created);
    };
  }, [hostId, startDir]);

  if (error) {
    return (
      <div className="text-destructive flex h-full items-center justify-center px-4 text-center font-mono text-xs">
        {error}
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center font-mono text-xs">
        Opening a shell…
      </div>
    );
  }

  return (
    <Terminal
      sessionId={sessionId}
      hostId={hostId}
      scheme={termScheme}
      onClosed={(err) => setError(err ?? 'The shell closed.')}
    />
  );
}
