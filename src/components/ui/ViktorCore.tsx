import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../stores';
import { useState } from 'react';

interface ViktorCoreProps {
  size?: 'sm' | 'md' | 'lg';
  status?: 'idle' | 'processing' | 'alert' | 'success';
}

export function ViktorCore({ size = 'md', status: manualStatus }: ViktorCoreProps) {
  const isProcessing = useChatStore(state => state.isProcessing);

  // Use manual status if provided, otherwise derive from global state
  const status = manualStatus || (isProcessing ? 'processing' : 'idle');

  const containerSizes = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
  };

  const ringSizes = {
    sm: 'w-20 h-20',
    md: 'w-40 h-40',
    lg: 'w-60 h-60',
  };

  const colors = {
    idle: {
      core: 'bg-violet-500',
      glow: 'rgba(139, 92, 246, 0.4)',
      aura: 'rgba(139, 92, 246, 0.1)',
    },
    processing: {
      core: 'bg-indigo-400',
      glow: 'rgba(129, 140, 248, 0.6)',
      aura: 'rgba(129, 140, 248, 0.2)',
    },
    alert: {
      core: 'bg-rose-500',
      glow: 'rgba(244, 63, 94, 0.6)',
      aura: 'rgba(244, 63, 94, 0.2)',
    },
    success: {
      core: 'bg-emerald-500',
      glow: 'rgba(16, 185, 129, 0.6)',
      aura: 'rgba(16, 185, 129, 0.2)',
    },
  };

  const activeColor = colors[status] || colors.idle;

  // Generate stable random offsets for particles
  const [particles] = useState(() =>
    [...Array(4)].map(() => ({
      x: (Math.random() - 0.5) * 150,
      y: (Math.random() - 0.5) * 150,
      delay: Math.random() * 0.5,
    }))
  );

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer Atmosphere / Aura */}
      <motion.div
        className={`absolute rounded-full pointer-events-none blur-3xl ${ringSizes[size]}`}
        style={{ backgroundColor: activeColor.aura }}
        animate={{
          scale: status === 'processing' ? [1, 1.3, 1] : [1, 1.15, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: status === 'processing' ? 1.5 : 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Orbiting Quantum Particles */}
      <AnimatePresence>
        {status === 'processing' && (
          <div className="absolute inset-0 pointer-events-none">
            {particles.map((p, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]"
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: [0, p.x],
                  y: [0, p.y],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: p.delay,
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* The Core Orb */}
      <motion.div
        className={`${containerSizes[size]} relative rounded-full z-10 p-1 border border-white/10 overflow-hidden shadow-2xl`}
        animate={{
          rotate: status === 'processing' ? 360 : 0,
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {/* Particle Fluid Interior */}
        <div className="absolute inset-0 bg-surface rounded-full overflow-hidden">
          <motion.div
            className={`absolute inset-[-50%] ${activeColor.core} opacity-30 rounded-full blur-2xl`}
            animate={{
              x: ['-20%', '20%', '-20%'],
              y: ['-20%', '20%', '-20%'],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: status === 'processing' ? 2 : 6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <img
            src="/agent-avatar.png"
            className={`w-full h-full object-cover rounded-full z-20 relative mix-blend-overlay ${status === 'processing' ? 'brightness-125' : 'brightness-90'}`}
            alt="Viktor Core"
          />
        </div>

        {/* Surface Reflections */ [28, 4 + 28, 5]}
        <div className="absolute inset-0 rounded-full border border-white/10 z-30 pointer-events-none bg-linear-to-tr from-white/10 via-transparent to-white/5 opacity-50" />
      </motion.div>

      {/* Status Ring */}
      <motion.div
        className={`absolute rounded-full border-2 z-40 ${containerSizes[size]} pointer-events-none`}
        style={{ borderColor: activeColor.core, opacity: 0.2 }}
        animate={{
          scale: status === 'processing' ? [1, 1.05, 1] : 1,
          opacity: status === 'processing' ? [0.2, 0.5, 0.2] : 0.2,
        }}
        transition={{ duration: 0.5, repeat: Infinity }}
      />
    </div>
  );
}
