import {
  ArrowRight,
  CornerDownRight,
  KeyRound,
  Lock,
  MoreHorizontal,
  Pencil,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import type { HostType } from '@/types/host';
import { osInfo } from './os-icon';

interface HostCardProps {
  host: HostType;
  connected: boolean;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
  jumpLabel?: string | null;
  /** Tighter card for the Starred shortcut row: same information hierarchy,
      less of the detail that the main grid has room for. */
  compact?: boolean;
}

export default function HostCard({
  host,
  connected,
  onConnect,
  onEdit,
  onDelete,
  onToggleStar,
  jumpLabel,
  compact = false,
}: HostCardProps) {
  const AuthIcon = host.authKind === 'key' ? KeyRound : Lock;
  const initial = (host.label.trim()[0] ?? '?').toUpperCase();
  const authLabel = host.authKind === 'key' ? 'Key' : 'Password';
  const os = osInfo(host.os);

  const action = (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1 font-medium transition-colors',
        connected
          ? 'text-primary'
          : 'text-muted-foreground group-hover/host-card:text-foreground',
      )}
    >
      {connected ? 'Open' : 'Connect'}
      <ArrowRight className="size-3 transition-transform group-hover/host-card:translate-x-0.5" />
    </span>
  );

  return (
    <Card
      size="sm"
      className={cn(
        'group/host-card hover:bg-accent/50 relative transition-colors',
        compact ? 'gap-1.5 px-3 py-2.5' : 'gap-2.5 px-3.5 py-3',
        connected && 'ring-primary/35',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between',
          compact ? 'gap-2' : 'gap-3',
        )}
      >
        <span
          aria-hidden="true"
          title={os?.label}
          className={cn(
            'font-heading flex shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
            compact ? 'size-6 rounded-md' : 'size-8',
            connected
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {os ? (
            <os.Icon className={compact ? 'size-3.5' : 'size-4'} />
          ) : (
            initial
          )}
        </span>

        <div className="relative z-10 -mr-1 flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              'size-2 rounded-full',
              connected
                ? 'bg-primary ring-3 ring-(--brand-ring)'
                : 'bg-muted-foreground/40',
            )}
            aria-hidden="true"
          />

          {/* Sits above the label button's ::after overlay, which otherwise
              covers the whole card to make it one big connect target. */}
          <Button
            variant="ghost"
            size="icon-xs"
            title={host.starred ? 'Remove from starred' : 'Add to starred'}
            aria-pressed={host.starred}
            onClick={onToggleStar}
            className={cn(
              'relative z-10 transition-opacity',
              host.starred
                ? 'text-chart-5 opacity-100'
                : 'opacity-0 group-hover/host-card:opacity-100 focus-visible:opacity-100',
            )}
          >
            <Star className={cn(host.starred && 'fill-current')} />
            <span className="sr-only">
              {host.starred ? 'Remove from starred' : 'Add to starred'}
            </span>
          </Button>

          {/* Edit and delete stay on the full card in the main grid; the
              starred row is a shortcut and keeps only connect and unstar. */}
          {!compact && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 transition-opacity group-hover/host-card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                  />
                }
              >
                <MoreHorizontal />
                <span className="sr-only">Host actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onToggleStar}>
                  {host.starred ? <StarOff /> : <Star />}
                  {host.starred ? 'Remove from starred' : 'Add to starred'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil />
                  Edit server
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 />
                  Delete server
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <button
          type="button"
          onClick={onConnect}
          className={cn(
            "font-heading block w-full truncate text-left font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none",
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {host.label}
          <span className="sr-only">
            {os ? `, ${os.label}` : ''},{' '}
            {connected ? 'open session' : 'connect'}
          </span>
        </button>
        <div
          className={cn(
            'mt-0.5 flex min-w-0 items-center',
            compact ? 'gap-2 text-xs' : '',
          )}
        >
          <p className="text-muted-foreground text-2xs min-w-0 flex-1 truncate font-mono">
            {host.username}@{host.hostname}:{host.port}
          </p>
          {/* Compact drops the separator and the auth row, so the connect
              affordance moves up beside the address. */}
          {compact && action}
        </div>
        {jumpLabel && !compact && (
          <p className="text-muted-foreground text-2xs mt-0.5 flex items-center gap-1 truncate font-mono">
            <CornerDownRight className="size-2.5 shrink-0" />
            <span className="truncate">via {jumpLabel}</span>
          </p>
        )}
      </div>

      {host.tags.length > 0 && !compact && (
        <div className="flex flex-wrap gap-1">
          {host.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {!compact && (
        <div className="mt-auto flex flex-col gap-1.5">
          <Separator />
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5">
              <AuthIcon className="size-3 shrink-0" />
              <span className="truncate">
                {connected ? 'Connected' : authLabel}
              </span>
            </span>

            {action}
          </div>
        </div>
      )}
    </Card>
  );
}
