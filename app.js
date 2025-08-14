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
    const el = document.getElementById('iosHint');
    if (el) el.classList.remove('hidden');
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
  if (btnInstall) btnInstall.classList.remove('hidden');
});
if (btnInstall) {
  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const { outcome } = await deferredPrompt.userChoice;
      // opcional: usar outcome
    } catch (err) {
      console.warn('Install prompt error', err);
    }
    deferredPrompt = null;
    btnInstall.classList.add('hidden');
  });
}

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
];

for (let i = 1; i <= 28; i++) {
  collections.push('ST' + i.toString().padStart(2, '0'));
}

collections.sort();

// ===============================
// Estado global
// ===============================
let allCards = []; // será preenchido por loadAllCollections()
let collection = JSON.parse(localStorage.getItem('collection') || '{}');

function saveCollection() {
  localStorage.setItem('collection', JSON.stringify(collection));
}

function getCardQty(cardCode) {
  const v = collection[cardCode];
  const n = parseInt(v, 10);
  return Number.isInteger(n) ? n : 0;
}

function setCardQty(cardCode, qty) {
  collection[cardCode] = Number.isInteger(qty) ? qty : parseInt(qty, 10) || 0;
  saveCollection();
}

// ===============================
// Helpers relacionados ao tipo (leader)
// ===============================
function isLeader(cardCode) {
  if (!allCards || !allCards.length) return false;
  const cd = allCards.find(c => c && c.code === cardCode);
  // Alguns JSONs vêm com "class": "LEADER"
  const cls = (cd && (cd.class || cd.Class || cd.type)) || '';
  return String(cls).toUpperCase() === 'LEADER';
}

// ===============================
// Modal de carta (DOM criado dinamicamente)
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

const closeModal = document.getElementById('closeModal');

// ===============================
// Ícones de quantidade (cria e atualiza)
// ===============================
function createCardIcons(cardCode) {
  const iconContainer = document.createElement('div');
  iconContainer.className = 'card-icons';
  iconContainer.dataset.code = cardCode; // importante para atualizar quando estiver fora da .card

  const dotCount = isLeader(cardCode) ? 1 : 4;

  for (let i = 0; i < dotCount; i++) {
    const dot = document.createElement('span');
    dot.className = 'icon icon-dot';
    dot.dataset.index = String(i);
    iconContainer.appendChild(dot);
  }

  // estado inicial
  updateCardIcons(cardCode, iconContainer);
  return iconContainer;
}

// Atualiza visual das bolinhas conforme a quantidade
function updateCardIcons(cardCode, iconContainer) {
  if (!iconContainer) return;

  const qty = getCardQty(cardCode);
  const leader = isLeader(cardCode);
  const dots = iconContainer.querySelectorAll('.icon-dot');

  // limpa estado
  dots.forEach(dot => {
    dot.classList.remove('checked');
    dot.classList.remove('special');
  });

  if (leader) {
    // 1 bolinha só
    if (qty >= 2) {
      // 2+ líderes: usa ícone especial (sem checked)
      dots[0].classList.add('special');
    } else if (qty === 1) {
      dots[0].classList.add('checked');
    }
    // qty 0 => todas vazias (unchecked)
    return;
  }

  // Cartas normais (até 4 bolinhas)
  const last = dots.length - 1; // índice 3
  if (qty >= 5) {
    // 5+: primeiras 3 marcadas e a 4ª vira especial
    for (let i = 0; i < last; i++) dots[i].classList.add('checked');
    dots[last].classList.add('special'); // garante que substitui a 4ª
  } else {
    // 0..4: marca i < qty
    for (let i = 0; i < qty; i++) dots[i].classList.add('checked');
  }
}

function refreshCardIcons(cardCode) {
  const container = document.querySelector(`.card-icons[data-code="${CSS.escape(cardCode)}"]`);
  updateCardIcons(cardCode, container);
}

function updateAllCardIcons() {
  if (!allCards || !allCards.length) return;
  allCards.forEach(c => {
    if (!c || !c.code) return;
    refreshCardIcons(c.code);
  });
}

