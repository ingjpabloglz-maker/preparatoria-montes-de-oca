import React, { useState, useEffect } from 'react';
import { X, ZoomIn } from 'lucide-react';

const PEXELS_API_KEY = 'Bh3HPfLjG7N3bvjNj7bAekq3SThqD5fHWLWwHPGKOAphYqUgzZDTkJq0';

// Lightbox simple
function Lightbox({ image, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 rounded-full p-2"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={image.src.large}
        alt={image.alt}
        className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {image.photographer && (
        <p className="absolute bottom-4 text-white/40 text-xs">
          📷 {image.photographer} · Pexels
        </p>
      )}
    </div>
  );
}

// Un bloque de imagen individual
function ImageCard({ photo, onClick }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="relative group cursor-pointer rounded-xl overflow-hidden border border-white/10 bg-white/5 aspect-video"
      onClick={() => onClick(photo)}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-white/5 animate-pulse rounded-xl" />
      )}
      <img
        src={photo.src.medium}
        alt={photo.alt || 'Imagen educativa'}
        loading="lazy"
        className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
        <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EducationalImages({ imageSearchTerms }) {
  const [photos, setPhotos] = useState([]);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!imageSearchTerms || imageSearchTerms.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setPhotos([]);

    const fetchImages = async () => {
      const results = [];
      // Buscar 1 imagen por término (máx 3 términos)
      const terms = imageSearchTerms.slice(0, 3);
      for (const term of terms) {
        try {
          const res = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=1&orientation=landscape`,
            { headers: { Authorization: PEXELS_API_KEY } }
          );
          if (!res.ok) continue;
          const data = await res.json();
          if (data.photos && data.photos.length > 0) {
            results.push(data.photos[0]);
          }
        } catch (_) {
          // silencioso — si falla un término, continúa
        }
      }
      if (!cancelled) {
        setPhotos(results);
        setLoading(false);
      }
    };

    fetchImages();
    return () => { cancelled = true; };
  }, [JSON.stringify(imageSearchTerms)]);

  // No renderizar nada si no hay términos o no hay fotos
  if (!imageSearchTerms || imageSearchTerms.length === 0) return null;
  if (!loading && photos.length === 0) return null;

  return (
    <>
      <div className="max-w-lg w-full mb-4">
        <div className="flex items-center gap-2 px-1 mb-3">
          <span className="text-base">🖼️</span>
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Apoyo visual</span>
        </div>

        {loading ? (
          <div className={`grid gap-2 ${imageSearchTerms.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {imageSearchTerms.slice(0, 3).map((_, i) => (
              <div key={i} className="aspect-video rounded-xl bg-white/5 animate-pulse border border-white/10" />
            ))}
          </div>
        ) : (
          <div className={`grid gap-2 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {photos.map((photo) => (
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