/* Service Worker otimizado para performance e economia de dados */
const CACHE_NAME = 'pwa-cache-v3';
const CARD_IMAGES_CACHE = 'card-images-v1';
const JSON_DATA_CACHE = 'json-data-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './offline.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/card/bg-caracter.png' // placeholder image
];

// Configurações de cache por tipo
const CACHE_STRATEGIES = {
  images: { maxAge: 7 * 24 * 60 * 60 * 1000, maxEntries: 1000 }, // 7 dias, máx 1000 imagens
  json: { maxAge: 24 * 60 * 60 * 1000, maxEntries: 100 }, // 1 dia, máx 100 JSONs
  core: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 dias para assets principais
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Remove caches antigos
      caches.keys().then(keys =>
        Promise.all(
          keys.filter(key =>
            key !== CACHE_NAME &&
            key !== CARD_IMAGES_CACHE &&
            key !== JSON_DATA_CACHE
          ).map(key => caches.delete(key))
        )
      ),
      // Limpa caches expirados
      cleanExpiredCache(),
      self.clients.claim()
    ])
  );
});

// Função para limpar cache expirado
async function cleanExpiredCache() {
  const cacheNames = [
    { name: CARD_IMAGES_CACHE, config: CACHE_STRATEGIES.images },
    { name: JSON_DATA_CACHE, config: CACHE_STRATEGIES.json }
  ];

  for (const { name, config } of cacheNames) {
    try {
      const cache = await caches.open(name);
      const keys = await cache.keys();

      if (keys.length > config.maxEntries) {
        // Remove entradas mais antigas se exceder o limite
        const entriesToDelete = keys.slice(0, keys.length - config.maxEntries);
        await Promise.all(entriesToDelete.map(key => cache.delete(key)));
      }

      // Remove entradas expiradas
      const now = Date.now();
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const cachedTime = response.headers.get('sw-cache-time');
          if (cachedTime && now - parseInt(cachedTime) > config.maxAge) {
            await cache.delete(request);
          }
        }
      }
    } catch (error) {
      console.warn(`Error cleaning cache ${name}:`, error);
    }
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Imagens do One Piece TCG - cache agressivo
  if (url.hostname.includes('onepiece-cardgame.com') && url.pathname.includes('/images/')) {
    event.respondWith(handleCardImageRequest(request));
    return;
  }

  // Dados JSON - cache com revalidação
  if (url.pathname.endsWith('.json') && url.pathname.includes('/data/')) {
    event.respondWith(handleJsonRequest(request));
    return;
  }

  // Navegação - network first com fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Assets principais - cache first
  if (CORE_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', '')))) {
    event.respondWith(handleCoreAssetRequest(request));
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(handleDefaultRequest(request));
});

// Handler para imagens de cartas - máxima economia de dados
async function handleCardImageRequest(request) {
  try {
    const cache = await caches.open(CARD_IMAGES_CACHE);
    const cached = await cache.match(request);

    if (cached) {
      // Verifica se não expirou
      const cachedTime = cached.headers.get('sw-cache-time');
      const now = Date.now();

      if (!cachedTime || now - parseInt(cachedTime) < CACHE_STRATEGIES.images.maxAge) {
        return cached;
      }
    }

    // Se não tem cache válido, tenta buscar
    const networkResponse = await fetch(request, {
      // Otimizações de rede para imagens
      cache: 'force-cache',
      credentials: 'omit'
    });

    if (networkResponse && networkResponse.status === 200) {
      // Adiciona timestamp ao cache
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());

      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });

      await cache.put(request, cachedResponse);
      return networkResponse;
    }

    // Fallback para placeholder se tudo falhar
    return cached || caches.match('./assets/card/bg-caracter.png');

  } catch (error) {
    console.warn('Error handling card image:', error);
    // Retorna cache se existir, senão placeholder
    const cache = await caches.open(CARD_IMAGES_CACHE);
    const cached = await cache.match(request);
    return cached || caches.match('./assets/card/bg-caracter.png');
  }
}

// Handler para dados JSON - background sync
async function handleJsonRequest(request) {
  try {
    const cache = await caches.open(JSON_DATA_CACHE);
    const cached = await cache.match(request);

    // Sempre retorna cache primeiro se existir (melhor UX)
    if (cached) {
      const cachedTime = cached.headers.get('sw-cache-time');
      const now = Date.now();

      // Se ainda não expirou, retorna cache e atualiza em background
      if (cachedTime && now - parseInt(cachedTime) < CACHE_STRATEGIES.json.maxAge) {
        // Background update (não bloqueia)
        setTimeout(() => updateJsonInBackground(request, cache), 0);
        return cached;
      }
    }

    // Se expirou ou não tem cache, busca na rede
    const networkResponse = await fetch(request, {
      cache: 'no-cache',
      credentials: 'omit'
    });

    if (networkResponse && networkResponse.status === 200) {
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());

      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });

      await cache.put(request, cachedResponse);
      return networkResponse;
    }

    return cached || Response.error();

  } catch (error) {
    console.warn('Error handling JSON request:', error);
    const cache = await caches.open(JSON_DATA_CACHE);
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

// Atualização em background dos JSONs
async function updateJsonInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request, {
      cache: 'no-cache',
      credentials: 'omit'
    });

    if (networkResponse && networkResponse.status === 200) {
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cache-time', Date.now().toString());

      const cachedResponse = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });

      await cache.put(request, cachedResponse);

      // Notifica clientes sobre dados atualizados
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'DATA_UPDATED',
          url: request.url
        });
      });
    }
  } catch (error) {
    console.warn('Background update failed:', error);
  }
}

// Handler para navegação
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    return cached || caches.match('./offline.html');
  }
}

// Handler para assets principais
async function handleCoreAssetRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return cached;
  }
}

// Handler padrão
async function handleDefaultRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Limpeza periódica do cache (executa a cada hora)
setInterval(cleanExpiredCache, 60 * 60 * 1000);
