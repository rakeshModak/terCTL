import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Terminal } from '@/components/Terminal';
import { sshService } from '@/services/ssh.service';
import { settingsAtom } from '@/store/settings';

export default function TerminalPanel({ hostId }: { hostId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { termScheme } = useAtomValue(settingsAtom);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    sshService
      .connect(hostId)
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
  }, [hostId]);

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
      scheme={termScheme}
      onClosed={(err) => setError(err ?? 'The shell closed.')}
    />
  );
}
