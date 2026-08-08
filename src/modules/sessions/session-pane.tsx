import type { CSSProperties } from 'react'
import { GripVertical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Edge, Rect } from '../../lib/layout'
import type { SessionType } from '../../store/app'
import PaneDropZones from './pane-drop-zones'
import { Terminal } from '@/components/Terminal'

interface SessionPaneProps {
  session: SessionType
  /** Percentage rect within the split tree; undefined = not in the active tab. */
  rect: Rect | undefined
  active: boolean
  /** True when the active tab holds more than one pane. */
  isSplit: boolean
  resizing: boolean
  showZones: boolean
  dragging: boolean
  termScheme: string | undefined
  onActivate: () => void
  onClose: () => void
  onClosed: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onSplit: (edge: Edge) => void
}

export default function SessionPane({
  session,
  rect,
  active,
  isSplit,
  resizing,
  showZones,
  dragging,
  termScheme,
  onActivate,
  onClose,
  onClosed,
  onDragStart,
  onDragEnd,
  onSplit,
}: SessionPaneProps) {
  const position: CSSProperties = rect
    ? {
        left: `${rect.left}%`,
        top: `${rect.top}%`,
        right: `${100 - rect.left - rect.width}%`,
        bottom: `${100 - rect.top - rect.height}%`,
      }
    : { display: 'none' }

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        ...position,
        transition: resizing ? 'none' : 'inset 0.18s cubic-bezier(0.22,1,0.36,1)',
      }}
      onMouseDown={() => !active && onActivate()}
    >
      {/* Uniform structure (box -> bar + term) for every pane so the Terminal
          never changes tree position — the bar is merely hidden when the pane
          isn't part of a split. No remount means no lost scrollback when
          splitting or unsplitting. */}
      <div
        className={cn(
          'absolute flex flex-col overflow-hidden transition-all duration-150',
          isSplit ? 'inset-[3px] rounded-lg border' : 'inset-0',
          isSplit && active && 'border-primary/55 shadow-[0_0_16px_-4px_var(--brand-soft-2)]',
          isSplit && !active && 'border-border',
        )}
        style={isSplit ? { background: 'var(--term-bg, var(--background))' } : undefined}
      >
        <div
          className={cn(
            'h-6.5 shrink-0 cursor-grab items-center gap-1.5 pr-1.5 pl-2.5 font-mono text-[11px] select-none active:cursor-grabbing',
            active ? 'text-foreground' : 'text-muted-foreground',
            dragging && 'opacity-50',
          )}
          style={{
            display: isSplit ? 'flex' : 'none',
            background: 'var(--term-bg, var(--background))',
          }}
          draggable
          title="Drag to reposition in this Deck"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', session.id)
            onDragStart()
          }}
          onDragEnd={onDragEnd}
        >
          <GripVertical className="size-3 shrink-0 text-muted-foreground" />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{session.label}</span>
          <span className="flex-1" />
          <Button
            variant="ghost"
            size="icon-xs"
            title="Close this pane"
            className="hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
          >
            <X />
          </Button>
        </div>

        <div
          className={cn(
            'relative min-h-0 flex-1',
            isSplit && !active && 'opacity-82',
            resizing && 'pointer-events-none',
          )}
        >
          <Terminal sessionId={session.id} scheme={termScheme} onClosed={onClosed} />
        </div>
      </div>

      {showZones && <PaneDropZones onSplit={onSplit} />}
    </div>
  )
}
