import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Normaliza LaTeX: convierte \(...\) y (...) con contenido LaTeX a $...$
 */
function normalizeLatex(text) {
  if (!text) return '';
  return text
    // \(...\) → $...$
    .replace(/\\\((.+?)\\\)/gs, '$$$1$$')
    // \[...\] → $$...$$
    .replace(/\\\[(.+?)\\\]/gs, '$$$$$1$$$$')
    // \begin{...}...\end{...} sin delimitadores → $$...$$
    .replace(/(?<!\$)(\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})(?!\$)/g,
      (match) => `$$${match}$$`)
    // Paréntesis con comandos LaTeX comunes: (\frac...) → $\frac...$
    .replace(/\(\\(frac|sqrt|mathbb|sum|int|prod|lim|infty|cdot|times|div|pm|leq|geq|neq|approx|equiv|in|notin|subset|cup|cap|forall|exists|partial|nabla|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega)[^)]*\)/g,
      (match) => `$${match.slice(1, -1)}$`);
}

/**
 * Componente para renderizar contenido educativo con Markdown + LaTeX.
 * 
 * Uso: <RichContentRenderer content={text} inline={true} className="..." />
 * 
 * - inline=true: envuelve en <span> (para opciones, etiquetas cortas)
 * - inline=false (default): renderizado de bloque completo con Markdown
 */
export default function RichContentRenderer({ content, inline = false, className = '' }) {
  const normalized = normalizeLatex(content);

  if (inline) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ p: ({ children }) => <span className={className}>{children}</span> }}
      >
        {normalized || ''}
      </ReactMarkdown>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      className={className}
    >
      {normalized || ''}
    </ReactMarkdown>
  );
}