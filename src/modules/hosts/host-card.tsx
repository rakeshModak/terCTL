import {
  ArrowRight,
  KeyRound,
  Lock,
  MoreHorizontal,
  Pencil,
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
}

export default function HostCard({
  host,
  connected,
  onConnect,
  onEdit,
  onDelete,
}: HostCardProps) {
  const AuthIcon = host.authKind === 'key' ? KeyRound : Lock;
  const initial = (host.label.trim()[0] ?? '?').toUpperCase();
  const authLabel = host.authKind === 'key' ? 'Key' : 'Password';
  const os = osInfo(host.os);

  return (
    <Card
      size="sm"
      className={cn(
        'group/host-card hover:bg-accent/50 relative gap-2.5 px-3.5 py-3 transition-colors',
        connected && 'ring-primary/35',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          aria-hidden="true"
          title={os?.label}
          className={cn(
            'font-heading flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
            connected
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {os ? <os.Icon className="size-4" /> : initial}
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
        </div>
      </div>

      <div className="min-w-0">
        <button
          type="button"
          onClick={onConnect}
          className="font-heading block w-full truncate text-left text-sm font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {host.label}
          <span className="sr-only">
            {os ? `, ${os.label}` : ''},{' '}
            {connected ? 'open session' : 'connect'}
          </span>
        </button>
        <p className="text-muted-foreground mt-0.5 truncate font-mono text-2xs">
          {host.username}@{host.hostname}:{host.port}
        </p>
      </div>

      {host.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {host.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-1.5">
        <Separator />
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5">
            <AuthIcon className="size-3 shrink-0" />
            <span className="truncate">
              {connected ? 'Connected' : authLabel}
            </span>
          </span>

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
        </div>
      </div>
    </Card>
  );
}
