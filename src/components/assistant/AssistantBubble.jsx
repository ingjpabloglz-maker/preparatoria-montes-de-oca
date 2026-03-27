import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

// Anillos de onda animados (tipo audio/voz)
function PulseRings({ active }) {
  if (!active) return null;
  return (
    <>
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2 border-violet-400/40"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1 + i * 0.35, opacity: 0 }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'easeOut',
          }}
        />
      ))}
    </>
  );
}

export default function AssistantBubble({ message, visible, onDismiss }) {
  const isReactive = message?.isReactive;

  return (
    <AnimatePresence>
      {visible && message && (
        <motion.div
          key={message.text}
          initial={{ opacity: 0, y: -20, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="fixed z-[9999] flex flex-col items-center gap-2 pointer-events-auto"
          style={{
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {/* Círculo IA */}
          <motion.div
            className="relative flex items-center justify-center"
            style={{ width: 56, height: 56 }}
          >
            {/* Anillos de onda */}
            <PulseRings active={isReactive} />

            {/* Glow de fondo */}
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={
                isReactive
                  ? {
                      boxShadow: [
                        '0 0 0px 0px rgba(139,92,246,0)',
                        '0 0 18px 6px rgba(139,92,246,0.45)',
                        '0 0 8px 2px rgba(139,92,246,0.2)',
                      ],
                    }
                  : {
                      boxShadow: [
                        '0 0 6px 2px rgba(139,92,246,0.15)',
                        '0 0 12px 4px rgba(139,92,246,0.28)',
                        '0 0 6px 2px rgba(139,92,246,0.15)',
                      ],
                    }
              }
              transition={{ duration: isReactive ? 0.8 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Círculo principal */}
            <motion.div
              className="relative w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 flex items-center justify-center shadow-lg"
              animate={
                isReactive
                  ? { scale: [1, 1.08, 1] }
                  : { scale: [1, 1.03, 1] }
              }
              transition={{
                duration: isReactive ? 0.9 : 2.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {/* Puntos internos tipo audio */}
              <div className="flex items-end gap-[3px] h-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-[3px] rounded-full bg-white/90"
                    animate={
                      isReactive
                        ? { height: ['4px', `${8 + (i % 3) * 6}px`, '4px'] }
                        : { height: ['4px', `${5 + (i % 2) * 3}px`, '4px'] }
                    }
                    transition={{
                      duration: isReactive ? 0.5 : 1.4,
                      repeat: Infinity,
                      delay: i * 0.1,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Burbuja de mensaje */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.3 }}
            className="relative max-w-[260px] sm:max-w-xs"
          >
            <div
              className={`relative rounded-2xl px-4 py-2.5 pr-8 shadow-xl border backdrop-blur-sm ${
                isReactive
                  ? 'bg-white/95 border-violet-200 shadow-violet-100'
                  : 'bg-white/90 border-gray-200'
              }`}
            >
              {/* Triángulo apuntando hacia arriba */}
              <div
                className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 ${
                  isReactive ? 'bg-white border-l border-t border-violet-200' : 'bg-white border-l border-t border-gray-200'
                }`}
              />
              <p className="text-sm text-gray-800 leading-snug font-semibold text-center">
                {message.text}
              </p>
              <button
                onClick={onDismiss}
                className="absolute top-1.5 right-1.5 text-gray-300 hover:text-gray-500 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}