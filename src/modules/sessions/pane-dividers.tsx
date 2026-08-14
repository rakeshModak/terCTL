import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { paneDividers, type DividerInfo, type Pane } from '../../lib/layout';

interface PaneDividersProps {
  layout: Pane | null;
  onDragStart: (divider: DividerInfo) => (e: ReactMouseEvent) => void;
}

// A wide invisible grab area with a thin line revealed on hover, so the hit
// target is forgiving without the seam being visually heavy.
const ROW_LINE =
  "after:absolute after:top-[8%] after:left-1/2 after:h-[84%] after:w-0.5 after:-translate-x-1/2 after:bg-transparent after:transition-colors after:content-[''] hover:after:bg-primary";
const COL_LINE =
  "after:absolute after:top-1/2 after:left-[8%] after:h-0.5 after:w-[84%] after:-translate-y-1/2 after:bg-transparent after:transition-colors after:content-[''] hover:after:bg-primary";

export default function PaneDividers({
  layout,
  onDragStart,
}: PaneDividersProps) {
  return (
    <>
      {paneDividers(layout).map((d) => {
        const boundary =
          d.dir === 'row'
            ? d.parent.left + d.parent.width * d.ratio
            : d.parent.top + d.parent.height * d.ratio;

        const style: CSSProperties =
          d.dir === 'row'
            ? {
                left: `${boundary}%`,
                top: `${d.parent.top}%`,
                height: `${d.parent.height}%`,
                width: 10,
                transform: 'translateX(-50%)',
                cursor: 'col-resize',
              }
            : {
                left: `${d.parent.left}%`,
                top: `${boundary}%`,
                width: `${d.parent.width}%`,
                height: 10,
                transform: 'translateY(-50%)',
                cursor: 'row-resize',
              };

        return (
          <div
            key={d.path.join('-') || 'root'}
            className={d.dir === 'row' ? ROW_LINE : COL_LINE}
            style={{ position: 'absolute', zIndex: 20, ...style }}
            onMouseDown={onDragStart(d)}
          />
        );
      })}
    </>
  );
}
