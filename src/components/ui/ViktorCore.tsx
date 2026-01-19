import { motion } from 'framer-motion';
import { useChatStore } from '../../stores';

interface ViktorCoreProps {
  size?: 'sm' | 'md' | 'lg';
  status?: 'idle' | 'processing' | 'alert' | 'success';
}

export function ViktorCore({ size = 'md', status: manualStatus }: ViktorCoreProps) {
  const isProcessing = useChatStore(state => state.isProcessing);
  const status = manualStatus || (isProcessing ? 'processing' : 'idle');

  const containerSizes = {
    sm: 'w-12 h-12',
    md: 'w-24 h-24',
    lg: 'w-32 h-32', // Slightly smaller than the orb to look realistic
  };

  const statusColors = {
    idle: 'border-slate-200 shadow-[0_0_20px_rgba(15,23,42,0.08)]',
    processing: 'border-primary shadow-[0_0_24px_var(--color-primary-dim)]',
    alert: 'border-rose-300 shadow-[0_0_24px_rgba(244,63,94,0.2)]',
    success: 'border-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.2)]',
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Ambient Ring */}
      <motion.div
        className={`absolute rounded-full ${containerSizes[size]} border border-slate-200/80`}
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.35, 0.6, 0.35],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Pulse Status Ring */}
      {status !== 'idle' && (
        <motion.div
          className={`absolute rounded-full border-2 ${containerSizes[size]} opacity-50`}
          style={{
            borderColor:
              status === 'processing' ? '#6366f1' : status === 'alert' ? '#f43f5e' : '#10b981',
          }}
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Main Avatar Container */}
      <motion.div
        className={`${containerSizes[size]} relative rounded-2xl overflow-hidden border-2 bg-white shadow-2xl z-10 transition-colors duration-500 ${statusColors[status]}`}
        layout
        animate={{ scale: [1, 1.02, 1], rotate: [0, 0.4, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <img
          src="/viktor-human.png"
          className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
          alt="8:B>@"
        />

        {/* Glass Reflection Overlay */}
        <div className="absolute inset-0 bg-linear-to-tr from-white/25 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-slate-200/40 pointer-events-none" />

        {/* Processing Waveform Overlay */}
        {status === 'processing' && (
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-linear-to-t from-indigo-400/30 to-transparent flex items-end justify-center pb-2 gap-1 pointer-events-none">
            {[1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                className="w-1 bg-indigo-500/70 rounded-full"
                animate={{ height: [4, 12, 4] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        )}

        {/* Subtle scan line */}
        <motion.div
          className="absolute inset-x-0 top-0 h-1 bg-primary/30"
          animate={{ y: ['0%', '100%', '0%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
}
