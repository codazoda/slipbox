const typebox = document.getElementById('typebox');
const docInput = document.querySelector('input[name="doc"]');
const pageTitle = document.getElementById('page');

moveSelection(typebox);

function moveSelection(element) {
  if (!element) return;
  element.focus();
  element.setSelectionRange(element.value.length, element.value.length);
}

function warnSaveFailed(message) {
  const text = message || 'Save failed. Your latest edits may not be saved yet.';
  if (window.slipbox && typeof window.slipbox.toast === 'function') {
    window.slipbox.toast(text);
    return;
  }
  window.alert(text);
}

// Keep editor synced if a save causes a filename rename.
document.body.addEventListener('documentRenamed', (event) => {
  const nextDoc = event?.detail?.doc;
  if (!nextDoc || !docInput) return;

  docInput.value = nextDoc;

  // Show the updated filename at the top right after save.
  if (pageTitle) pageTitle.textContent = nextDoc;

  const slug = nextDoc.replace(/\.md$/i, '');
  const nextUrl = `/doc/${encodeURIComponent(slug)}`;
  if (location.pathname !== nextUrl) {
    history.replaceState({}, '', nextUrl);
  }
});

// Warn when auto-save requests fail.
document.body.addEventListener('htmx:responseError', (event) => {
  const elt = event?.detail?.elt;
  if (elt !== typebox) return;

  const status = event?.detail?.xhr?.status;
  warnSaveFailed(`Save failed (HTTP ${status || 'error'}). Your latest edits may not be saved yet.`);
});

document.body.addEventListener('htmx:sendError', (event) => {
  const elt = event?.detail?.elt;
  if (elt !== typebox) return;
  warnSaveFailed('Save failed (network error). Check your connection and try again.');
});

// Ignore manual save shortcuts; saving is automatic.
document.addEventListener('keydown', (event) => {
  const isSaveCombo = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && (event.key === 's' || event.key === 'S');
  if (!isSaveCombo) return;

  event.preventDefault();
  if (typeof event.stopPropagation === 'function') event.stopPropagation();
});

// Make Tab insert four spaces in the editor.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  if (event.target !== typebox) return;

  event.preventDefault();

  const start = typebox.selectionStart;
  const end = typebox.selectionEnd;
  const value = typebox.value;
  const insert = '    ';

  typebox.value = value.slice(0, start) + insert + value.slice(end);
  const nextPos = start + insert.length;
  typebox.setSelectionRange(nextPos, nextPos);

  // Trigger autosave flow that listens to textarea input.
  typebox.dispatchEvent(new Event('input', { bubbles: true }));
});
