import { useAtomValue, useSetAtom } from 'jotai';
import { Minus, Plus } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MOD_KEY } from '@/lib/platform';
import { cn } from '@/lib/utils';
import { sessionsAtom } from '../../store/app';
import {
  bumpFontSizeAtom,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  resetFontSizeAtom,
  settingsAtom,
} from '../../store/settings';

const STEP_BUTTON =
  'flex size-7 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-35';

export default function TerminalZoom() {
  const { fontSize } = useAtomValue(settingsAtom);
  const sessions = useAtomValue(sessionsAtom);
  const bump = useSetAtom(bumpFontSizeAtom);
  const reset = useSetAtom(resetFontSizeAtom);

  if (sessions.length === 0) return null;

  return (
    <>
      <Separator className="mt-auto w-7" />
      <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Zoom in"
                disabled={fontSize >= FONT_SIZE_MAX}
                onClick={() => bump(1)}
                className={STEP_BUTTON}
              />
            }
          >
            <Plus className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            Zoom in — {MOD_KEY} + or {MOD_KEY} + scroll
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`Terminal text size ${fontSize}px, reset to default`}
                onClick={() => reset()}
                className={cn(
                  STEP_BUTTON,
                  'h-5 w-9 font-mono text-3xs tabular-nums',
                )}
              />
            }
          >
            {fontSize}
          </TooltipTrigger>
          <TooltipContent side="right">
            Terminal text size — reset with {MOD_KEY} 0
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Zoom out"
                disabled={fontSize <= FONT_SIZE_MIN}
                onClick={() => bump(-1)}
                className={STEP_BUTTON}
              />
            }
          >
            <Minus className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            Zoom out — {MOD_KEY} − or {MOD_KEY} + scroll
          </TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
