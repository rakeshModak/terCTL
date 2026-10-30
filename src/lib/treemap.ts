export interface TreemapItem {
  id: string;
  value: number;
}

export interface TreemapTile {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Worst aspect ratio in a strip of `areas` laid along a side of `side` px.
    Squarify only adds an item to the strip while this doesn't get worse. */
function worst(areas: number[], side: number): number {
  const sum = areas.reduce((a, b) => a + b, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  const s2 = side * side;
  return Math.max((s2 * max) / (sum * sum), (sum * sum) / (s2 * min));
}

/**
 * Squarified treemap (Bruls, Huizing, van Wijk). Tiles keep area proportional
 * to value but stay close to square, which is what makes a folder's size
 * readable at a glance; plain slice-and-dice gives long slivers instead.
 *
 * Items are laid out biggest first, so callers get the largest tile in the
 * top-left. Zero and negative values are dropped rather than given a tile.
 */
export function squarify(
  items: TreemapItem[],
  width: number,
  height: number,
): TreemapTile[] {
  const sized = items
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = sized.reduce((a, i) => a + i.value, 0);
  if (!sized.length || total <= 0 || width <= 0 || height <= 0) return [];

  const scale = (width * height) / total;
  const tiles: TreemapTile[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;

  // `last` makes the final strip take exactly what's left. Each strip's size
  // comes from dividing by the remaining side, and once that side has been
  // whittled down to float noise the quotient can overshoot the box, so the
  // non-final strips are clamped for the same reason. Tiles then split the
  // strip's length by share, so they always end exactly at its far edge.
  const place = (row: TreemapItem[], last: boolean) => {
    const areas = row.map((i) => i.value * scale);
    const sum = areas.reduce((a, b) => a + b, 0);
    if (w >= h) {
      // Column down the left edge of what's left.
      const colW = last ? w : Math.min(sum / h, w);
      let cy = y;
      row.forEach((item, k) => {
        const th = (areas[k] / sum) * h;
        tiles.push({ id: item.id, x, y: cy, w: colW, h: th });
        cy += th;
      });
      x += colW;
      w -= colW;
    } else {
      // Row along the top edge of what's left.
      const rowH = last ? h : Math.min(sum / w, h);
      let cx = x;
      row.forEach((item, k) => {
        const tw = (areas[k] / sum) * w;
        tiles.push({ id: item.id, x: cx, y, w: tw, h: rowH });
        cx += tw;
      });
      y += rowH;
      h -= rowH;
    }
  };

  let row: TreemapItem[] = [];
  for (const item of sized) {
    const side = Math.min(w, h);
    const areas = row.map((i) => i.value * scale);
    const next = [...areas, item.value * scale];
    if (!row.length || worst(next, side) <= worst(areas, side)) {
      row.push(item);
    } else {
      place(row, false);
      row = [item];
    }
  }
  if (row.length) place(row, true);
  return tiles;
}
