// ============================================
// NeuroGUARDIAN — Product Media Modal
// Container for ProductMediaManager
// Version: 1.0.0 | Date: January 2026
// ============================================

import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, MediaAsset } from '../../types';
import { ProductMediaManager } from './ProductMediaManager';

interface ProductMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onUpdate: (newAsset?: MediaAsset) => void;
}

export function ProductMediaModal({ isOpen, onClose, product, onUpdate }: ProductMediaModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/95 backdrop-blur-md z-10 sticky top-0">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-2xl">📸</span>
              {product.title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-stone-800 text-stone-400 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Content (Scrollable) */}
          <div className="p-4 overflow-y-auto">
            <ProductMediaManager product={product} onUpdate={onUpdate} />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
