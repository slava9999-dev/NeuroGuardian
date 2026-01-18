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
    idle: 'border-slate-200 shadow-slate-100',
    processing: 'border-indigo-500 shadow-indigo-200',
    alert: 'border-rose-500 shadow-rose-200',
    success: 'border-emerald-500 shadow-emerald-200',
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse Status Ring (Only active when processing/alert) */}
      {status !== 'idle' && (
        <motion.div
          className={`absolute rounded-full border-2 ${containerSizes[size]} opacity-50`}
          style={{
            borderColor:
              status === 'processing' ? '#6366f1' : status === 'alert' ? '#f43f5e' : '#10b981',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Main Avatar Container */}
      <motion.div
        className={`${containerSizes[size]} relative rounded-2xl overflow-hidden border-2 bg-white shadow-xl z-10 transition-colors duration-500 ${statusColors[status]}`}
        layout
      >
        <img
          src="/viktor-human.png"
          className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
          alt="Viktor AI"
        />

        {/* Glass Reflection Overlay */}
        <div className="absolute inset-0 bg-linear-to-tr from-white/20 to-transparent pointer-events-none" />

        {/* Processing Waveform Overlay */}
        {status === 'processing' && (
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-linear-to-t from-indigo-900/60 to-transparent flex items-end justify-center pb-2 gap-1 pointer-events-none">
            {[1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                className="w-1 bg-white/80 rounded-full"
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
      </motion.div>
    </div>
  );
}
