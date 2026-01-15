// ============================================
// NeuroGUARDIAN — Product Media Manager
// Manage product images, uploads, and AI processing
// Version: 1.0.0 | Date: January 2026
// ============================================

import { useState } from 'react';

import type { Product, MediaAsset } from '../../types';
import { LazyImage } from '../ui/LazyImage';
import { hapticFeedback } from '../../lib/telegram';

interface ProductMediaManagerProps {
  product: Product;
  onUpdate: () => void;
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
          // For now, call onUpdate to refresh parent if possible
          onUpdate();
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
        onUpdate();
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
            <div className="animate-spin text-2xl">⏳</div>
          ) : (
            <div className="text-2xl">📸</div>
          )}
          <p className="text-sm text-stone-400">
            {isUploading ? 'Загрузка и анализ...' : 'Нажмите или перетащите фото'}
          </p>
        </div>
      </div>

      {/* Import Suggestion if no assets but marketplace image exists */}
      {originalAssets.length === 0 && product.imageUrl && (
        <button
          onClick={handleImportFromUrl}
          disabled={isUploading}
          className="w-full py-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <span>☁️</span>
          <span className="text-sm text-stone-300">Импортировать из маркетплейса</span>
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

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-stone-800 group">
      {asset.originalUrl ? (
        <LazyImage
          src={asset.processedUrl || asset.originalUrl}
          alt={asset.type}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-stone-600">No Img</div>
      )}

      {/* Overlay Info */}
      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 flex justify-between items-center backdrop-blur-xs">
        <span className="text-[10px] font-mono text-white px-1 rounded-sm bg-stone-700">
          {typeLabels[asset.type] || asset.type}
        </span>
        <span className="text-xs" title={asset.status}>
          {statusIcons[asset.status] || ''}
        </span>
      </div>

      {/* Hover Actions (Mock) */}
      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
        <button className="px-2 py-1 text-xs bg-violet-600 rounded-md text-white">
          Generate WB
        </button>
        <button className="px-2 py-1 text-xs bg-stone-600 rounded-md text-white">Analyze</button>
      </div>
    </div>
  );
}
