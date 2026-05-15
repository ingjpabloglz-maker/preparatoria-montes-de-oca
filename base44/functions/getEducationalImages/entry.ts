import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Cache simple en memoria (30 min TTL)
const cache = new Map();
const CACHE_TTL = 1800000; // 30 min

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { search_terms, subject, limit = 1 } = body;

    if (!Array.isArray(search_terms) || search_terms.length === 0) {
      return Response.json({ photos: [] });
    }

    const PIXABAY_API_KEY = Deno.env.get('PIXABAY_API_KEY');
    if (!PIXABAY_API_KEY) {
      console.error('[getEducationalImages] PIXABAY_API_KEY not set');
      return Response.json({ photos: [] });
    }

    const terms = search_terms.slice(0, 3);
    const results = [];

    for (const term of terms) {
      const cacheKey = term.trim().toLowerCase();

      // Check cache
      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.ts < CACHE_TTL) {
          results.push(...cached.photos);
          continue;
        }
        cache.delete(cacheKey);
      }

      try {
        const query = encodeURIComponent(term.trim());
        const perPage = Math.max(3, limit);
        const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${query}&image_type=photo&orientation=horizontal&category=education&per_page=${perPage}&safesearch=true&lang=es`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          console.error(`[getEducationalImages] Pixabay error ${response.status} for "${term}"`);
          continue;
        }

        const data = await response.json();

        if (!data.hits || data.hits.length === 0) {
          // Retry without category filter
          const url2 = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${query}&image_type=photo&orientation=horizontal&per_page=${perPage}&safesearch=true&lang=es`;
          const res2 = await fetch(url2, { signal: AbortSignal.timeout(5000) });
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2.hits && data2.hits.length > 0) {
              const photos = data2.hits.slice(0, limit).map(hit => ({
                id: String(hit.id),
                url: hit.webformatURL,
                thumbnail: hit.previewURL,
                url_large: hit.largeImageURL,
                author: hit.user,
                source: 'Pixabay',
                width: hit.webformatWidth,
                height: hit.webformatHeight,
                alt: term,
              }));
              cache.set(cacheKey, { ts: Date.now(), photos });
              results.push(...photos);
            }
          }
          continue;
        }

        const photos = data.hits.slice(0, limit).map(hit => ({
          id: String(hit.id),
          url: hit.webformatURL,
          thumbnail: hit.previewURL,
          url_large: hit.largeImageURL,
          author: hit.user,
          source: 'Pixabay',
          width: hit.webformatWidth,
          height: hit.webformatHeight,
          alt: term,
        }));

        cache.set(cacheKey, { ts: Date.now(), photos });
        results.push(...photos);

      } catch (err) {
        console.error(`[getEducationalImages] Error for "${term}":`, err.message);
      }
    }

    return Response.json({ photos: results });

  } catch (e) {
    console.error('[getEducationalImages] Fatal error:', e.message);
    return Response.json({ photos: [] });
  }
});