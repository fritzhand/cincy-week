/* site/js/features/map.js · OWNER: Agent E · STUB landed by Agent A.
   main.js imports this module when <body data-features> lists "map" and calls init(app).
   app = { root, now(), store, plan, modal, toast, data(name), onTick(fn), status } (see site/js/main.js).

   It also exports the mount API other features import directly (engine spec §4.10), so Agent D's
   schedule List/Map view can code against it before the real map lands:
     mountMap(el, { pins, layers, focus, fit, onSelect, list }) → { update(pins), select(id), highlight(id), fit(), destroy() }
       pins: [{ id, kind: "venue"|"work"|"stay"|"stop"|"food", lat, lng, prog, prog2?, n?, label, live? }]
   Until Agent E lands it, mountMap renders nothing and returns no-op methods (the list stays the path
   to every item, so nothing is lost). */
export function init() {}

export function mountMap(el, opts = {}) {
  const noop = () => {};
  return { el, opts, update: noop, select: noop, highlight: noop, fit: noop, destroy: noop };
}
