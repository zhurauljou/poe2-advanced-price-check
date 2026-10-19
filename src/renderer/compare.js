// Competitor card window beside the overlay: the main window prepares the markup, here we only show it
// and report the height so the window fits its content.
const box = document.getElementById('cmp');

window.pc.onCompare((html) => {
  box.innerHTML = html;
  // Not requestAnimationFrame: it doesn't fire in a hidden window, and the window is shown only after measuring.
  window.pc.compareFit(document.body.scrollHeight);
});
