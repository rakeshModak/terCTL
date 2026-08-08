import { FolderPlus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useId } from 'react'

interface HostsEmptyStateProps {
  onNewHost: () => void
  onNewGroup: () => void
}

/** First-run state: no hosts and no groups exist yet. */
export default function HostsEmptyState({ onNewHost, onNewGroup }: HostsEmptyStateProps) {
    const glowId = useId()
  return (
    <Empty className="animate-[rise_0.4s_ease_both]">
      <EmptyHeader className="max-w-md">
        {/* Default (not "icon") variant: this is full artwork, not a glyph. */}
        <EmptyMedia className="animate-[bootFloaty_7s_ease-in-out_infinite]">
          <svg
            width="300"
            height="196"
            viewBox="0 0 300 196"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </radialGradient>
            </defs>

            <circle cx="150" cy="98" r="80" fill={`url(#${glowId})`} />

            {/* Links from the mark out to each server. */}
            <g
              className="stroke-input"
              strokeWidth="1.4"
              strokeDasharray="3 6"
              strokeLinecap="round"
            >
              <path d="M150 98 L64 52" />
              <path d="M150 98 L236 52" />
              <path d="M150 98 L150 168" />
            </g>

            <g transform="translate(40,34)">
              <rect width="48" height="36" rx="8" className="fill-card stroke-border" />
              <rect x="10" y="11" width="20" height="3" rx="1.5" className="fill-muted-foreground" />
              <rect x="10" y="19" width="14" height="3" rx="1.5" className="fill-muted-foreground/50" />
              <circle cx="38" cy="12.5" r="2.2" className="fill-chart-4" />
            </g>

            {/* Idle server. */}
            <g transform="translate(212,34)">
              <rect width="48" height="36" rx="8" className="fill-card stroke-border" />
              <rect x="10" y="11" width="20" height="3" rx="1.5" className="fill-muted-foreground" />
              <rect x="10" y="19" width="14" height="3" rx="1.5" className="fill-muted-foreground/50" />
              <circle cx="38" cy="12.5" r="2.2" className="fill-chart-5" />
            </g>

            <g transform="translate(126,150)">
              <rect
                width="48"
                height="36"
                rx="9"
                fill="none"
                className="stroke-primary/65"
                strokeWidth="1.6"
                strokeDasharray="5 4"
              />
              <path
                d="M24 11 v14 M17 18 h14"
                className="stroke-primary"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>

            <g transform="translate(124,72)">
              <rect width="52" height="52" rx="14" className="fill-muted stroke-border" />
              <g transform="translate(13,13)" className="fill-foreground">
                <rect x="0" y="0" width="26" height="5.7" />
                <rect x="0" y="20.3" width="26" height="5.7" />
                <rect x="0" y="5.7" width="4.1" height="4.5" />
                <rect x="0" y="15.8" width="4.1" height="4.5" />
                <rect x="21.9" y="5.7" width="4.1" height="4.5" />
                <rect x="21.9" y="15.8" width="4.1" height="4.5" />
              </g>
            </g>
          </svg>
        </EmptyMedia>
        <EmptyTitle>No connections yet</EmptyTitle>
        <EmptyDescription>
          Add your first server and it lands here — one click to open a secure terminal, anytime.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onNewHost}>
            <Plus />
            New Connection
          </Button>
          <Button variant="outline" onClick={onNewGroup}>
            <FolderPlus />
            New GroupType
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}
