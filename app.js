// Atualiza ano do rodapé
document.getElementById('year').textContent = new Date().getFullYear();

// Status online/offline
const statusEl = document.getElementById('status');

function updateStatus() {
  const isOnline = navigator.onLine;
  statusEl.textContent = isOnline ? 'Online' : 'Offline';
  
  if (isOnline) {
    statusEl.classList.add('online');
    statusEl.classList.remove('offline');
  } else {
    statusEl.classList.add('offline');
    statusEl.classList.remove('online');
  }
}

// Eventos corretos (minúsculas!)
window.addEventListener('online',  updateStatus);
window.addEventListener('offline', updateStatus);

// Chamada inicial
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

// Carregar as cartas
const collections = [
  'EB01', 'EB02',
  'OP01', 'OP02', 'OP03', 'OP04', 'OP05', 'OP06', 'OP07', 'OP08', 'OP09', 'OP10', 'OP11', 'OP12',
  'P',
  'PRB01', 'PRB02',
  // ST01 até ST28 - gerar com loop
];

for (let i = 1; i <= 28; i++) {
  collections.push('ST' + i.toString().padStart(2, '0'));
}

// Ordena alfabeticamente
collections.sort();

async function loadAllCollections() {
  const container = document.getElementById('cardsGrid');
  container.innerHTML = 'Carregando cartas...';

  try {
    // Faz fetch em paralelo de todas as coleções
    const promises = collections.map(col =>
      fetch(`./data/${col}.json`)
        .then(res => {
          if (!res.ok) throw new Error(`Erro ao carregar ${col}`);
          return res.json();
        })
        .catch(err => {
          console.warn(err.message);
          return []; // em erro retorna array vazio pra não travar tudo
        })
    );

    const results = await Promise.all(promises);
    // Junta tudo num único array
    const allCards = results.flat();

    // Ordena tudo pelo código da carta
    allCards.sort((a, b) => a.code.localeCompare(b.code));

    if (allCards.length === 0) {
      container.innerHTML = '<p style="color:#a5a5a5">Nenhuma carta encontrada. Verifique se os JSONs existem em /data.</p>';
      return;
    }
    
    container.innerHTML = '';

    allCards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';

      const img = document.createElement('img');
      img.src = card.images[0];
      img.alt = card.name;

      // Fallback para imagem padrão se não encontrar a original
      img.onerror = () => {
        img.src = './assets/card/bg-caracter.png';
      };

      cardEl.appendChild(img);

      const info = document.createElement('div');
      info.className = 'card-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'name';
      nameEl.textContent = card.name;
      info.appendChild(nameEl);

      const codeEl = document.createElement('div');
      codeEl.className = 'code';
      codeEl.textContent = card.code;
      info.appendChild(codeEl);

      cardEl.appendChild(info);

      container.appendChild(cardEl);
    });

  } catch (error) {
    container.innerHTML = `<p style="color: red;">Erro geral: ${error.message}</p>`;
  }
}

loadAllCollections();
