import { ArrowRight, KeyRound, Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import type { Host } from '../../models'

interface HostCardProps {
  host: Host
  connected: boolean
  onConnect: () => void
  onEdit: () => void
  onDelete: () => void
}

export function HostCard({ host, connected, onConnect, onEdit, onDelete }: HostCardProps) {
  const AuthIcon = host.authKind === 'key' ? KeyRound : Lock
  const initial = (host.label.trim()[0] ?? '?').toUpperCase()
  const authLabel = host.authKind === 'key' ? 'Key' : 'Password'

  return (
    <Card
      size="sm"
      className={cn(
        'group/host-card relative gap-4 px-5 py-5 transition-colors hover:bg-accent/50',
        connected && 'ring-primary/35',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl font-heading text-sm font-semibold',
            connected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {initial}
        </span>

        <div className="relative z-10 -mr-1 flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              'size-2 rounded-full',
              connected ? 'bg-primary ring-3 ring-(--brand-ring)' : 'bg-muted-foreground/40',
            )}
            aria-hidden="true"
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/host-card:opacity-100 aria-expanded:opacity-100"
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
          className="block w-full truncate text-left font-heading text-[15px] font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {host.label}
          <span className="sr-only">, {connected ? 'open session' : 'connect'}</span>
        </button>
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
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

      <div className="mt-auto flex flex-col gap-3">
        <Separator />
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
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
  )
}
