/* ============================================================
   build/pages/_stub.mjs · OWNER: Agent A (core engine)
   Helpers for stub pages. Files starting with "_" are not page modules.
   A stub renders the page head and an honest placeholder, plus whatever
   the data already holds, so links, search and the crawler work from day
   one. Domain agents replace their stub module wholesale.
   ============================================================ */

/** A top-level stub page. body: (root) => extra HTML after the placeholder. */
export function stubPage(ctx, { slug, title, kicker, num, lede, description, what, owner, body = () => "", features = [], toc, head, modals }) {
  const { c } = ctx;
  return {
    path: `${slug}.html`, nav: slug, title, description: description || lede, features, toc, head, modals,
    body: (root) => `${c.pageHead({ kicker, num, title, lede })}
${c.placeholder(what, owner)}
${body(root)}`,
  };
}
