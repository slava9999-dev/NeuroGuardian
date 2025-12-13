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

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  const imageSrc = hasError ? (fallbackSrc || PLACEHOLDER) : src;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Placeholder / Loading state */}
      {!isLoaded && (
        <div 
          className="absolute inset-0 bg-stone-800 animate-pulse"
          aria-hidden="true"
        />
      )}
      
      {/* Actual image */}
      <img
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`
          w-full h-full object-cover
          transition-opacity duration-300
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
        `}
      />
    </div>
  );
}
