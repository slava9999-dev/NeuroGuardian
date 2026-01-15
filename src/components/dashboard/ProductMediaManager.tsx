// ============================================
// NeuroGUARDIAN — Product Media Manager
// Manage product images, uploads, and AI processing
// Version: 1.0.0 | Date: January 2026
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import type { Product, MediaAsset } from '../../types';
import { LazyImage } from '../ui/LazyImage';
import { hapticFeedback } from '../../lib/telegram';

interface ProductMediaManagerProps {
  product: Product;
  onUpdate: (newAsset?: MediaAsset) => void;
}

export function ProductMediaManager({ product, onUpdate }: ProductMediaManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Group assets by type for easier display
  const originalAssets = product.mediaAssets?.filter(a => a.type === 'original') || [];
  const processedAssets = product.mediaAssets?.filter(a => a.type !== 'original') || [];

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    hapticFeedback('medium');

    try {
      const file = files[0];

      // Convert to Base64 for simple upload via JSON API
      // In production with large files, use FormData or presigned URLs
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async () => {
        const base64 = reader.result?.toString().split(',')[1];

        interface TelegramWebApp {
          initData?: string;
        }
        const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
          ?.WebApp;
        const initData = tg?.initData || 'demo';

        const response = await fetch('/api?action=media-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Init-Data': initData,
          },
          body: JSON.stringify({
            action: 'media-upload',
            userId: product.userId,
            productId: product.productId,
            imageBase64: base64,
            autoAnalyze: true, // Default to analysis
            autoProcess: false, // Optional auto-render
          }),
        });

        const data = await response.json();
        if (data.success) {
          hapticFeedback('success');
          // In a real app, we'd add the optimistic asset or poll for update
          if (data.asset) {
            onUpdate(data.asset);
          } else {
            onUpdate();
          }
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      };
    } catch (error) {
      console.error('Upload failed:', error);
      hapticFeedback('error');
      alert('Ошибка загрузки: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsUploading(false);
    }
  };

  const handleImportFromUrl = async () => {
    if (!product.imageUrl) return;

    setIsUploading(true);
    hapticFeedback('medium');

    try {
      interface TelegramWebApp {
        initData?: string;
      }
      const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
      const initData = tg?.initData || 'demo';

      const response = await fetch('/api?action=media-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': initData,
        },
        body: JSON.stringify({
          action: 'media-upload',
          userId: product.userId,
          productId: product.productId,
          imageUrl: product.imageUrl,
          autoAnalyze: true,
          autoProcess: false,
        }),
      });

      const data = await response.json();
      if (data.success) {
        hapticFeedback('success');
        if (data.asset) {
          onUpdate(data.asset);
        } else {
          onUpdate();
        }
      } else {
        throw new Error(data.error || 'Import failed');
      }
    } catch (error) {
      console.error('Import failed:', error);
      hapticFeedback('error');
      alert('Ошибка импорта: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-stone-300">Медиа и Vision</h3>
        <span className="text-xs text-stone-500">{(product.mediaAssets || []).length} фото</span>
      </div>

      {/* Upload Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all
          ${dragActive ? 'border-violet-500 bg-violet-500/10' : 'border-stone-700 hover:border-stone-600'}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDrop={e => {
          e.preventDefault();
          setDragActive(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        onDragOver={e => e.preventDefault()}
      >
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={e => handleFileUpload(e.target.files)}
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <div className="relative">
              <div className="animate-spin text-2xl">⏳</div>
              <div className="absolute inset-0 blur-xl bg-violet-500/20 animate-pulse" />
            </div>
          ) : (
            <div className="text-3xl filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
              📸
            </div>
          )}
          <p className="text-sm font-medium bg-linear-to-r from-stone-300 to-stone-500 bg-clip-text text-transparent">
            {isUploading
              ? 'Искусственный интеллект анализирует...'
              : 'Нажмите или перетащите фото для Vision-анализа'}
          </p>
          {!isUploading && (
            <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-widest font-bold">
              Поддерживается RAW, JPG, PNG
            </p>
          )}
        </div>
      </div>

      {/* Import Suggestion if no assets but marketplace image exists */}
      {originalAssets.length === 0 && product.imageUrl && (
        <button
          onClick={handleImportFromUrl}
          disabled={isUploading}
          className="w-full py-4 bg-linear-to-r from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800 border border-stone-700/50 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 group active:scale-95"
        >
          <span className="text-xl group-hover:rotate-12 transition-transform">☁️</span>
          <div className="text-left">
            <div className="text-sm font-bold text-stone-200">Импорт с маркетплейса</div>
            <div className="text-[10px] text-stone-500">Автозагрузка оригинала и Vision-анализ</div>
          </div>
        </button>
      )}

      {/* Gallery Grid */}

      {/* Gallery Grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Render existing assets */}
        {originalAssets.map(asset => (
          <MediaAssetCard key={asset.id} asset={asset} />
        ))}
        {processedAssets.map(asset => (
          <MediaAssetCard key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}

function MediaAssetCard({ asset }: { asset: MediaAsset }) {
  const [showDetails, setShowDetails] = useState(false);

  const statusIcons = {
    uploading: '⏳',
    analyzing: '🧠',
    processing: '⚙️',
    ready: '✅',
    failed: '❌',
  };

  const typeLabels = {
    original: 'RAW',
    white_bg: 'WB',
    lifestyle: 'Life',
    watermarked: 'WM',
    thumbnail: 'Thumb',
  };

  const vision = asset.visionMetadata as any;
  const qualityScore = vision?.overall_quality || 0;

  return (
    <div
      className="relative aspect-square rounded-lg overflow-hidden bg-stone-800 group cursor-pointer border border-stone-700/50"
      onClick={() => setShowDetails(!showDetails)}
    >
      {asset.originalUrl ? (
        <LazyImage
          src={asset.processedUrl || asset.originalUrl}
          alt={asset.type}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-stone-600 italic text-[10px]">
          {asset.status === 'uploading' ? 'Загрузка...' : 'Ошибка'}
        </div>
      )}

      {/* Quality Badge (Minimal) */}
      {qualityScore > 0 && asset.status === 'ready' && (
        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1 shadow-lg">
          <span
            className={
              qualityScore >= 7
                ? 'text-green-400'
                : qualityScore >= 5
                  ? 'text-yellow-400'
                  : 'text-red-400'
            }
          >
            {qualityScore}/10
          </span>
        </div>
      )}

      {/* Compliance Indicators */}
      {asset.status === 'ready' && vision && (
        <div className="absolute top-1 left-1 flex gap-1 opacity-80">
          {vision.wb_compliant && (
            <div
              className="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
              title="WB Compliant"
            >
              W
            </div>
          )}
          {vision.ozon_compliant && (
            <div
              className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
              title="Ozon Compliant"
            >
              O
            </div>
          )}
        </div>
      )}

      {/* Overlay Info */}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-1.5 flex justify-between items-center">
        <span className="text-[10px] font-mono font-bold text-stone-300">
          {typeLabels[asset.type] || asset.type}
        </span>
        <span className="text-xs">{statusIcons[asset.status] || ''}</span>
      </div>

      {/* Full Details Modal (Simulated inside the card or via portal) */}
      <AnimatePresence>
        {showDetails && asset.status === 'ready' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-20 bg-stone-900/95 p-2 flex flex-col gap-2 overflow-y-auto"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Vision Analysis
              </span>
              <button
                onClick={() => setShowDetails(false)}
                className="text-stone-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1 rounded bg-stone-800 border border-stone-700">
                <div className="text-[8px] text-stone-500 uppercase">Освещение</div>
                <div className="text-xs font-bold">{vision.lighting_score}/10</div>
              </div>
              <div className="p-1 rounded bg-stone-800 border border-stone-700">
                <div className="text-[8px] text-stone-500 uppercase">Резкость</div>
                <div className="text-xs font-bold">{vision.sharpness_score}/10</div>
              </div>
            </div>

            {/* Tags */}
            {vision.texture_tags?.length > 0 && (
              <div>
                <div className="text-[8px] text-stone-500 uppercase mb-1">Фактура</div>
                <div className="flex flex-wrap gap-1">
                  {vision.texture_tags.slice(0, 3).map((tag: string) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Compliance Issues */}
            {(vision.wb_issues?.length > 0 || vision.ozon_issues?.length > 0) && (
              <div className="mt-auto">
                <div className="text-[8px] text-red-500 uppercase mb-1 font-bold">Ошибки</div>
                <div className="text-[9px] text-stone-300 line-clamp-2">
                  {[...(vision.wb_issues || []), ...(vision.ozon_issues || [])][0]}
                </div>
              </div>
            )}

            <button
              className="w-full py-1 mt-auto text-[10px] bg-stone-700 hover:bg-stone-600 rounded transition-colors"
              onClick={() => {
                /* Open full screen or zoom */
              }}
            >
              Подробнее
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
