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

function getCardQty(card) {
  const key = getCardKey(card);
  const v = collection[key];
  const n = parseInt(v, 10);
  return Number.isInteger(n) ? n : 0;
}

function setCardQty(card, qty) {
  const key = getCardKey(card);
  collection[key] = Number.isInteger(qty) ? qty : parseInt(qty, 10) || 0;
  saveCollection();
}


// ===============================
// Helper para resolver URL da imagem
// ===============================
const OP_DOMAIN = 'https://en.onepiece-cardgame.com/';

function getPrimaryImageUrl(card) {
  // Novo formato
  if (card && Array.isArray(card.card_image_link) && card.card_image_link[0]) {
    const raw = String(card.card_image_link[0]);
    // Remove qualquer coisa após ".png" (query string ou fragmentos)
    const clean = raw.replace(/\.png.*/i, '.png');
    // Se não for absoluta, adiciona o domínio oficial
    const absolute = /^https?:\/\//i.test(clean)
      ? clean
      : OP_DOMAIN + clean.replace(/^\/+/, '');
    return absolute;
  }
  // Compatibilidade com o formato antigo
  if (card && Array.isArray(card.images) && card.images[0]) {
    return card.images[0];
  }
  return '';
}

function getCardKey(card) {
  return `${card.code}__${getPrimaryImageUrl(card)}`;
}

// ===============================
// Helpers relacionados ao tipo (leader)
// ===============================
function isLeader(cardCode) {
  if (!allCards || !allCards.length) return false;

  const cd = allCards.find(c => c && c.code === cardCode);
  const cls = (cd && (cd.card_type || cd.class || cd.Class || cd.type)) || '';

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
function createCardIcons(card) {
  const iconContainer = document.createElement('div');
  iconContainer.className = 'card-icons';
  iconContainer.dataset.key = getCardKey(card);
  const dotCount = isLeader(card.code) ? 1 : 4;

  for (let i = 0; i < dotCount; i++) {
    const dot = document.createElement('span');
    dot.className = 'icon icon-dot';
    dot.dataset.index = String(i);
    iconContainer.appendChild(dot);
  }

  // estado inicial
  updateCardIcons(card, iconContainer);
  return iconContainer;
}

// Atualiza visual das bolinhas conforme a quantidade
function updateCardIcons(card, iconContainer) {
  if (!iconContainer) return;

  const qty = getCardQty(card);
  const leader = isLeader(card.code);
  const dots = iconContainer.querySelectorAll('.icon-dot');

  dots.forEach(dot => {
    dot.classList.remove('checked', 'special');
  });

  if (leader) {
    if (qty >= 2) {
      dots[0].classList.add('special');
    } else if (qty === 1) {
      dots[0].classList.add('checked');
    }
    return;
  }

  const last = dots.length - 1;
  if (qty >= 5) {
    for (let i = 0; i < last; i++) dots[i].classList.add('checked');
    dots[last].classList.add('special');
  } else {
    for (let i = 0; i < qty; i++) dots[i].classList.add('checked');
  }
}

function refreshCardIcons(card) {
  const key = getCardKey(card);
  const container = document.querySelector(`.card-icons[data-key="${CSS.escape(key)}"]`);
  updateCardIcons(card, container);
}

function updateAllCardIcons() {
  if (!allCards || !allCards.length) return;
  allCards.forEach(card => {
    const key = getCardKey(card);

    refreshCardIcons(card);

    const cardEl = document.querySelector(`.card[data-key="${CSS.escape(key)}"]`);
    if (cardEl) {
      const qty = getCardQty(card);
      cardEl.style.opacity = qty === 0 ? '0.5' : '1';
    }
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
  modal.dataset.cardImage = getPrimaryImageUrl(card);

  modalTitle.textContent = card.card_name || card.name || card.code;
  modalImage.src = getPrimaryImageUrl(card) || './assets/card/bg-caracter.png';
  modalImage.alt = card.card_name || card.name || card.code;
  modalImage.onerror = () => {
    modalImage.src = './assets/card/bg-caracter.png';
  };

  // Quantidade inicial (por carta)
  let qty = getCardQty(card);
  applyQty(qty);

  // helper centralizado que atualiza UI, storage e ícones
  function applyQty(newQty) {
    qty = Math.max(0, parseInt(newQty, 10) || 0);
    qtyInput.value = String(qty);
    btnDecrease.disabled = qty <= 0;

    setCardQty(card, qty);       // chave única agora
    refreshCardIcons(card);

    const cardEl = document.querySelector(`.card[data-key="${CSS.escape(getCardKey(card))}"]`);
    if (cardEl) {
      cardEl.style.opacity = qty === 0 ? '0.5' : '1';
    }
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
    const img = modal.dataset.cardImage;
    if (code && img) {
      refreshCardIcons({ code, card_image_link: [img] });
    }
    modal.classList.add('hidden');
  });
}

// clicar fora do conteúdo fecha e sincroniza
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    const code = modal.dataset.cardCode;
    const img = modal.dataset.cardImage;
    if (code && img) {
      refreshCardIcons({ code, card_image_link: [img] });
    }
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
      wrapper.dataset.key = getCardKey(card);


      // DOM card (visual)
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.dataset.code = card.code || '';
      cardEl.dataset.key = getCardKey(card);


      // imagem (ou placeholder)
      const img = document.createElement('img');
      // Verifica se existe imagem no novo formato
      const imageUrl = getPrimaryImageUrl(card);
      // Se não tiver imagem, usa placeholder local
      const hasImage = Boolean(imageUrl);
      img.src = hasImage ? imageUrl : './assets/card/bg-caracter.png';
      img.alt = card.name || card.code;
      // lazy loading nativo
      img.loading = 'lazy';
      // Guarda a URL real para carregar quando entrar na tela
      if (hasImage && imageUrl) {
        img.dataset.src = imageUrl;
      } else {
        // garante que dataset.src nunca seja vazio
        img.dataset.src = './assets/card/bg-caracter.png';
      }


      // IntersectionObserver para lazy load mais controlado
      if (hasImage) {
        const observer = new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const imgEl = entry.target;
              imgEl.src = imgEl.dataset.src || './assets/card/bg-caracter.png'; // fallback seguro
              imgEl.onerror = () => { imgEl.src = './assets/card/bg-caracter.png'; };
              obs.unobserve(imgEl);
            }
          });
        }, { rootMargin: '200px' });

        observer.observe(img);
      }

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
      // Primeiro tenta card.card_name, depois card.name (compatibilidade)
      nameEl.textContent = card.card_name || card.name || '';

      const codeEl = document.createElement('div');
      codeEl.className = 'code';
      codeEl.textContent = card.code || '';

      info.appendChild(nameEl);
      info.appendChild(codeEl);


      cardEl.appendChild(info);

      // ícones de quantidade (FORA da .card mas DENTRO do wrapper, logo abaixo)
      const icons = createCardIcons(card); // passa o card inteiro
      icons.dataset.key = getCardKey(card); // (opcional, a função já define)

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
// Lógica de Busca por Texto
// ===============================
const searchInput = document.querySelector('.search-input');

