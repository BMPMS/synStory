// Join helper for the "never remove elements" rule: each call finds or
// creates the elements of one kind inside `parent` and binds `data` to them
// by index. Extra elements are hidden (display: none), never removed, and
// shown again if the data grows back. So drawing is idempotent — run it
// again with new data and the same DOM nodes just get new attributes.
//
//   layer(svg, 'rect', 'cellBg', rows)        // data array
//   layer(groups, 'tspan', 'piece', (d) => d.pieces)   // per-parent data
export function layer(parent, tag, cls, data) {
  return parent
    .selectAll(`${tag}.${cls}`)
    .data(data)
    .join(
      (enter) => enter.append(tag).attr('class', cls),
      (update) => update.style('display', null),
      (exit) => exit.style('display', 'none')
    );
}

// Exactly one element of this kind inside each parent element. It inherits
// the parent's datum, the way append() would.
export function one(parent, tag, cls) {
  return layer(parent, tag, cls, (d) => [d]);
}
