import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Cache simple en memoria (30 min TTL)
const cache = new Map();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { search_terms } = await req.json();

    if (!Array.isArray(search_terms) || search_terms.length === 0) {
      return Response.json({ photos: [] });
    }

    const terms = search_terms.slice(0, 3);
    const results = [];

    for (const term of terms) {
      const cacheKey = term.trim().toLowerCase();
      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.ts < 1800000) { // 30 min
          results.push(...cached.photos);
          continue;
        }
      }

      try {
        const query = encodeURIComponent(term.trim());
        // Unsplash Source API — URL directa, sin key requerida
        const id = cacheKey.replace(/[^a-z0-9]/g, '-');
        const photo = {
          id: id,
          alt: term,
          photographer: 'Unsplash',
          url_medium: 'https://source.unsplash.com/800x500/?' + query,
          url_large: 'https://source.unsplash.com/1200x750/?' + query,
        };
        cache.set(cacheKey, { ts: Date.now(), photos: [photo] });
        results.push(photo);
      } catch (err) {
        console.error('Image fetch error for "' + term + '":', err.message);
      }
    }

    return Response.json({ photos: results });
  } catch (e) {
    console.error('getEducationalImages error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});