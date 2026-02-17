(function () {
  if (!window.slipbox || typeof window.slipbox.addMenu !== 'function') return;

  const textarea = document.getElementById('typebox');
  if (!textarea) return;

  const parser = window.commonmark ? new window.commonmark.Parser() : null;
  const renderer = window.commonmark ? new window.commonmark.HtmlRenderer({ safe: true }) : null;

  let inPreview = false;
  const preview = document.createElement('div');
  preview.id = 'previewbox';
  preview.setAttribute('aria-label', 'Markdown Preview');
  preview.style.display = 'none';
  preview.style.padding = '10px';
  preview.style.width = '100%';
  preview.style.height = 'calc(100% - 25px)';
  preview.style.overflow = 'auto';
  preview.style.whiteSpace = 'normal';
  preview.style.backgroundColor = 'var(--surface)';
  preview.style.color = 'var(--text)';
  preview.style.border = '0';
  preview.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  preview.style.lineHeight = '1.6';

  textarea.insertAdjacentElement('afterend', preview);

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Task-list support on top of CommonMark output.
  function withTaskLists(html) {
    const pWrapped = /<li><p>\s*\[( |x|X)\]\s*([\s\S]*?)<\/p><\/li>/g;
    const plain = /<li>\s*\[( |x|X)\]\s*([\s\S]*?)<\/li>/g;

    const replacer = (_, checked, text) => {
      const isChecked = checked.toLowerCase() === 'x';
      return `<li class="task-list-item"><label><input type="checkbox" disabled ${isChecked ? 'checked' : ''}> <span>${text}</span></label></li>`;
    };

    return html.replace(pWrapped, replacer).replace(plain, replacer);
  }

  function markdownToHtml(md) {
    const text = String(md || '');

    if (parser && renderer) {
      const ast = parser.parse(text);
      const raw = renderer.render(ast);
      return withTaskLists(raw);
    }

    // Fallback if commonmark is unavailable.
    return `<pre>${escapeHtml(text)}</pre>`;
  }

  function setPreviewMode(enabled) {
    inPreview = enabled;

    if (enabled) {
      preview.innerHTML = markdownToHtml(textarea.value);
      textarea.style.display = 'none';
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
      textarea.style.display = 'block';
      textarea.focus();
    }

    if (menuAnchor) {
      menuAnchor.textContent = enabled ? 'Edit' : 'Preview';
    }
  }

  textarea.addEventListener('input', () => {
    if (inPreview) preview.innerHTML = markdownToHtml(textarea.value);
  });

  let menuAnchor = null;
  slipbox.addMenu('Preview', function () {
    setPreviewMode(!inPreview);
  });

  const menuItems = document.getElementById('pluginMenuItems');
  if (menuItems) {
    const lastLi = menuItems.querySelector('li:last-child a');
    if (lastLi && lastLi.textContent === 'Preview') {
      menuAnchor = lastLi;
    }
  }
})();
