import { useCallback, useEffect, useState } from 'react';
import { Braces, CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { serverForLanguage } from '@/constants/language-servers';
import { cn } from '@/lib/utils';
import { langServerService } from '@/services/langserver.service';
import type { HostServersType } from '@/types/langserver';
import LanguageServerDialog from './language-server-dialog';

interface LanguageServerButtonProps {
  hostId: string;
  hostLabel: string;
  /** Language of the file being edited, or null when no file is open. */
  language: string | null;
}

export default function LanguageServerButton({
  hostId,
  hostLabel,
  language,
}: LanguageServerButtonProps) {
  const [data, setData] = useState<HostServersType | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    langServerService
      .list(hostId)
      .then(setData)
      .catch(() => setData(null));
  }, [hostId]);

  useEffect(load, [load]);

  const currentId = serverForLanguage(language);
  const current = data?.servers.find((s) => s.id === currentId) ?? null;
  const installedCount = data?.servers.filter((s) => s.installed).length ?? 0;
  const active = installedCount > 0;

  const tip = current?.installed
    ? `${current.label} language server is already installed on ${hostLabel}.`
    : installedCount > 0
      ? `${installedCount} language server${installedCount > 1 ? 's' : ''} installed on ${hostLabel} — click to add or remove.`
      : current
        ? `No ${current.label} language server on ${hostLabel} — click to install it.`
        : `No language servers on ${hostLabel}. Editing works without them.`;

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              className={cn(
                'shrink-0',
                active && 'text-primary border-primary/40',
              )}
            />
          }
        >
          {current?.installed ? <CircleCheck /> : <Braces />}
          {/* The toolbar is a single fixed-height row; below this the label
              gives way so the buttons never squash into each other. */}
          <span className="hidden lg:inline">Language servers</span>
          {active && (
            <span className="bg-primary/15 text-primary rounded px-1 font-mono text-[10px] tabular-nums">
              {installedCount}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{tip}</TooltipContent>
      </Tooltip>

      <LanguageServerDialog
        open={open}
        onOpenChange={setOpen}
        hostId={hostId}
        hostLabel={hostLabel}
        highlightId={currentId}
        onChanged={load}
      />
    </>
  );
}
