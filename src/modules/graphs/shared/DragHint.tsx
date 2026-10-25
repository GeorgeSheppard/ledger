/** What every time graph says above itself, so it is clear dragging picks the dates. */
export function DragHint({ shaded = false }: { shaded?: boolean }) {
  return (
    <p className="mb-2 text-xs text-muted">
      {shaded ? 'The shaded part is the dates shown. ' : ''}Drag across the graph to pick other
      dates.
    </p>
  );
}
