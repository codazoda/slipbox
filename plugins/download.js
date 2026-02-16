(function () {
  if (!window.slipbox || typeof window.slipbox.addMenu !== 'function') return;

  slipbox.addMenu('Download', function () {
    const doc = slipbox.getCurrentDoc();
    slipbox.download(doc.filename, doc.text);
  });
})();
