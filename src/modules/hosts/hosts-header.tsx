import { FolderPlus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HostsHeaderProps {
  hostCount: number
  groupCount: number
  sessionCount: number
  onNewGroup: () => void
  onNewHost: () => void
  showActions: boolean
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function HostsHeader({
  hostCount,
  groupCount,
  sessionCount,
  onNewGroup,
  onNewHost,
  showActions,
}: HostsHeaderProps) {
  const summary = [
    plural(sessionCount, 'active session'),
    plural(hostCount, 'saved host'),
    plural(groupCount, 'group'),
  ].join(' · ')

  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{summary}</p>
      </div>

      {showActions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onNewGroup}>
            <FolderPlus />
            New group
          </Button>
          <Button onClick={onNewHost}>
            <Plus />
            New host
          </Button>
        </div>
      )}
    </header>
  )
}
