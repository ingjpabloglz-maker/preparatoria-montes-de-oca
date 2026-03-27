import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function AssistantBubble({ message, visible, onDismiss }) {
  return (
    <AnimatePresence>
      {visible && message && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          className="fixed bottom-6 left-4 z-50 flex items-end gap-2 max-w-xs"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Avatar */}
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg flex-shrink-0"
          >
            <span className="text-2xl select-none">🦉</span>
          </motion.div>

          {/* Burbuja */}
          <div className="relative bg-white border border-violet-100 rounded-2xl rounded-bl-sm shadow-xl px-4 py-3 pr-8 max-w-[220px]">
            <p className="text-sm text-gray-800 leading-snug font-medium">{message.text}</p>
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
  );
}