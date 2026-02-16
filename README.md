# Slipbox

Slipbox is a tiny, local-first writing space.

Why use it:
- Your notes are plain `.md` files you own
- No database to manage or migrate
- Fast, minimal interface with almost no moving parts
- Easy to back up with normal file tools or git

## Getting Started

```bash
cd slipbox
node server.js
```

Open <http://localhost:8001>

Default login:
- username: `admin`
- password: `admin`

To set your own credentials, create one of these files in the project root:
- `users.ini`
- `users.txt`

Format:

```ini
admin=yourpassword
joel=anotherpassword
```

## Notes Storage

Documents are saved as markdown files in:

- `data/*.md`

Filename comes from the first line/title. Example:

- `# Test Document` → `data/test-document.md`

## Plugins (minimal)

A plugin is just a JavaScript file in `plugins/`.

- Files are auto-loaded in the editor
- There is no plugin registration
- Plugins can call `slipbox.addMenu(label, handler)`
- Example included: `plugins/download.js`
