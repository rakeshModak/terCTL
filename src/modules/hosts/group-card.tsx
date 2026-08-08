import { ChevronRight, Folder, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { GroupType } from '@/types/host'

interface GroupCardProps {
  group: GroupType
  hostCount: number
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}

export default function GroupCard({ group, hostCount, onOpen, onRename, onDelete }: GroupCardProps) {
  return (
    <Card
      size="sm"
      className="group/group-card relative flex-row items-center gap-3 px-5 py-4 transition-colors hover:bg-accent/50"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Folder className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="truncate text-left text-sm font-medium after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {group.name}
          <span className="sr-only">, open group</span>
        </button>
        <p className="truncate text-xs text-muted-foreground">
          {hostCount} host{hostCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className="relative z-10 flex shrink-0 items-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 focus-visible:opacity-100 group-hover/group-card:opacity-100 aria-expanded:opacity-100"
              />
            }
          >
            <MoreHorizontal />
            <span className="sr-only">Group actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRename}>
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              Delete group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </div>
    </Card>
  )
}
