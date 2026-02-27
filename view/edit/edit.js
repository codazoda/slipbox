const typebox = document.getElementById('typebox');
const docInput = document.querySelector('input[name="doc"]');
const pageTitle = document.getElementById('page');

const printMirror = document.createElement('pre');
printMirror.id = 'printbox';
printMirror.setAttribute('aria-hidden', 'true');
printMirror.style.display = 'none';
if (typebox && typebox.parentNode) {
  typebox.insertAdjacentElement('afterend', printMirror);
}

moveSelection(typebox);

function setSaveFailedState(failed) {
  if (!pageTitle) return;
  pageTitle.classList.toggle('save-failed', Boolean(failed));
}

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

function syncPrintMirror() {
  if (!typebox || !printMirror) return;
  printMirror.textContent = typebox.value || '';
}

function isPreviewVisibleForPrint() {
  const previewbox = document.getElementById('previewbox');
  if (!previewbox) return false;
  return window.getComputedStyle(previewbox).display !== 'none';
}

// Keep editor synced if a save causes a filename rename.
document.body.addEventListener('documentRenamed', (event) => {
  const nextDoc = event?.detail?.doc;
  if (!nextDoc || !docInput) return;

  docInput.value = nextDoc;

  // Show the updated filename at the top right after save.
  if (pageTitle) pageTitle.textContent = nextDoc;

  // Keep browser tab title in sync with renamed document.
  document.title = `${nextDoc} - Slipbox`;

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

  setSaveFailedState(true);

  const status = event?.detail?.xhr?.status;
  warnSaveFailed(`Save failed (HTTP ${status || 'error'}). Your latest edits may not be saved yet.`);
});

function isAbortedHtmxRequest(event) {
  const xhr = event?.detail?.xhr;
  if (!xhr) return false;

  const statusText = String(xhr.statusText || '').toLowerCase();
  if (statusText.includes('abort') || statusText.includes('cancel')) return true;

  // Aborted browser requests commonly present as status 0.
  return xhr.status === 0 && xhr.readyState === 0;
}

document.body.addEventListener('htmx:sendError', (event) => {
  const elt = event?.detail?.elt;
  if (elt !== typebox) return;

  // Autosave uses htmx sync replacement, which can cancel older in-flight requests.
  // Those cancellations are expected and should not show as network failures.
  if (isAbortedHtmxRequest(event)) return;

  setSaveFailedState(true);
  warnSaveFailed('Save failed (network error). Check your connection and try again.');
});

document.body.addEventListener('htmx:afterRequest', (event) => {
  const elt = event?.detail?.elt;
  if (elt !== typebox) return;
  if (!event?.detail?.successful) return;
  setSaveFailedState(false);
});

if (typebox) {
  typebox.addEventListener('input', syncPrintMirror);
  syncPrintMirror();
}

window.addEventListener('beforeprint', () => {
  syncPrintMirror();
  document.body.dataset.printSource = isPreviewVisibleForPrint() ? 'preview' : 'edit';
});

window.addEventListener('afterprint', () => {
  delete document.body.dataset.printSource;
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
