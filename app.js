// ===============================
// Atualização do ano do rodapé
// ===============================
document.getElementById('year').textContent = new Date().getFullYear();

// ===============================
// Status online/offline
// ===============================
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

window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);

updateStatus();

// ===============================
// Dica de instalação no iOS
// ===============================
(function showIosInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = (window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
  if (isIOS && !isStandalone) {
    document.getElementById('iosHint').classList.remove('hidden');
  }
})();

// ===============================
// Prompt de instalação Android/Chrome
// ===============================
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

// ===============================
// Registro do Service Worker
// ===============================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}

// ===============================
// Configuração e carregamento das coleções
// ===============================
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

// ===============================
// Modal de carta
// ===============================
const modal = document.createElement('div');
modal.id = 'cardModal';
modal.className = 'modal hidden';
modal.innerHTML = `
  <div class="modal-content">
    <span id="closeModal" class="close" aria-label="Fechar">&times;</span>
    <h2 id="modalTitle"></h2>
    <img id="modalImage" src="" alt="" />
    <div class="card-controls" role="group" aria-label="Controle de quantidade">
      <button id="btnDecrease" class="qty-btn" type="button" aria-label="Diminuir">-</button>
      <input
        id="qtyInput"
        type="number"
        inputmode="numeric"
        pattern="\\d*"
        min="0"
        step="1"
        value="0"
        aria-label="Quantidade"
      >
      <button id="btnIncrease" class="qty-btn" type="button" aria-label="Aumentar">+</button>
    </div>
  </div>
`;
document.body.appendChild(modal);


// Estado da coleção salvo no localStorage
let collection = JSON.parse(localStorage.getItem('collection') || '{}');

function saveCollection() {
  localStorage.setItem('collection', JSON.stringify(collection));
}

function getCardQty(cardCode) {
  return Number.isInteger(collection[cardCode]) ? collection[cardCode] : 0;
}

function setCardQty(cardCode, qty) {
  collection[cardCode] = qty;
  saveCollection();
}

// ícones de quantidade
function createCardIcons(cardCode) {
  const iconContainer = document.createElement('div');
  iconContainer.className = 'card-icons';

  // 4 bolinhas
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement('span');
    dot.className = 'icon icon-dot';
    dot.dataset.index = String(i);
    iconContainer.appendChild(dot);
  }

  // "+" (oculto por padrão)
  const plus = document.createElement('span');
  plus.className = 'icon icon-plus';
  plus.style.display = 'none';
  iconContainer.appendChild(plus);

  // Atualiza conforme a quantidade salva
  updateCardIcons(cardCode, iconContainer);

  return iconContainer;
}

function updateCardIcons(cardCode, iconContainer) {
  if (!iconContainer) return;

  const qty = getCardQty(cardCode);

  // Marca as 0..3 bolinhas
  const dots = iconContainer.querySelectorAll('.icon-dot');
  dots.forEach((dot, i) => {
    if (qty > 0 && i < Math.min(qty, 4)) {
      dot.classList.add('checked');
    } else {
      dot.classList.remove('checked');
    }
  });

  // "+" aparece se qty > 4
  const plus = iconContainer.querySelector('.icon-plus');
  if (plus) plus.style.display = qty > 4 ? 'inline-block' : 'none';
}

function refreshCardIcons(cardCode) {
  const container = document.querySelector(`.card[data-code="${CSS.escape(cardCode)}"] .card-icons`);
  updateCardIcons(cardCode, container);
}

const closeModal = document.getElementById('closeModal');

function openCardModal(card) {
  const modalTitle = document.getElementById('modalTitle');
  const modalImage = document.getElementById('modalImage');
  const qtyInput = document.getElementById('qtyInput');
  const btnDecrease = document.getElementById('btnDecrease');
  const btnIncrease = document.getElementById('btnIncrease');

  // associa o código atual ao modal (útil para debug/segurança)
  modal.dataset.cardCode = card.code;

  modalTitle.textContent = card.name || card.code;
  modalImage.src = (card.images && card.images[0]) || './assets/card/bg-caracter.png';
  modalImage.onerror = () => { modalImage.src = './assets/card/bg-caracter.png'; };

  // Quantidade inicial (por carta)
  let qty = getCardQty(card.code);
  applyQty(qty);

  // Helpers
  function applyQty(newQty) {
    qty = Math.max(0, parseInt(newQty, 10) || 0);
    qtyInput.value = String(qty);
    btnDecrease.disabled = qty <= 0;
    setCardQty(card.code, qty);      // salva imediatamente
    refreshCardIcons(card.code);     // atualiza as bolinhas na grid
  }

  // Botão de diminuir
  btnDecrease.onclick = (e) => {
    e.preventDefault();
    applyQty(qty - 1);
  };

  // Botão de aumentar
  btnIncrease.onclick = (e) => {
    e.preventDefault();
    applyQty(qty + 1);
  };

  // Digitar manualmente (só inteiros)
  qtyInput.oninput = () => {
    // remove tudo que não é dígito
    const cleaned = qtyInput.value.replace(/\D/g, '');
    // atualiza UI e storage
    applyQty(cleaned === '' ? 0 : parseInt(cleaned, 10));
  };

  // Evita scroll do número alterar valor quando o user rola a página
  qtyInput.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

  modal.classList.remove('hidden');
}

// Fechar modal
closeModal.addEventListener('click', () => {
  const code = modal.dataset.cardCode;
  if (code) refreshCardIcons(code);
  modal.classList.add('hidden');
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    const code = modal.dataset.cardCode;
    if (code) refreshCardIcons(code);
    modal.classList.add('hidden');
  }
});

// ===============================
// Função para carregar todas as cartas
// ===============================
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
      cardEl.addEventListener('click', () => openCardModal(card));
      cardEl.className = 'card';

      cardEl.dataset.code = card.code; // para facilitar encontrar depois

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

      const icons = createCardIcons(card.code);
      cardEl.appendChild(icons);

      container.appendChild(cardEl);
    });

  } catch (error) {
    container.innerHTML = `<p style="color: red;">Erro geral: ${error.message}</p>`;
  }
}

// ===============================
// Inicialização da coleção
// ===============================
loadAllCollections();
