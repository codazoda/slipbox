(function () {
  if (!window.slipbox || typeof window.slipbox.addMenu !== 'function') return;

  const textarea = document.getElementById('typebox');
  if (!textarea) return;

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

  function parseInline(text) {
    let out = escapeHtml(text);

    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    return out;
  }

  function markdownToHtml(md) {
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let inCode = false;
    let inUl = false;

    function closeUl() {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
    }

    for (const rawLine of lines) {
      const line = rawLine || '';

      if (line.trim().startsWith('```')) {
        closeUl();
        if (!inCode) {
          html.push('<pre><code>');
          inCode = true;
        } else {
          html.push('</code></pre>');
          inCode = false;
        }
        continue;
      }

      if (inCode) {
        html.push(`${escapeHtml(line)}\n`);
        continue;
      }

      const h = line.match(/^(#{1,6})\s+(.+)$/);
      if (h) {
        closeUl();
        const lvl = h[1].length;
        html.push(`<h${lvl}>${parseInline(h[2])}</h${lvl}>`);
        continue;
      }

      const li = line.match(/^\s*[-*]\s+(.+)$/);
      if (li) {
        if (!inUl) {
          html.push('<ul>');
          inUl = true;
        }
        html.push(`<li>${parseInline(li[1])}</li>`);
        continue;
      }

      closeUl();
      if (!line.trim()) {
        html.push('');
      } else {
        html.push(`<p>${parseInline(line)}</p>`);
      }
    }

    closeUl();
    if (inCode) html.push('</code></pre>');
    return html.join('\n');
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

  // Grab the newest plugin item so we can rename Preview <-> Edit.
  const menuItems = document.getElementById('pluginMenuItems');
  if (menuItems) {
    const lastLi = menuItems.querySelector('li:last-child a');
    if (lastLi && lastLi.textContent === 'Preview') {
      menuAnchor = lastLi;
    }
  }
})();
