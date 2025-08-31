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
  statusEl.className = isOnline ? 'online' : 'offline';
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
// Configuração das coleções
// ===============================
const collections = [
  'EB01', 'EB02',
  'OP01', 'OP02', 'OP03', 'OP04', 'OP05', 'OP06', 'OP07', 'OP08', 'OP09', 'OP10', 'OP11', 'OP12',
  'P', 'PRB01', 'PRB02',
  ...Array.from({ length: 28 }, (_, i) => 'ST' + (i + 1).toString().padStart(2, '0'))
].sort();

// ===============================
// Estado global otimizado
// ===============================
let allCards = [];
let collection = {};
let cardKeyMap = new Map(); // Cache para getCardKey
let leaderCache = new Map(); // Cache para isLeader
let cardsRendered = false;

// Carrega collection do localStorage apenas uma vez
try {
  collection = JSON.parse(localStorage.getItem('collection') || '{}');
} catch (e) {
  collection = {};
}

// Throttled save para evitar muitos writes
let saveTimer = null;
function saveCollection() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem('collection', JSON.stringify(collection));
    } catch (e) {
      console.warn('Failed to save collection:', e);
    }
  }, 100);
}

function getCardQty(card) {
  const key = getCardKey(card);
  return collection[key] || 0;
}

function setCardQty(card, qty) {
  const key = getCardKey(card);
  const newQty = Math.max(0, parseInt(qty, 10) || 0);
  if (newQty === 0) {
    delete collection[key];
  } else {
    collection[key] = newQty;
  }
  saveCollection();
}

// ===============================
// Helpers otimizados
// ===============================
const OP_DOMAIN = 'https://en.onepiece-cardgame.com/';

function getPrimaryImageUrl(card) {
  if (card?.card_image_link?.[0]) {
    const raw = String(card.card_image_link[0]);
    const clean = raw.replace(/\.png.*/i, '.png');
    return /^https?:\/\//i.test(clean) ? clean : OP_DOMAIN + clean.replace(/^\/+/, '');
  }
  if (card?.images?.[0]) {
    return card.images[0];
  }
  return '';
}

function getCardKey(card) {
  // Use cache para evitar recálculos
  const cacheKey = card.code + (card.card_image_link?.[0] || '');
  if (cardKeyMap.has(cacheKey)) {
    return cardKeyMap.get(cacheKey);
  }

  const key = `${card.code}__${getPrimaryImageUrl(card)}`;
  cardKeyMap.set(cacheKey, key);
  return key;
}

function isLeader(cardCode) {
  if (leaderCache.has(cardCode)) {
    return leaderCache.get(cardCode);
  }

  if (!allCards.length) return false;

  const card = allCards.find(c => c?.code === cardCode);
  const cls = (card?.card_type || card?.class || card?.Class || card?.type || '').toUpperCase();
  const result = cls === 'LEADER';

  leaderCache.set(cardCode, result);
  return result;
}

// ===============================
// Modal otimizado
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
      <input id="qtyInput" type="number" min="0" step="1" value="0" aria-label="Quantidade">
      <button id="btnIncrease" class="qty-btn" type="button" aria-label="Aumentar">+</button>
    </div>
  </div>
