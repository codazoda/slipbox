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
