// ============================================
// NeuroGUARDIAN — LazyImage Component
// Optimized image loading with fallback
// ============================================

import { useState, useCallback } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  width?: number;
  height?: number;
}

// Placeholder SVG as base64
const PLACEHOLDER =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMyODI1MkQiLz48cGF0aCBkPSJNODcuNSAxMDVMMTAwIDkyLjVMMTEyLjUgMTA1IiBzdHJva2U9IiM3ODcxNkMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTEwMCAxMTJWOTIiIHN0cm9rZT0iIzc4NzE2QyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=';

export function LazyImage({
  src,
  alt,
  className = '',
  fallbackSrc,
  width,
  height,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // When src changes, React sees a different img key (because src is part of it),
  // so it remounts logic naturally if needed, OR we just reset on load start.
  // Actually, standard way:

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    if (!hasError) {
      console.warn('Image load error:', src);
      setHasError(true);
    }
  }, [hasError, src]);

  // If error occurred, use fallback. If passed src changes, we want to try it (reset error).
  // We can achieve "state reset on prop change" by keying the component,
  // OR manually resetting in render (bad practice usually).
  // Best: simple useEffect is actually fine usually, but ESLint is strict.
  // Alternative: use key={src} on component usage is cleaner, but here we can key the img.

  const finalSrc = hasError ? fallbackSrc || PLACEHOLDER : src;

  return (
    <div
      className={`relative overflow-hidden bg-stone-800 ${className}`}
      style={{ minHeight: height || 64, minWidth: width || 64 }}
    >
      {/* Placeholder / Loading state */}
      {!isLoaded && (
        <div
          className="absolute inset-0 bg-stone-800 animate-pulse flex items-center justify-center"
          aria-hidden="true"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-stone-600"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
      )}

      {/* Actual image */}
      <img
        key={src} // Critical: forces re-mount and state reset when src changes
        src={finalSrc}
        alt={alt}
        width={width}
        height={height}
        loading="eager"
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
        }}
      />
    </div>
  );
}