`;
document.body.appendChild(modal);

const closeModal = document.getElementById('closeModal');
const modalElements = {
  title: document.getElementById('modalTitle'),
  image: document.getElementById('modalImage'),
  qtyInput: document.getElementById('qtyInput'),
  btnDecrease: document.getElementById('btnDecrease'),
  btnIncrease: document.getElementById('btnIncrease')
};

// ===============================
// Ícones otimizados
// ===============================
function createCardIcons(card) {
  const iconContainer = document.createElement('div');
  iconContainer.className = 'card-icons';
  iconContainer.dataset.key = getCardKey(card);

  const dotCount = isLeader(card.code) ? 1 : 4;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < dotCount; i++) {
    const dot = document.createElement('span');
    dot.className = 'icon icon-dot';
    dot.dataset.index = String(i);
    fragment.appendChild(dot);
  }

  iconContainer.appendChild(fragment);
  updateCardIcons(card, iconContainer);
  return iconContainer;
}

function updateCardIcons(card, iconContainer) {
  if (!iconContainer) return;

  const qty = getCardQty(card);
  const leader = isLeader(card.code);
  const dots = iconContainer.querySelectorAll('.icon-dot');

  // Reset classes em batch
  dots.forEach(dot => {
    dot.className = 'icon icon-dot';
  });

  if (leader) {
    if (qty >= 2) {
      dots[0].classList.add('special');
    } else if (qty === 1) {
      dots[0].classList.add('checked');
    }
    return;
  }

  if (qty >= 5) {
    for (let i = 0; i < dots.length - 1; i++) {
      dots[i].classList.add('checked');
    }
    dots[dots.length - 1].classList.add('special');
  } else {
    for (let i = 0; i < qty; i++) {
      dots[i].classList.add('checked');
    }
  }
}

// Batch update para melhor performance
const updateIconsThrottled = (() => {
  let updateQueue = new Set();
  let rafId = null;

  return (card) => {
    updateQueue.add(card);

    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      updateQueue.forEach(card => {
        const key = getCardKey(card);
        const container = document.querySelector(`.card-icons[data-key="${CSS.escape(key)}"]`);
        if (container) {
          updateCardIcons(card, container);

          const cardEl = document.querySelector(`.card[data-key="${CSS.escape(key)}"]`);
          if (cardEl) {
            cardEl.style.opacity = getCardQty(card) === 0 ? '0.5' : '1';
          }
        }
      });

      updateQueue.clear();
      rafId = null;
    });
  };
})();

// ===============================
// Modal otimizado
// ===============================
let currentCard = null;

function openCardModal(card) {
  if (!modalElements.title) return;

  currentCard = card;
  modal.dataset.cardCode = card.code;
  modal.dataset.cardImage = getPrimaryImageUrl(card);

  modalElements.title.textContent = card.card_name || card.name || card.code;
  modalElements.image.src = getPrimaryImageUrl(card) || './assets/card/bg-caracter.png';
  modalElements.image.alt = card.card_name || card.name || card.code;
  modalElements.image.onerror = () => {
    modalElements.image.src = './assets/card/bg-caracter.png';
  };

  updateModalQty();
  modal.classList.remove('hidden');
}

function updateModalQty() {
  if (!currentCard) return;

  const qty = getCardQty(currentCard);
  modalElements.qtyInput.value = String(qty);
  modalElements.btnDecrease.disabled = qty <= 0;
}

function applyModalQty(newQty) {
  if (!currentCard) return;

  const qty = Math.max(0, parseInt(newQty, 10) || 0);
  setCardQty(currentCard, qty);
  updateModalQty();
  updateIconsThrottled(currentCard);
}

// Event listeners do modal
modalElements.btnDecrease.onclick = (e) => {
  e.preventDefault();
  if (currentCard) applyModalQty(getCardQty(currentCard) - 1);
};

modalElements.btnIncrease.onclick = (e) => {
  e.preventDefault();
  if (currentCard) applyModalQty(getCardQty(currentCard) + 1);
};

modalElements.qtyInput.oninput = () => {
  const cleaned = modalElements.qtyInput.value.replace(/\D/g, '');
  applyModalQty(cleaned === '' ? 0 : parseInt(cleaned, 10));
};

modalElements.qtyInput.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

closeModal?.addEventListener('click', () => {
  modal.classList.add('hidden');
  currentCard = null;
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.add('hidden');
    currentCard = null;
  }
});

// ===============================
// Carregamento otimizado
// ===============================
async function loadAllCollections() {
  const container = document.getElementById('cardsGrid');
  if (!container) return;

  container.innerHTML = 'Carregando cartas...';

  try {
    // Carrega em batches menores para não travar a UI
    const BATCH_SIZE = 5;
    const results = [];

    for (let i = 0; i < collections.length; i += BATCH_SIZE) {
      const batch = collections.slice(i, i + BATCH_SIZE);
      const promises = batch.map(col =>
        fetch(`./data/${col}.json`)
          .then(res => res.ok ? res.json() : [])
          .catch(() => [])
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // Permite que a UI respire entre batches
      if (i + BATCH_SIZE < collections.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    allCards = results.flat().sort((a, b) => a.code.localeCompare(b.code));

    if (allCards.length === 0) {
      container.innerHTML = '<p style="color:#a5a5a5">Nenhuma carta encontrada.</p>';
      return;
    }

    await renderCardsInBatches(container);

    cardsRendered = true;
    restoreFiltersFromStorage();
    updateFiltersThrottled();
    filterCardsInGrid();

  } catch (error) {
    container.innerHTML = `<p style="color: red;">Erro: ${error.message}</p>`;
  }
}

// Renderização em batches para não travar
async function renderCardsInBatches(container) {
  container.innerHTML = '';

  const BATCH_SIZE = 50;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < allCards.length; i += BATCH_SIZE) {
    const batch = allCards.slice(i, i + BATCH_SIZE);
    const batchFragment = document.createDocumentFragment();

    batch.forEach(card => {
      const wrapper = createCardElement(card);
      batchFragment.appendChild(wrapper);
    });

    fragment.appendChild(batchFragment);

    // Permite que a UI respire
    if (i + BATCH_SIZE < allCards.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  container.appendChild(fragment);
}

function createCardElement(card) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card-wrapper';
  wrapper.dataset.key = getCardKey(card);

  const cardEl = document.createElement('div');
  cardEl.className = 'card';
  cardEl.dataset.code = card.code || '';
  cardEl.dataset.key = getCardKey(card);

  const img = document.createElement('img');
  const imageUrl = getPrimaryImageUrl(card);
  const hasImage = Boolean(imageUrl);

  img.src = hasImage ? imageUrl : './assets/card/bg-caracter.png';
  img.alt = card.name || card.code;
  img.loading = 'lazy';
  img.dataset.src = imageUrl || './assets/card/bg-caracter.png';

  // Lazy loading otimizado
  if (hasImage) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const imgEl = entry.target;
          if (imgEl.dataset.src && imgEl.src !== imgEl.dataset.src) {
            imgEl.src = imgEl.dataset.src;
            imgEl.onerror = () => {
              imgEl.src = './assets/card/bg-caracter.png';
              cardEl.classList.add('no-image');
            };
          }
          obs.unobserve(imgEl);
        }
      });
    }, { rootMargin: '200px' });

    observer.observe(img);
  } else {
    cardEl.classList.add('no-image');
  }

  cardEl.appendChild(img);

  // Info da carta
  const info = document.createElement('div');
  info.className = 'card-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'name';
  nameEl.textContent = card.card_name || card.name || '';

  const codeEl = document.createElement('div');
  codeEl.className = 'code';
  codeEl.textContent = card.code || '';

  info.append(nameEl, codeEl);
  cardEl.appendChild(info);

  // Ícones
  const icons = createCardIcons(card);

  // Event listener otimizado
  cardEl.addEventListener('click', () => openCardModal(card), { passive: true });

  wrapper.append(cardEl, icons);
  return wrapper;
}

// ===============================
// Busca otimizada
// ===============================
const searchInput = document.querySelector('.search-input');

function getCardByDataKey(dataKey) {
  return allCards.find(card => getCardKey(card) === dataKey);
}

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

if (searchInput) {
  searchInput.addEventListener('input', debounce(filterCardsInGrid, 200));
}

// ===============================
// Filtros otimizados
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const filterContainer = document.querySelector('.filter-container');
  const openFilterBtn = document.querySelector('.filter-icon-btn');
  const closeFilterBtn = document.getElementById('closeFilterBtn');

  if (filterContainer && openFilterBtn && closeFilterBtn) {
    function toggleFilter() {
      if (window.matchMedia('(max-width: 599.98px)').matches) {
        filterContainer.classList.toggle('expanded');
      }
    }

    openFilterBtn.addEventListener('click', toggleFilter);
    closeFilterBtn.addEventListener('click', toggleFilter);
  }
});

let activeFilters = {};
try {
  activeFilters = JSON.parse(localStorage.getItem('activeFilters') || '{}');
} catch (e) {
  activeFilters = {};
}

function getGroupCheckboxes(name) {
  const allCb = document.querySelector(`.filter-group input[name="${name}"][value="all"]`);
  const itemCbs = Array.from(document.querySelectorAll(`.filter-group input[name="${name}"]:not([value="all"])`));
  return { allCb, itemCbs };
}

function getColorCheckboxes() {
  const allCb = document.querySelector('.filter-group input[name="cores"][value="all"]');
  const colorCbs = Array.from(document.querySelectorAll('.filter-group input[name="cores"]:not([value="all"])'));
  return { allCb, colorCbs };
}

function getSelectedFromDOM(name) {
  const { allCb, itemCbs } = getGroupCheckboxes(name);
  const values = itemCbs.filter(c => c.checked).map(c => c.value.toLowerCase());
  const isAll = !!(allCb?.checked);
  return { values, isAll };
}

// Throttled update para filtros
const updateFiltersThrottled = debounce(() => {
  const groups = {};
  const withAll = ['cores', 'rarity', 'card_type', 'counter', 'attribute', 'trigger'];

  // Collect non-all checkboxes
  document.querySelectorAll('.filter-group input[type="checkbox"]:not([value="all"])').forEach(cb => {
    const name = cb.name;
    if (!groups[name]) groups[name] = [];
    if (cb.checked) groups[name].push(cb.value.toLowerCase());
  });

  // Handle "all" checkboxes
  withAll.forEach(name => {
    const { allCb, itemCbs } = getGroupCheckboxes(name);
    if (!groups[name]) groups[name] = [];
    groups[`${name}_all`] = !!(allCb?.checked);
  });

  activeFilters = groups;
  try {
    localStorage.setItem('activeFilters', JSON.stringify(activeFilters));
  } catch (e) {
    console.warn('Failed to save filters:', e);
  }

  filterCardsInGrid();
}, 100);

function restoreFiltersFromStorage() {
  // Reset all checkboxes
  document.querySelectorAll('.filter-group input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // Restore saved values
  Object.entries(activeFilters).forEach(([name, values]) => {
    if (name.endsWith('_all') || !Array.isArray(values)) return;

    const groupCbs = Array.from(document.querySelectorAll(`.filter-group input[name="${name}"]`));
    values.forEach(vLower => {
      const target = groupCbs.find(cb => cb.value.toLowerCase() === vLower);
      if (target) target.checked = true;
    });
  });

  // Handle "all" checkboxes
  const withAll = ['cores', 'rarity', 'card_type', 'counter', 'attribute', 'trigger'];
  withAll.forEach(name => {
    const { allCb, itemCbs } = getGroupCheckboxes(name);
    const flag = activeFilters[`${name}_all`];

    if (typeof flag === 'boolean') {
      if (flag && allCb) {
        allCb.checked = true;
        itemCbs.forEach(c => c.checked = true);
      } else if (allCb) {
        allCb.checked = false;
      }
    } else if (allCb && itemCbs.length > 0) {
      allCb.checked = itemCbs.every(c => c.checked);
    }
  });

  // First use defaults
  const { allCb: colorAll, colorCbs } = getColorCheckboxes();
  if (!('cores' in activeFilters) && !('cores_all' in activeFilters) && colorCbs.length) {
    colorCbs.forEach(c => c.checked = true);
    if (colorAll) colorAll.checked = true;
  }

  const { allCb: trigAll, itemCbs: trigItems } = getGroupCheckboxes('trigger');
  if (!('trigger' in activeFilters) && !('trigger_all' in activeFilters) && trigItems.length) {
    trigItems.forEach(c => c.checked = true);
    if (trigAll) trigAll.checked = true;
  }
}

// Filtro otimizado
function filterCardsInGrid() {
  const searchTerm = (searchInput?.value || '').toLowerCase().trim();
  const allCardWrappers = document.querySelectorAll('.card-wrapper');

  if (!allCardWrappers.length) return;

  const { allCb: colorAll, colorCbs } = getColorCheckboxes();
  const selectedColors = colorCbs.filter(c => c.checked).map(c => c.value.toLowerCase());
  const isAllColors = !!(colorAll?.checked);

  let visibleCount = 0;
  const fragment = document.createDocumentFragment();

  // Process in batches to avoid blocking UI
  const processCards = (startIndex = 0) => {
    const BATCH_SIZE = 100;
    const endIndex = Math.min(startIndex + BATCH_SIZE, allCardWrappers.length);

    for (let i = startIndex; i < endIndex; i++) {
      const wrapper = allCardWrappers[i];
      const card = getCardByDataKey(wrapper.dataset.key);

      if (!card) {
        wrapper.style.display = 'none';
        continue;
      }

      // Search filter
      const name = (card.card_name || '').toLowerCase();
      const code = (card.code || '').toLowerCase();
      const text = (card.text || '').toLowerCase();
      const matchSearch = !searchTerm ||
        name.includes(searchTerm) ||
        code.includes(searchTerm) ||
        text.includes(searchTerm);

      if (!matchSearch) {
        wrapper.style.display = 'none';
        continue;
      }

      // Color filter
      let matchColors = true;
      if (!isAllColors) {
        const cardColors = Array.isArray(card.color) ?
          card.color.map(c => String(c).toLowerCase()) : [];

        if (selectedColors.length > 0) {
          matchColors = cardColors.some(c => selectedColors.includes(c));
        } else {
          matchColors = cardColors.length === 0;
        }
      }

      if (!matchColors) {
        wrapper.style.display = 'none';
        continue;
      }

      // Other filters
      let matchOthers = true;
      const filtersToCheck = ['rarity', 'card_type', 'counter', 'attribute', 'trigger'];

      for (const filterName of filtersToCheck) {
        const { values, isAll } = getSelectedFromDOM(filterName);
        if (isAll || values.length === 0) continue;

        let cardValue = '';
        if (filterName === 'counter') {
          cardValue = (card.counter == null ? 'null' : String(card.counter)).toLowerCase();
        } else if (filterName === 'attribute') {
          cardValue = (card.attribute == null ? 'null' : String(card.attribute)).toLowerCase();
        } else if (filterName === 'trigger') {
          const hasTrigger = card.trigger != null && String(card.trigger).trim() !== '';
          cardValue = hasTrigger ? 'with' : 'without';
        } else {
          cardValue = String(card[filterName] ?? '').toLowerCase();
        }

        if (!values.includes(cardValue)) {
          matchOthers = false;
          break;
        }
      }

      const visible = matchColors && matchOthers;
      wrapper.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    }

    // Continue processing if there are more cards
    if (endIndex < allCardWrappers.length) {
      setTimeout(() => processCards(endIndex), 0);
    } else {
      // Finished processing all cards
      updateNoResultMessage(visibleCount);
    }
  };

  processCards();
}

function updateNoResultMessage(visibleCount) {
  const gridContainer = document.getElementById('cardsGrid');
  if (!gridContainer) return;

  let noResultEl = document.getElementById('noResultMessage');
  if (!noResultEl) {
    noResultEl = document.createElement('p');
    noResultEl.id = 'noResultMessage';
    noResultEl.style.cssText = 'color: var(--text-muted,#888); text-align:center; margin:1em 0';
    noResultEl.textContent = 'Nenhuma carta encontrada.';
    gridContainer.appendChild(noResultEl);
  }

  noResultEl.style.display = (cardsRendered && visibleCount === 0) ? '' : 'none';
}

// ===============================
// Event listeners para filtros
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  // Color filters
  document.querySelectorAll('.filter-group input[name="cores"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const { allCb, colorCbs } = getColorCheckboxes();

      if (cb.value === 'all') {
        colorCbs.forEach(c => c.checked = cb.checked);
      } else {
        const todasMarcadas = colorCbs.length > 0 && colorCbs.every(c => c.checked);
        if (allCb) allCb.checked = todasMarcadas;
      }

      updateFiltersThrottled();
    });
  });

  // Other filters with "All" logic
  ['rarity', 'card_type', 'counter', 'attribute', 'trigger'].forEach(name => {
    const { allCb, itemCbs } = getGroupCheckboxes(name);
    if (!allCb && itemCbs.length === 0) return;

    const handleChange = (changed) => {
      if (changed.value === 'all') {
        itemCbs.forEach(cb => cb.checked = changed.checked);
      } else if (allCb) {
        allCb.checked = itemCbs.length > 0 && itemCbs.every(c => c.checked);
      }
      updateFiltersThrottled();
    };

    if (allCb) allCb.addEventListener('change', () => handleChange(allCb));
    itemCbs.forEach(cb => cb.addEventListener('change', () => handleChange(cb)));
  });
});

// ===============================
// Clear filters button
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('clearFiltersBtn');
  if (!clearBtn) return;

  const updateClearBtnState = debounce(() => {
    const searchEmpty = !searchInput || searchInput.value.trim() === '';
    const groups = ['cores', 'rarity', 'card_type', 'counter', 'attribute', 'trigger'];

    const allAtAll = groups.every(name => {
      const { allCb } = getGroupCheckboxes(name);
      return !allCb || allCb.checked;
    });

    clearBtn.disabled = searchEmpty && allAtAll;
  }, 100);

  clearBtn.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';

    const groups = ['cores', 'rarity', 'card_type', 'counter', 'attribute', 'trigger'];
    groups.forEach(name => {
      const { allCb, itemCbs } = getGroupCheckboxes(name);
      if (allCb) allCb.checked = true;
      itemCbs.forEach(cb => cb.checked = true);
    });

    updateFiltersThrottled();
    updateClearBtnState();
  });

  document.querySelectorAll('.filter-group input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', updateClearBtnState);
  });

  if (searchInput) {
    searchInput.addEventListener('input', updateClearBtnState);
  }

  updateClearBtnState();
});

// ===============================
// ADIÇÕES PARA ECONOMIA DE DADOS
// ===============================

// Detecta conexão do usuário
let connectionInfo = {
  isSlowConnection: false,
  saveData: false,
  effectiveType: '4g'
};

function updateConnectionInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (connection) {
    connectionInfo = {
      isSlowConnection: ['slow-2g', '2g', '3g'].includes(connection.effectiveType),
      saveData: connection.saveData || false,
      effectiveType: connection.effectiveType || '4g'
    };

    // Ajusta comportamento baseado na conexão
    adjustForConnection();
  }
}

function adjustForConnection() {
  if (connectionInfo.saveData || connectionInfo.isSlowConnection) {
    // Reduz qualidade de imagens
    document.documentElement.style.setProperty('--image-quality', '0.8');

    // Desabilita lazy loading para conexões muito lentas (carrega só quando necessário)
    if (connectionInfo.effectiveType === 'slow-2g') {
      document.documentElement.classList.add('minimal-loading');
    }
  }
}

// Monitora mudanças na conexão
if (navigator.connection) {
  navigator.connection.addEventListener('change', updateConnectionInfo);
  updateConnectionInfo();
}

// ===============================
// COMPRESSÃO E CACHE DE DADOS JSON
// ===============================

// Cache inteligente para dados JSON
const jsonCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

function getCachedJson(url) {
  const cached = jsonCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedJson(url, data) {
  jsonCache.set(url, {
    data,
    timestamp: Date.now()
  });

  // Limita o tamanho do cache
  if (jsonCache.size > 50) {
    const oldestKey = jsonCache.keys().next().value;
    jsonCache.delete(oldestKey);
  }
}

// Fetch otimizado para JSON com compressão
async function fetchJsonOptimized(url) {
  // Verifica cache primeiro
  const cached = getCachedJson(url);
  if (cached) return cached;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'application/json',
      },
      cache: 'force-cache', // Usa cache do navegador agressivamente
      credentials: 'omit' // Remove cookies desnecessários
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    setCachedJson(url, data);
    return data;

  } catch (error) {
    console.warn(`Failed to fetch ${url}:`, error);
    return [];
  }
}

// ===============================
// LAZY LOADING INTELIGENTE DE IMAGENS
// ===============================

// Observer otimizado para diferentes tipos de conexão
function createOptimizedObserver(callback, options = {}) {
  const baseOptions = {
    rootMargin: connectionInfo.isSlowConnection ? '50px' : '200px',
    threshold: connectionInfo.saveData ? 0.1 : 0
  };

  return new IntersectionObserver(callback, { ...baseOptions, ...options });
}

// Placeholder SVG compacto (base64)
const PLACEHOLDER_SVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjgzOCIgdmlld0JveD0iMCAwIDYwMCA4MzgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iODM4IiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0yNTAgMzAwSDM1MFY0MDBIMjUwVjMwMFoiIGZpbGw9IiNjY2MiLz4KPC9zdmc+';

// Sistema de prioridade de carregamento
const loadPriorities = {
  visible: new Set(),
  nearViewport: new Set(),
  background: new Set()
};

function addToLoadQueue(element, priority = 'background') {
  loadPriorities[priority].add(element);
  processLoadQueue();
}

let loadQueueTimer = null;
function processLoadQueue() {
  if (loadQueueTimer) return;

  loadQueueTimer = setTimeout(() => {
    const queues = ['visible', 'nearViewport', 'background'];
    const maxConcurrent = connectionInfo.isSlowConnection ? 2 : 6;
    let loaded = 0;

    for (const queueName of queues) {
      const queue = loadPriorities[queueName];
      const items = Array.from(queue).slice(0, maxConcurrent - loaded);

      items.forEach(element => {
        loadImage(element);
        queue.delete(element);
        loaded++;
      });

      if (loaded >= maxConcurrent) break;
    }

    loadQueueTimer = null;

    // Continue processando se ainda há items
    const totalRemaining = Object.values(loadPriorities).reduce((sum, set) => sum + set.size, 0);
    if (totalRemaining > 0) {
      processLoadQueue();
    }
  }, connectionInfo.isSlowConnection ? 1000 : 100);
}

async function loadImage(imgElement) {
  if (imgElement.dataset.loaded === 'true') return;

  const src = imgElement.dataset.src;
  if (!src) return;

  try {
    // Para conexões lentas, adiciona timeout
    const timeoutDuration = connectionInfo.isSlowConnection ? 15000 : 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    const response = await fetch(src, {
      signal: controller.signal,
      cache: 'force-cache',
      credentials: 'omit'
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      imgElement.src = src;
      imgElement.dataset.loaded = 'true';
      imgElement.onerror = null; // Remove error handler
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    // Fallback para placeholder em caso de erro
    imgElement.src = './assets/card/bg-caracter.png';
    imgElement.dataset.loaded = 'error';
  }
}

// ===============================
// VIRTUALIZAÇÃO PARA GRANDES LISTAS
// ===============================

class VirtualGrid {
  constructor(container, itemHeight = 300, buffer = 5) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.buffer = buffer;
    this.visibleItems = new Map();
    this.allItems = [];

    this.setupScrollListener();
  }

  setItems(items) {
    this.allItems = items;
    this.updateVisibleItems();
  }

  setupScrollListener() {
    let scrollTimer = null;
    const scrollHandler = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => this.updateVisibleItems(), 16);
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });
    window.addEventListener('resize', scrollHandler, { passive: true });
  }

  updateVisibleItems() {
    if (!this.allItems.length) return;

    const scrollTop = window.pageYOffset;
    const viewportHeight = window.innerHeight;

    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
    const endIndex = Math.min(
      this.allItems.length - 1,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.buffer
    );

    // Remove items que saíram da viewport
    this.visibleItems.forEach((element, index) => {
      if (index < startIndex || index > endIndex) {
        element.remove();
        this.visibleItems.delete(index);
      }
    });

    // Adiciona novos items visíveis
    for (let i = startIndex; i <= endIndex; i++) {
      if (!this.visibleItems.has(i)) {
        const element = this.createItemElement(this.allItems[i], i);
        this.visibleItems.set(i, element);
        this.container.appendChild(element);
      }
    }
  }

  createItemElement(card, index) {
    // Implementa a criação do elemento (mesmo código do createCardElement)
    // mas com otimizações para virtualização
    const wrapper = document.createElement('div');
    wrapper.style.transform = `translateY(${index * this.itemHeight}px)`;
    wrapper.style.position = 'absolute';
    wrapper.style.width = '100%';

    // ... resto da implementação
    return wrapper;
  }
}

// ===============================
// OTIMIZAÇÕES DE FILTRO COM DEBOUNCE INTELIGENTE
// ===============================

// Debounce adaptativo baseado na performance
let avgFilterTime = 100;
const filterPerformance = [];

function adaptiveFilterDebounce(func) {
  // Ajusta delay baseado na performance histórica
  const delay = Math.max(100, Math.min(500, avgFilterTime * 2));

  return debounce(((...args) => {
    const startTime = performance.now();

    const result = func.apply(this, args);

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Mantém histórico de performance
    filterPerformance.push(duration);
    if (filterPerformance.length > 10) {
      filterPerformance.shift();
    }

    // Calcula média móvel
    avgFilterTime = filterPerformance.reduce((sum, time) => sum + time, 0) / filterPerformance.length;

    return result;
  }), delay);
}

// ===============================
// PRELOAD INTELIGENTE DE DADOS
// ===============================

// Preload de dados baseado no padrão de uso
const usagePattern = JSON.parse(localStorage.getItem('usagePattern') || '{}');

function trackUsage(collection) {
  usagePattern[collection] = (usagePattern[collection] || 0) + 1;
  localStorage.setItem('usagePattern', JSON.stringify(usagePattern));
}

function getPreloadPriority() {
  return Object.entries(usagePattern)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([collection]) => collection);
}

// Preload inteligente em idle time
function preloadPopularCollections() {
  if (connectionInfo.saveData) return; // Não preload em save data mode

  const priority = getPreloadPriority();

  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      priority.forEach((collection, index) => {
        setTimeout(() => {
          fetchJsonOptimized(`./data/${collection}.json`);
        }, index * 1000); // Espaça os requests
      });
    });
  }
}

// ===============================
// COMPRESSÃO DE DADOS NO LOCALSTORAGE
// ===============================

// Compressor simples para dados do localStorage
function compressData(data) {
  try {
    const jsonString = JSON.stringify(data);
    // Remove redundâncias comuns
    return jsonString
      .replace(/{"code":"/g, '{"c":"')
      .replace(/","quantity":/g, '","q":')
      .replace(/,"card_image_link":\["/g, ',"i":["');
  } catch (e) {
    return JSON.stringify(data);
  }
}

function decompressData(compressedString) {
  try {
    // Restaura redundâncias
    const restored = compressedString
      .replace(/{"c":"/g, '{"code":"')
      .replace(/","q":/g, '","quantity":')
      .replace(/,"i":\["/g, ',"card_image_link":["');
    return JSON.parse(restored);
  } catch (e) {
    console.warn('Failed to decompress data:', e);
    return {};
  }
}

// Override das funções de save/load
const originalSaveCollection = saveCollection;
saveCollection = function () {
  try {
    const compressed = compressData(collection);
    localStorage.setItem('collection', compressed);
  } catch (e) {
    console.warn('Failed to save compressed collection:', e);
    originalSaveCollection();
  }
};

// ===============================
// MÉTRICAS DE PERFORMANCE
// ===============================

// Monitora performance e ajusta comportamento
const performanceMetrics = {
  loadTimes: [],
  filterTimes: [],
  renderTimes: []
};

function trackMetric(type, duration) {
  performanceMetrics[type].push(duration);
  if (performanceMetrics[type].length > 20) {
    performanceMetrics[type].shift();
  }

  // Ajusta comportamento baseado nas métricas
  if (type === 'renderTimes') {
    const avgRenderTime = performanceMetrics.renderTimes.reduce((a, b) => a + b, 0) / performanceMetrics.renderTimes.length;

    if (avgRenderTime > 100) {
      // Se renderização está lenta, reduz batch size
      window.RENDER_BATCH_SIZE = Math.max(10, window.RENDER_BATCH_SIZE - 10);
    } else if (avgRenderTime < 50) {
      // Se está rápida, pode aumentar batch size
      window.RENDER_BATCH_SIZE = Math.min(100, window.RENDER_BATCH_SIZE + 5);
    }
  }
}

// Inicializa métricas
window.RENDER_BATCH_SIZE = 50;

// ===============================
// Inicialização
// ===============================
loadAllCollections();
