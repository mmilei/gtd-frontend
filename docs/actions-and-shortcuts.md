# Actions and Keyboard Shortcuts

Reference for every interactive action the app exposes, grouped by area. Keyboard
shortcuts are noted inline; everything else is mouse/touch-only.

## Global

- `Cmd/Ctrl+K` — toggle the Search overlay from anywhere.
- `c` (no modifier, only when focus isn't already inside a field) — focus the capture bar.
- `Escape` — close the active modal or overlay. Focus is trapped inside an open dialog
  (Tab cycles through it) and restored to the previously focused element on close.

## Capture bar

- Type and press `Enter` to send; `Shift+Enter` inserts a newline instead.
- Mic button starts/stops voice dictation (Whisper transcription via the backend); a
  language selector (ES/EN/PT) controls speech recognition locale.
- A low-confidence classification (`confirmed: false`) opens the item editor directly so
  the capture can be reviewed before it's treated as final.

## Header

- **New** — opens the editor in "new task" mode: blank fields, bucket picker, "Save as new"
  writes directly without going through the classifier.
- **Search** (or `Cmd/Ctrl+K`) — full-text search across every bucket by title, notes, tag,
  or project.
- **Triage** — walks the backlog one item at a time. In-overlay shortcuts: `1` today,
  `2` skip, `3` someday, `4` dismiss.
- **Review** — read-only weekly summary: tasks stale 3+ days in Today, due this week, and
  completed this week.
- **History** — durable, cross-session log of every create/move/done/dismiss/undo.
- **Unconfirmed** (visible only when the queue is non-empty, with a count badge) — review
  queue for low-confidence captures. In-overlay shortcuts: `1` confirm, `2` edit,
  `3` dismiss.
- **Provider menu** (API status chip) — click to open a panel and switch the LLM provider
  independently for each pipeline step (Triage, Enrichment, Resolver).

## Navigation

Every route is backed by the browser's History API — no client-side router. Opening an
item or a facet from inside the app pushes a `modal: true` state, so it renders as a modal
stacked on whatever is currently showing; the same URL entered directly (a fresh load, a
pasted link, or a page reload) renders as a standalone page instead. Nested opens stack:
each modal opens on top of the current one, and closing (`Escape`, the close button, or
browser back) unwinds exactly one level, revealing whatever was underneath — another modal
or the page/list. A production build additionally serves `index.html` for any unmatched
deep link (`404.html` mirrors it) so a direct link to a bucket item works on GitHub Pages.

## Item card

- Click anywhere on the card to open the full editor.
- Checkmark button — marks the task done.
- Play button (Today only) — starts a focus session on this task.
- X button — dismisses the task.
- "Show more" / "Show less" — expands or collapses a body preview past two lines.
- Project or location chip — opens a cross-bucket view filtered to that value.

## Focus mode

Single-task view with a countdown (when the task has a time estimate) or a stopwatch
(when it doesn't).

- `Enter` — mark the current task done and advance to the next.
- `S` — skip to the next task without completing this one.
- `+` / `=` — extend the current estimate by 5 minutes.
- `Escape` — exit focus mode.

## Tags and facets

- Click a tag — filters the current bucket to that tag alone.
- `Shift+click` a tag — adds it to the filter (AND across all selected tags).
- Layers icon next to a tag — opens a cross-bucket view for that tag.
- Project entries in the side rail, and area entries in the area bar, each open the
  equivalent cross-bucket view.

## Item editor (modal or standalone page)

- Bucket picker — chips for each bucket at the top of the form.
- Body editor (CodeMirror): `@` autocompletes a known person as a `[[Name]]` link, or
  offers to create a new person page when nothing matches; `#` autocompletes a tag;
  `[[` autocompletes any vault page. Checklist lines (`- [ ]`) render as clickable
  checkboxes. `Cmd/Ctrl+Enter` saves.
- Project / Location — free text with suggestions drawn from existing values.
- Area — a select populated from the backend's configured vocabulary.
- Priority — a row of toggle buttons.
- Due date, time estimate.
- Tags — `Enter` or `,` commits the current pill; `Tab` commits without losing focus so
  more tags can be added in sequence; `Backspace` on an empty draft removes the last pill;
  `Escape` clears an in-progress draft (a second `Escape`, with nothing left to clear,
  closes the modal).
- Depends on — add or remove blocking tasks from a picker. Marking the task done while a
  dependency is still open shows a confirmation listing what's still blocking, with an
  explicit "close anyway" — dependencies warn, never prevent.
- Improve — sends the body to the backend's markdown/tag enrichment pass.
- Done / Discard buttons, and Save (or "Save as new" in new-task mode). Closing with
  unsaved changes asks for confirmation before discarding them.

## Linked pages

Task, person, and note links rendered inside a card are real anchors: Ctrl/Cmd-click or
middle-click opens a new tab, and a plain click is intercepted only for links the app can
route to in-app (tasks and people); note links always defer to the browser, which opens
the vault's own link handler.
