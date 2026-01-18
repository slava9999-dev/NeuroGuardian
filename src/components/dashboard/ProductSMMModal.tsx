import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Wand2, Copy, Check, MessageSquare, RefreshCw } from 'lucide-react';
import type { Product } from '../../types';
import { contentApi } from '../../lib/api';
import { hapticFeedback } from '../../lib/telegram';
import { ViktorCore } from '../ui/ViktorCore';

interface ProductSMMModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

type Tone = 'selling' | 'informative' | 'bold' | 'storytelling';

export function ProductSMMModal({ isOpen, onClose, product }: ProductSMMModalProps) {
  const [tone, setTone] = useState<Tone>('selling');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    hapticFeedback('medium');
    setIsGenerating(true);
    setResult('');

    try {
      const res = await contentApi.generate({
        productId: product.id,
        platform: 'telegram',
        style: tone,
      });

      if (res.success) {
        setResult(res.content);
        hapticFeedback('success');
      } else {
        setResult(`Ошибка: ${res.error || 'Не удалось создать описание'}`);
        hapticFeedback('error');
      }
    } catch (e) {
      console.error(e);
      setResult('Ошибка соединения. Проверьте сеть.');
      hapticFeedback('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    hapticFeedback('light');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ y: '100%', opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: '100%', opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">AI Копирайтер</h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Генерация описания для товара
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Product Context */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <img
              src={product.imageUrl}
              className="w-12 h-12 object-cover rounded-lg bg-white"
              alt="mini"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{product.title}</p>
              <p className="text-[10px] text-slate-500 border-t border-slate-200 mt-1 pt-1 inline-flex gap-2">
                <span>{product.currentPrice}₽</span>
                <span className="text-slate-300">|</span>
                <span>Арт: {product.nmId || product.id}</span>
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['selling', 'informative', 'bold', 'storytelling'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wide rounded-lg border transition-all ${
                  tone === t
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-500'
                }`}
              >
                {t === 'selling' && 'Продающий'}
                {t === 'informative' && 'Инфо'}
                {t === 'bold' && 'Дерзкий'}
                {t === 'storytelling' && 'Истории'}
              </button>
            ))}
          </div>

          {/* Result Area */}
          <div className="relative min-h-[160px] bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/50 backdrop-blur-sm z-10 transition-all">
                <ViktorCore size="sm" status="processing" />
                <p className="text-xs font-bold text-indigo-600 animate-pulse">
                  Виктор пишет текст...
                </p>
              </div>
            ) : !result ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 opacity-60">
                <MessageSquare className="w-8 h-8" />
                <p className="text-xs">Выберите стиль и нажмите "Создать"</p>
              </div>
            ) : (
              <textarea
                value={result}
                onChange={e => setResult(e.target.value)}
                className="w-full h-full bg-transparent border-none resize-none text-sm text-slate-700 outline-none leading-relaxed font-sans"
                rows={6}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          {result && (
            <button
              onClick={handleCopy}
              className="px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center"
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-500" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              'Генерирую...'
            ) : result ? (
              <>
                <RefreshCw className="w-4 h-4" /> Пересоздать
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" /> Создать описание
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
