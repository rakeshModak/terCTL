import { KeyRound, Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
  onConnect: () => void
  onEdit: () => void
  onDelete: () => void
}

export function HostCard({ host, onConnect, onEdit, onDelete }: HostCardProps) {
  const AuthIcon = host.authKind === 'key' ? KeyRound : Lock

  return (
    <Card
      size="sm"
      className="group/host-card relative gap-3 px-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full bg-chart-4" aria-hidden="true" />
        <button
          type="button"
          onClick={onConnect}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {host.label}
          <span className="sr-only">, connect</span>
        </button>

        <div className="relative z-10 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 focus-visible:opacity-100 group-hover/host-card:opacity-100 aria-expanded:opacity-100"
                />
              }
            >
              <MoreHorizontal />
              <span className="sr-only">Host actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={"w-44"}>
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

      <p className="truncate font-mono text-xs text-muted-foreground">
        {host.username}@{host.hostname}
      </p>

      {host.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {host.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <Separator />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AuthIcon className="size-3 shrink-0" />
          <span>{host.authKind === 'key' ? 'Key' : 'Password'}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">:{host.port}</span>
        </div>
      </div>
    </Card>
  )
}
