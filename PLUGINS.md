# Slipbox Plugins

Slipbox plugins are plain JavaScript files in the `plugins/` directory.

- No registration system
- No manifest
- No special build step
- Files are auto-loaded on editor pages

If a plugin wants to add UI, it can call the global `slipbox` API.

## Plugin File Rules

- Put `.js` files in `plugins/`
- Keep them browser-safe (no Node-only APIs)
- Plugins run in page context, in filename order

## Minimal Example

```js
(function () {
  if (!window.slipbox || typeof window.slipbox.addMenu !== 'function') return;

  slipbox.addMenu('Download', function () {
    const doc = slipbox.getCurrentDoc();
    slipbox.download(doc.filename, doc.text);
  });
})();
```

## API

### `slipbox.addMenu(label, handler)`
Adds a menu item to the Plugins menu.

- `label` (string): text shown in the menu
- `handler` (function): called when user clicks item

### `slipbox.getCurrentDoc()`
Returns the active editor document:

```js
{ filename: 'my-doc.md', text: '# My Doc\n...' }
```

### `slipbox.download(filename, text)`
Triggers browser download with provided content.

### `slipbox.toast(message)`
Shows a simple message (`alert` right now).

### `slipbox.showMenu()` / `slipbox.hideMenu()`
Programmatically show/hide the Plugins menu.

## Included Example Plugin

- `plugins/download.js`

Adds a **Download** action to the Plugins menu.

## Notes

- Plugins are trusted local scripts.
- Keep plugin code small and readable.
- For network/API features, plugin authors can call `fetch()` directly.
- If a plugin needs secrets, pair it with a separate local web service instead of hardcoding secrets in JS.