// ===============================
// Função que abre o modal (com controles funcionando)
// ===============================
function openCardModal(card) {
  const modalTitle = document.getElementById('modalTitle');
  const modalImage = document.getElementById('modalImage');
  const qtyInput = document.getElementById('qtyInput');
  const btnDecrease = document.getElementById('btnDecrease');
  const btnIncrease = document.getElementById('btnIncrease');

  if (!modalTitle || !modalImage || !qtyInput || !btnDecrease || !btnIncrease) return;

  // associa o código atual ao modal (útil para fechar e sync)
  modal.dataset.cardCode = card.code;

  modalTitle.textContent = card.name || card.code;
  modalImage.src = (card.images && card.images[0]) || './assets/card/bg-caracter.png';
  modalImage.alt = card.name || card.code;
  modalImage.onerror = () => {
    modalImage.src = './assets/card/bg-caracter.png';
  };

  // Quantidade inicial (por carta)
  let qty = getCardQty(card.code);
  applyQty(qty);

  // helper centralizado que atualiza UI, storage e ícones
  function applyQty(newQty) {
    qty = Math.max(0, parseInt(newQty, 10) || 0);
    qtyInput.value = String(qty);
    btnDecrease.disabled = qty <= 0;
    setCardQty(card.code, qty);      // salva imediatamente
    refreshCardIcons(card.code);     // atualiza as bolinhas na grid
  }

  // sobrescreve (safe) os handlers do modal para evitar empilhar listeners
  btnDecrease.onclick = (e) => {
    e.preventDefault();
    applyQty(qty - 1);
  };

  btnIncrease.onclick = (e) => {
    e.preventDefault();
    applyQty(qty + 1);
  };

  qtyInput.oninput = () => {
    // permite apenas dígitos, evita sinais e decimais
    const cleaned = qtyInput.value.replace(/\D/g, '');
    applyQty(cleaned === '' ? 0 : parseInt(cleaned, 10));
  };

  // evita alteração com scroll
  qtyInput.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

  modal.classList.remove('hidden');
}

// Fechar modal (botão X) - sincroniza ícones da carta atual
if (closeModal) {
  closeModal.addEventListener('click', () => {
    const code = modal.dataset.cardCode;
    if (code) refreshCardIcons(code);
    modal.classList.add('hidden');
  });

}

// clicar fora do conteúdo fecha e sincroniza
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    const code = modal.dataset.cardCode;
    if (code) refreshCardIcons(code);
    modal.classList.add('hidden');
  }
});

// ===============================
// Carregamento e renderização das cartas
// ===============================
async function loadAllCollections() {
  const container = document.getElementById('cardsGrid');
  if (!container) return;
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
    allCards = results.flat();

    // Ordena tudo pelo código da carta
    allCards.sort((a, b) => a.code.localeCompare(b.code));

    if (allCards.length === 0) {
      container.innerHTML = '<p style="color:#a5a5a5">Nenhuma carta encontrada. Verifique se os JSONs existem em /data.</p>';
      return;
    }

    container.innerHTML = '';

    allCards.forEach(card => {
      // wrapper que será o filho da grid (um elemento por célula)
      const wrapper = document.createElement('div');
      wrapper.className = 'card-wrapper';

      // DOM card (visual)
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.dataset.code = card.code || '';

      // imagem (ou placeholder)
      const img = document.createElement('img');
      const hasImage = Boolean(card.images && card.images[0]);
      img.src = hasImage ? card.images[0] : './assets/card/bg-caracter.png';
      img.alt = card.name || card.code;

      // Se a imagem der erro, trocamos para placeholder e marcamos no card
      img.onerror = () => {
        img.src = './assets/card/bg-caracter.png';
        cardEl.classList.add('no-image');
      };

      // se não tem imagem originalmente, marcar .no-image
      if (!hasImage) cardEl.classList.add('no-image');

      cardEl.appendChild(img);

      // info (nome e código) - será sobreposto pelo CSS quando .no-image
      const info = document.createElement('div');
      info.className = 'card-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'name';
      nameEl.textContent = card.name || '';

      const codeEl = document.createElement('div');
      codeEl.className = 'code';
      codeEl.textContent = card.code || '';

      info.appendChild(nameEl);
      info.appendChild(codeEl);

      cardEl.appendChild(info);

      // ícones de quantidade (FORA da .card mas DENTRO do wrapper, logo abaixo)
      const icons = createCardIcons(card.code);

      // clique abre o modal com os controles
      cardEl.addEventListener('click', () => openCardModal(card));

      // monta wrapper (card em cima, ícones abaixo)
      wrapper.appendChild(cardEl);
      wrapper.appendChild(icons);

      // adiciona ao grid
      container.appendChild(wrapper);
    });

    // Atualiza ícones (garantia)
    updateAllCardIcons();

  } catch (error) {
    container.innerHTML = `<p style="color: red;">Erro geral: ${error.message}</p>`;
  }
}


// ===============================
// Inicialização
// ===============================
loadAllCollections();
