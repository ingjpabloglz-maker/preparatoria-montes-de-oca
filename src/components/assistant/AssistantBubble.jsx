import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';

const BANNER_EVENTS = ['level_up', 'achievement_unlocked'];

// ─── ANILLOS DE PULSO ────────────────────────────────────────────────────────

function OrbPulseRings({ active }) {
  if (!active) return null;
  return (
    <>
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2 border-violet-400/40"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1 + i * 0.4, opacity: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.35, ease: 'easeOut' }}
        />
      ))}
    </>
  );
}

// ─── ORB FLOTANTE ────────────────────────────────────────────────────────────

function AssistantOrb({ message, visible, onDismiss, onCTA }) {
  const isReactive = message?.isReactive;
  const isUrgent = message?.priority === 'URGENT';
  const hasCTA = !!message?.callToAction;

  return (
    <div className="fixed bottom-5 right-5 z-[9990] flex flex-col items-end gap-2 pointer-events-none">
      {/* Tooltip de mensaje */}
      <AnimatePresence>
        {visible && message && (
          <motion.div
            key={message.text}
            initial={{ opacity: 0, x: 16, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="pointer-events-auto max-w-[240px] sm:max-w-[280px]"
          >
            <div className={`relative rounded-2xl px-4 py-3 pr-8 shadow-xl border backdrop-blur-sm ${
              isUrgent
                ? 'bg-red-50/95 border-red-200 shadow-red-100'
                : isReactive
                ? 'bg-white/95 border-violet-200 shadow-violet-100'
                : 'bg-white/90 border-gray-200'
            }`}>
              {/* Triángulo hacia el orb */}
              <div className={`absolute right-[-5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 ${
                isUrgent ? 'bg-red-50 border-r border-b border-red-200'
                  : isReactive ? 'bg-white border-r border-b border-violet-200'
                  : 'bg-white border-r border-b border-gray-200'
              }`} />

              <p className={`text-sm leading-snug font-semibold mb-0 ${isUrgent ? 'text-red-800' : 'text-gray-800'}`}>
                {message.text}
              </p>

              {/* Botón CTA */}
              {hasCTA && (
                <button
                  onClick={() => onCTA(message)}
                  className={`mt-2 flex items-center gap-1 text-xs font-bold rounded-lg px-2 py-1 transition-colors ${
                    isUrgent
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-violet-600 text-white hover:bg-violet-700'
                  }`}
                >
                  {message.callToAction.label}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}

              {/* Cerrar */}
              <button
                onClick={onDismiss}
                className="absolute top-1.5 right-1.5 text-gray-300 hover:text-gray-500 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orb */}
      <div className="pointer-events-auto relative flex items-center justify-center" style={{ width: 52, height: 52 }}>
        <OrbPulseRings active={isReactive || isUrgent} />

        {/* Glow */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={
            isUrgent
              ? { boxShadow: ['0 0 0px 0px rgba(239,68,68,0)', '0 0 20px 8px rgba(239,68,68,0.45)', '0 0 8px 2px rgba(239,68,68,0.2)'] }
              : isReactive
              ? { boxShadow: ['0 0 0px 0px rgba(139,92,246,0)', '0 0 20px 8px rgba(139,92,246,0.45)', '0 0 8px 2px rgba(139,92,246,0.2)'] }
              : { boxShadow: ['0 0 6px 2px rgba(139,92,246,0.12)', '0 0 14px 5px rgba(139,92,246,0.25)', '0 0 6px 2px rgba(139,92,246,0.12)'] }
          }
          transition={{ duration: (isReactive || isUrgent) ? 0.8 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Círculo principal */}
        <motion.div
          className={`relative w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-lg cursor-default ${
            isUrgent
              ? 'bg-gradient-to-br from-red-500 via-orange-500 to-yellow-400'
              : 'bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400'
          }`}
          animate={(isReactive || isUrgent) ? { scale: [1, 1.1, 1] } : { scale: [1, 1.04, 1] }}
          transition={{ duration: (isReactive || isUrgent) ? 0.85 : 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Barras de audio */}
          <div className="flex items-end gap-[3px] h-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-[3px] rounded-full bg-white/90"
                animate={
                  (isReactive || isUrgent)
                    ? { height: ['4px', `${8 + (i % 3) * 6}px`, '4px'] }
                    : { height: ['4px', `${5 + (i % 2) * 3}px`, '4px'] }
                }
                transition={{ duration: (isReactive || isUrgent) ? 0.5 : 1.5, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── BANNER SUPERIOR ─────────────────────────────────────────────────────────

function AssistantBanner({ message, visible, onDismiss, onCTA }) {
  const hasCTA = !!message?.callToAction;

  return (
    <AnimatePresence>
      {visible && message && (
        <motion.div
          key={message.text}
          initial={{ opacity: 0, y: -48 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -48 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className="fixed top-16 left-0 right-0 z-[9995] flex justify-center px-4 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white px-5 py-3 rounded-2xl shadow-2xl max-w-sm w-full sm:w-auto">
            <span className="text-sm font-bold flex-1 text-center">{message.text}</span>
            {hasCTA && (
              <button
                onClick={() => onCTA(message)}
                className="flex items-center gap-1 text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg px-2 py-1 transition-colors flex-shrink-0"
              >
                {message.callToAction.label} <ArrowRight className="w-3 h-3" />
              </button>
            )}
            <button onClick={onDismiss} className="text-white/70 hover:text-white transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function AssistantBubble({ message, visible, onDismiss, onCTA }) {
  const isBanner = BANNER_EVENTS.includes(message?.type);

  if (isBanner) {
    return <AssistantBanner message={message} visible={visible} onDismiss={onDismiss} onCTA={onCTA} />;
  }

  return <AssistantOrb message={message} visible={visible} onDismiss={onDismiss} onCTA={onCTA} />;
}