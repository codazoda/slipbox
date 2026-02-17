const typebox = document.getElementById('typebox');
const docInput = document.querySelector('input[name="doc"]');
const pageTitle = document.getElementById('page');

moveSelection(typebox);

function moveSelection(element) {
  element.focus();
  element.setSelectionRange(element.value.length, element.value.length);
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
