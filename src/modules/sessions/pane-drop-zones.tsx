import { useState, type CSSProperties } from 'react'
import type { Edge } from '../../lib/layout'

// The highlight previews the *half* the new pane will occupy, and glides
// between edges (VSCode-style) rather than snapping.
const PREVIEW: Record<Edge, CSSProperties> = {
  left: { left: 0, top: 0, bottom: 0, right: '50%' },
  right: { left: '50%', top: 0, bottom: 0, right: 0 },
  top: { left: 0, right: 0, top: 0, bottom: '50%' },
  bottom: { left: 0, right: 0, top: '50%', bottom: 0 },
}

// Narrow edge bands are the actual drop targets; the middle stays free so a
// drag across a pane does not constantly retarget.
const ZONES: Record<Edge, CSSProperties> = {
  left: { left: 0, top: 0, width: '30%', height: '100%' },
  right: { right: 0, top: 0, width: '30%', height: '100%' },
  top: { left: '30%', top: 0, width: '40%', height: '50%' },
  bottom: { left: '30%', bottom: 0, width: '40%', height: '50%' },
}

const EDGES = Object.keys(ZONES) as Edge[]

/** Drop targets shown over a pane while a tab or pane is being dragged. */
export default function PaneDropZones({ onSplit }: { onSplit: (edge: Edge) => void }) {
  const [over, setOver] = useState<Edge | null>(null)

  return (
    <div
      className="absolute inset-1.5 z-50 overflow-hidden rounded-lg"
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
      }}
    >
      {over && (
        <div
          className="pointer-events-none animate-[previewIn_0.14s_ease_both] rounded-lg bg-primary/15"
          style={{
            position: 'absolute',
            ...PREVIEW[over],
            transition: 'inset 0.16s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      )}
      {EDGES.map((edge) => (
        <div
          key={edge}
          style={{ position: 'absolute', ...ZONES[edge] }}
          onDragOver={(e) => {
            e.preventDefault()
            if (over !== edge) setOver(edge)
          }}
          onDrop={(e) => {
            e.preventDefault()
            onSplit(edge)
            setOver(null)
          }}
        />
      ))}
    </div>
  )
}
