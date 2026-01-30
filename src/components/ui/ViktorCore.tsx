import { motion } from 'framer-motion';
import { useChatStore } from '../../stores';

interface ViktorCoreProps {
  size?: 'sm' | 'md' | 'lg';
  status?: 'idle' | 'processing' | 'alert' | 'success';
  animate?: boolean;
}

export function ViktorCore({
  size = 'md',
  status: manualStatus,
  animate: forceAnimate = false,
}: ViktorCoreProps) {
  const isProcessing = useChatStore(state => state.isProcessing);
  const status = manualStatus || (isProcessing ? 'processing' : 'idle');

  const containerSizes = {
    sm: 'size-10',
    md: 'size-20',
    lg: 'size-28',
  };

  const statusColors = {
    idle: 'border-black/5 shadow-xl',
    processing: 'border-primary/40 shadow-[0_0_20px_rgba(0,0,0,0.05)]',
    alert: 'border-toxic-orange/40 shadow-[0_0_24px_rgba(255,107,0,0.1)]',
    success: 'border-peace-green/40 shadow-[0_0_24px_rgba(16,185,129,0.1)]',
  };

  const pulseColor = {
    idle: 'bg-black/5',
    processing: 'bg-primary/20',
    alert: 'bg-toxic-orange/20',
    success: 'bg-peace-green/20',
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Tactical Radar Ring */}
      <motion.div
        className={`absolute rounded-full ${containerSizes[size]} border border-black/[0.03]`}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />

      {/* Pulse Status Ring */}
      {(status !== 'idle' || forceAnimate) && (
        <motion.div
          className={`absolute rounded-full ${containerSizes[size]} ${pulseColor[status]} blur-xl opacity-30`}
          animate={{
            scale: [1, 1.4, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Main Avatar Container */}
      <motion.div
        className={`${containerSizes[size]} relative rounded-3xl overflow-hidden border bg-white shadow-2xl z-10 transition-all duration-500 ${statusColors[status]}`}
        layout
        animate={{
          rotate: status === 'processing' ? [0, 1, -1, 0] : 0,
        }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        <img
          src="/viktor-human.png"
          className="w-full h-full object-cover grayscale-[0.3] transition-all duration-700 hover:grayscale-0"
          alt="Viktor Core"
        />

        {/* Tactical HUD Overlay (Glass) */}
        <div className="absolute inset-0 bg-linear-to-tr from-white/10 via-transparent to-black/[0.02] pointer-events-none" />

        {/* Processing Waveform (Compact Tactical) */}
        {status === 'processing' && (
          <div className="absolute inset-x-0 bottom-2 flex items-end justify-center gap-0.5 h-4 pointer-events-none">
            {[1, 2, 3, 4, 3, 2].map((i, idx) => (
              <motion.div
                key={idx}
                className="w-0.5 bg-primary/60 rounded-full"
                animate={{ height: [`${i * 20}%`, `${i * 30}%`, `${i * 20}%`] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: idx * 0.05,
                }}
              />
            ))}
          </div>
        )}

        {/* Scanning Sweep Line */}
        <motion.div
          className={`absolute inset-x-0 h-[1px] ${status === 'alert' ? 'bg-toxic-orange/40' : 'bg-primary/20'} z-20`}
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />

        {/* Success / Alert Flush */}
        <AnimatePresence>
          {(status === 'success' || status === 'alert') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 ${status === 'success' ? 'bg-peace-green' : 'bg-toxic-orange'}`}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