// Helper para encontrar a carta no array allCards
function getCardByDataKey(dataKey) {
  return allCards.find(card => getCardKey(card) === dataKey);
}

// Função para filtrar os elementos na tela
function filterCardsInGrid() {
  const searchTerm = searchInput.value.toLowerCase().trim();

  // Condição para iniciar a busca a partir da terceira letra
  if (searchTerm.length > 0 && searchTerm.length < 3) {
    const allCardWrappers = document.querySelectorAll('.card-wrapper');
    allCardWrappers.forEach(wrapper => {
      wrapper.style.display = '';
    });
    return;
  }

  const allCardWrappers = document.querySelectorAll('.card-wrapper');

  allCardWrappers.forEach(wrapper => {
    const dataKey = wrapper.dataset.key;
    const card = getCardByDataKey(dataKey);

    if (card) {
      const searchableFields = [
        card.code,
        card.card_name,
        card.text,
        card.trigger,
        card.card_sets
      ];
      if (Array.isArray(card.feature)) {
        searchableFields.push(card.feature.join(' '));
      }

      const isMatch = searchableFields.some(field => {
        // Normaliza o campo da carta: substitui o caractere Unicode pelo hífen padrão
        const normalizedField = String(field).replace(/\u2212/g, '-');
        // Converte para minúsculas e verifica se o termo de busca está incluído
        return normalizedField.toLowerCase().includes(searchTerm);
      });

      // Se o termo de busca estiver vazio, mostre tudo. Caso contrário, aplique a regra.
      wrapper.style.display = (searchTerm === '' || isMatch) ? '' : 'none';
    }
  });
}

// **NOVO: Adiciona a função de debounce**
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

// **ALTERAÇÃO AQUI:** Adiciona um listener para o evento 'input' na barra de busca, com debounce
searchInput.addEventListener('input', debounce(filterCardsInGrid, 300));

// ===============================
// Abre e fecha filtros
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const filterContainer = document.querySelector('.filter-container');
  const openFilterBtn = document.querySelector('.filter-icon-btn');
  const closeFilterBtn = document.getElementById('closeFilterBtn');

  if (filterContainer && openFilterBtn && closeFilterBtn) {

    // Alterna a classe 'expanded' no contêiner do filtro
    function toggleFilter() {
      // Usamos matchMedia para garantir que a funcionalidade só se aplica em mobile
      if (window.matchMedia('(max-width: 599.98px)').matches) {
        filterContainer.classList.toggle('expanded');
      }
    }

    // Adiciona o evento de clique para abrir o filtro
    openFilterBtn.addEventListener('click', toggleFilter);

    // Adiciona o evento de clique para fechar o filtro
    closeFilterBtn.addEventListener('click', toggleFilter);
  }
});

// ===============================
// Inicialização
// ===============================
loadAllCollections();
