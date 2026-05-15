import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ image, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 rounded-full p-2"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={image.url_large || image.url}
        alt={image.alt}
        className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {image.author && (
        <p className="absolute bottom-4 text-white/40 text-xs">
          📷 {image.author} · {image.source || 'Pixabay'}
        </p>
      )}
    </div>
  );
}

// ─── ImageCard ────────────────────────────────────────────────────────────────
function ImageCard({ photo, onClick }) {
  const [status, setStatus] = useState('loading'); // loading | loaded | error

  return (
    <div
      className="relative group cursor-pointer rounded-xl overflow-hidden border border-white/10 bg-white/5 aspect-video"
      onClick={() => status === 'loaded' && onClick(photo)}
    >
      {/* Skeleton while loading */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-white/5 animate-pulse rounded-xl" />
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">
          —
        </div>
      )}

      {/* Image */}
      {status !== 'error' && (
        <img
          src={photo.url}
          alt={photo.alt || 'Imagen educativa'}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}

      {/* Hover overlay */}
      {status === 'loaded' && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EducationalImages({ imageSearchTerms }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const termsKey = useRef('');

  useEffect(() => {
    if (!imageSearchTerms || imageSearchTerms.length === 0) return;

    const key = imageSearchTerms.join('|');
    if (key === termsKey.current) return; // avoid re-fetch on same terms
    termsKey.current = key;

    let cancelled = false;
    setLoading(true);
    setPhotos([]);

    base44.functions.invoke('getEducationalImages', {
      search_terms: imageSearchTerms,
      limit: 1,
    })
      .then((res) => {
        if (cancelled) return;
        const fetched = res.data?.photos || [];
        setPhotos(fetched);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[EducationalImages] fetch error:', err);
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [imageSearchTerms]);

  if (!imageSearchTerms || imageSearchTerms.length === 0) return null;

  // Hide section entirely if nothing to show and not loading
  if (!loading && photos.length === 0) return null;

  const visiblePhotos = photos.filter(Boolean);

  return (
    <>
      <div className="max-w-lg w-full mb-4">
        <div className="flex items-center gap-2 px-1 mb-3">
          <span className="text-base">🖼️</span>
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">
            Apoyo visual — imágenes reales
          </span>
        </div>

        {loading ? (
          <div className={`grid gap-2 ${imageSearchTerms.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {imageSearchTerms.slice(0, 3).map((_, i) => (
              <div key={i} className="aspect-video rounded-xl bg-white/5 animate-pulse border border-white/10" />
            ))}
          </div>
        ) : (
          <div className={`grid gap-2 ${visiblePhotos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {visiblePhotos.map((photo) => (
              <ImageCard key={photo.id} photo={photo} onClick={setLightboxPhoto} />
            ))}
          </div>
        )}
      </div>

      {lightboxPhoto && (
        <Lightbox image={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      )}
    </>
  );
}