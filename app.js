// Atualiza ano do rodapé
document.getElementById('year').textContent = new Date().getFullYear();

// Status online/offline
const statusEl = document.getElementById('status');
function updateStatus() { statusEl.textContent = navigator.onLine ? 'online' : 'offline'; }
window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);
updateStatus();

// Dica de instalação no iOS (não há beforeinstallprompt no Safari iOS)
(function showIosInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = (window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
  if (isIOS && !isStandalone) {
    document.getElementById('iosHint').classList.remove('hidden');
  }
})();

// Prompt de instalação no Android/Chrome
let deferredPrompt = null;
const btnInstall = document.getElementById('btnInstall');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.classList.remove('hidden');
});
btnInstall.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  // Opcional: analytics do outcome ('accepted' | 'dismissed')
  deferredPrompt = null;
  btnInstall.classList.add('hidden');
});

// Registro do Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}