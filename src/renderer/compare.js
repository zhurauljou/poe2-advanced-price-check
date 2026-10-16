// Окно карточки конкурента сбоку от оверлея: разметку готовит основное окно, здесь только показываем
// и сообщаем высоту, чтобы окно подогналось под содержимое.
const box = document.getElementById('cmp');

window.pc.onCompare((html) => {
  box.innerHTML = html;
  // Не requestAnimationFrame: в скрытом окне он не срабатывает, а окно и покажется только после замера.
  window.pc.compareFit(document.body.scrollHeight);
});
