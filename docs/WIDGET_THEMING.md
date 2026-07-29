# Widget theming — design sketch

Status: proposed, not yet implemented.

## Options considered

1. **Config object via data-attributes / init call** — tenant config row
   stores a small JSON blob (colors, logo, font, position, welcome message).
   Widget fetches it once by tenant key and applies via CSS custom
   properties. Simple, no build step, easy to edit from the admin dashboard.
2. **CSS custom properties + fixed slots** (chosen) — a small, bounded set
   of themeable variables (colors, radius, font) and named slots (header,
   launcher, bubbles). Tenants restyle, not restructure. Keeps the widget
   small and predictable.
3. **Full custom CSS override string** — tenant admins paste raw CSS,
   scoped via Shadow DOM. More power, bigger support/QA surface, risks the
   <10KB widget budget and breakage from bad overrides.
4. **Theme presets + limited overrides** — a few built-in presets
   (light/dark/university-blue) plus 3-4 override fields. Fastest to build,
   least flexible.

Chosen: **option 2**, CSS variables + fixed slots, driven by the per-tenant
`theme` column that already exists (`tenants.theme jsonb`, currently
unused — see `api/src/db/schema.sql`). Shadow DOM encapsulation so tenant
page CSS can't bleed in either direction.

## 1. Theme shape (stored in `tenants.theme`)

```ts
interface WidgetTheme {
  primaryColor?: string;      // launcher, header, user bubble bg — default #1a56db
  textOnPrimary?: string;     // default #fff
  botBubbleColor?: string;    // default #f1f3f5
  fontFamily?: string;        // default "system-ui, sans-serif"
  logoUrl?: string;           // shown in header next to title, optional
  title?: string;             // header text, default "Ask us anything"
  position?: "bottom-right" | "bottom-left"; // default bottom-right
}
```

No arbitrary CSS, no layout control — just enough for brand match.

## 2. Delivering the theme: embed snippet, not a fetch

Theme is admin-authored and rarely changes, so fetching it from
`/widget-config` on every page load means either a flash of default
colors (config resolves after first paint) or blocking render on a
network round trip. Neither is necessary — the admin dashboard already
generates the tenant's `<script>` embed snippet
(`data-tenant-key`, `data-api-url`); it can bake the theme in too:

```html
<script src=".../widget.js"
  data-tenant-key="abc123"
  data-api-url="https://api.example.edu"
  data-theme='{"primaryColor":"#0a3d62","logoUrl":"https://...","title":"Ask BITS Bot"}'>
</script>
```

The widget reads `data-theme` synchronously before first paint — zero
network round trip, zero flash. `/widget-config` keeps returning the
fields that must stay live (`chatHistoryLimit`, `chatHistoryExpiryHours`)
but drops `theme`.

Tradeoff: if an admin changes the theme later, already-pasted snippets go
stale until re-copied. Acceptable for a rare, cosmetic change — the admin
dashboard should just say "re-copy the snippet to apply" after a theme
save, same as any embed-snippet-based config.

## 3. Widget: apply via CSS custom properties + Shadow DOM

Two changes to `widget/src/widget.js`:

**a. Wrap `root` in a shadow root** so the host page's CSS can never bleed
in (and the widget's `<style>` block can't leak out either):

```js
const root = document.createElement("div");
document.body.appendChild(root);
const shadow = root.attachShadow({ mode: "open" });

const theme = (() => {
  try {
    return JSON.parse(scriptTag.getAttribute("data-theme") || "{}");
  } catch {
    return {}; // malformed snippet edit — fall back to defaults, don't break the widget
  }
})();
```

**b. Replace inline hex colors with a `<style>` block using `var(--uc-*)`,
set once config resolves:**

```js
shadow.innerHTML = `
  <style>
    :host { all: initial; }
    #uc-toggle { background: var(--uc-primary, #1a56db); ... }
    #uc-panel-header { background: var(--uc-primary, #1a56db); ... }
    #uc-bubble-user { background: var(--uc-primary, #1a56db); color: var(--uc-on-primary, #fff); }
    #uc-bubble-bot { background: var(--uc-bot-bubble, #f1f3f5); }
    #uc-panel { font-family: var(--uc-font, system-ui, sans-serif); }
  </style>
  <button id="uc-toggle">💬</button>
  ...
`;
```

Apply `theme` to the host element's inline style immediately, before the
config fetch even starts (custom properties inherit through the shadow
boundary from the host):

```js
if (theme.primaryColor) root.style.setProperty("--uc-primary", theme.primaryColor);
if (theme.textOnPrimary) root.style.setProperty("--uc-on-primary", theme.textOnPrimary);
if (theme.botBubbleColor) root.style.setProperty("--uc-bot-bubble", theme.botBubbleColor);
if (theme.fontFamily) root.style.setProperty("--uc-font", theme.fontFamily);
if (theme.title) shadow.querySelector("#uc-title").textContent = theme.title;
if (theme.logoUrl) { /* insert <img> before title */ }
if (theme.position === "bottom-left") root.classList.add("uc-left");
```

This runs synchronously in the IIFE, before `shadow.innerHTML` is even
appended to the document — so the very first paint already has the
tenant's colors. No flash, no fetch dependency.

## 4. Admin dashboard

`theme` is just jsonb (stored in `tenants.theme` so the admin UI has
somewhere to persist it and regenerate the snippet from), so a simple form
(color pickers for `primaryColor`/`botBubbleColor`, text inputs for
`title`/`logoUrl`/`fontFamily`) writing to `PATCH /tenants/:id` is enough.
The snippet-generation view reads that same row to render the
`data-theme` attribute — no new table, no migration beyond what's already
there.

## Why this fits

Reuses the `theme` column already provisioned in the schema, adds no new
endpoint, and keeps `/widget-config` for only the fields that need to stay
live post-embed. Theming is synchronous and flash-free at the cost of
requiring a snippet re-copy when an admin changes it — the right tradeoff
for data that changes rarely and matters visually on every load.
