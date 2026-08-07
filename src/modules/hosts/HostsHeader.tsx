import { FolderPlus, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

interface HostsHeaderProps {
  hostCount: number
  groupCount: number
  query: string
  onQueryChange: (value: string) => void
  onNewGroup: () => void
  onNewHost: () => void;
  showActions: boolean
}

export function HostsHeader({
  hostCount,
  groupCount,
  query,
  onQueryChange,
  onNewGroup,
  onNewHost,
  showActions,
}: HostsHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Hosts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hostCount} saved connection{hostCount === 1 ? '' : 's'} across {groupCount} environment
          {groupCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex-1" />

      {showActions && (
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-64">
            <InputGroupAddon>
              <Search className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => onQueryChange(e.currentTarget.value)}
              placeholder="Search hosts, tags, IPs…"
              aria-label="Search hosts"
            />
          </InputGroup>

          <Button variant="outline" onClick={onNewGroup}>
            <FolderPlus />
            New Group
          </Button>

          <Button onClick={onNewHost}>
            <Plus />
            New Connection
          </Button>
        </div>
      )}
    </div>
  )
}
