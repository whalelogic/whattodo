const toggle = document.getElementById('theme-toggle');
const thumb = document.getElementById('theme-thumb');

function applyThumb() {
  const isDark = document.documentElement.classList.contains('dark');
  thumb.textContent = isDark ? '✨' : '🌙';
  thumb.style.transform = isDark ? 'translateX(32px)' : 'translateX(0)';
}

toggle.addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  applyThumb();
});

applyThumb();
