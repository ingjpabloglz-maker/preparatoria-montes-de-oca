import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

/**
 * MathText - Renderiza texto con expresiones LaTeX embebidas.
 * Soporta:
 *   - Bloques: $$...$$ o \[...\]
 *   - Inline: $...$ o \(...\)
 * El texto sin fórmulas se muestra tal cual.
 */
export default function MathText({ text, className = '' }) {
  if (!text) return null;

  // Divide el texto en segmentos: bloques ($$...$$), inline ($...$), y texto plano
  const parts = [];
  // Regex que captura: $$...$$ | \[...\] | $...$ | \(...\)
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([^)]+?\\\))/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Texto antes de la fórmula
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const raw = match[0];

    if (raw.startsWith('$$') || raw.startsWith('\\[')) {
      const inner = raw.startsWith('$$')
        ? raw.slice(2, -2)
        : raw.slice(2, -2);
      parts.push({ type: 'block', content: inner.trim() });
    } else {
      const inner = raw.startsWith('$')
        ? raw.slice(1, -1)
        : raw.slice(2, -2);
      parts.push({ type: 'inline', content: inner.trim() });
    }

    lastIndex = match.index + raw.length;
  }

  // Texto restante
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // Si no hay fórmulas, devuelve el texto directamente
  if (parts.length === 0 || parts.every(p => p.type === 'text')) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === 'block') {
          return (
            <span key={i} className="block my-3 text-center overflow-x-auto">
              <BlockMath math={part.content} />
            </span>
          );
        }
        if (part.type === 'inline') {
          return <InlineMath key={i} math={part.content} />;
        }
        return <span key={i}>{part.content}</span>;
      })}
    </span>
  );
}