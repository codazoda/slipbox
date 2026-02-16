(function () {
  const menu = document.getElementById('menu');
  const menuItems = document.getElementById('pluginMenuItems');
  const button = document.getElementById('pluginsButton');

  function removeEmptyState() {
    const first = menuItems.querySelector('li');
    if (!first) return;
    if (first.textContent === 'No plugins loaded') {
      first.remove();
    }
  }

  function getCurrentDoc() {
    const input = document.querySelector('input[name="doc"]');
    const textarea = document.getElementById('typebox');
    return {
      filename: input ? input.value : 'untitled.md',
      text: textarea ? textarea.value : ''
    };
  }

  function addMenu(label, onClick) {
    if (!label || typeof onClick !== 'function') return;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = label;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      hideMenu();
      onClick();
    });
    li.appendChild(a);
    menuItems.appendChild(li);
    removeEmptyState();
  }

  function download(filename, text) {
    const blob = new Blob([text || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }

  function toast(message) {
    if (!message) return;
    window.alert(message);
  }

  function showMenu() {
    menu.style.display = 'block';
  }

  function hideMenu() {
    menu.style.display = 'none';
  }

  function toggleMenu() {
    if (menu.style.display === 'block') hideMenu();
    else showMenu();
  }

  if (button) {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu();
    });
  }

  document.addEventListener('click', (e) => {
    if (!button) return;
    if (!menu.contains(e.target) && e.target !== button && !button.contains(e.target)) {
      hideMenu();
    }
  });

  window.slipbox = {
    addMenu,
    getCurrentDoc,
    download,
    toast,
    showMenu,
    hideMenu
  };
})();
