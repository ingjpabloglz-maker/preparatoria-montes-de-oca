import React from 'react';

// ─── Paleta de colores por tema ───────────────────────────────────────────────
const THEME_PALETTE = {
  math:       { accent: 'border-cyan-500/40',   header: 'bg-cyan-900/40 text-cyan-200',    tag: 'bg-cyan-500/20 text-cyan-300',    node: 'bg-cyan-900/50 border-cyan-500/40 text-cyan-200',  arrow: 'text-cyan-400', num: 'bg-cyan-600 text-white', line: 'bg-cyan-500/40' },
  science:    { accent: 'border-emerald-500/40', header: 'bg-emerald-900/40 text-emerald-200', tag: 'bg-emerald-500/20 text-emerald-300', node: 'bg-emerald-900/50 border-emerald-500/40 text-emerald-200', arrow: 'text-emerald-400', num: 'bg-emerald-600 text-white', line: 'bg-emerald-500/40' },
  humanities: { accent: 'border-amber-500/40',  header: 'bg-amber-900/30 text-amber-200',  tag: 'bg-amber-500/20 text-amber-300',  node: 'bg-amber-900/40 border-amber-500/40 text-amber-200',   arrow: 'text-amber-400', num: 'bg-amber-600 text-white', line: 'bg-amber-500/40' },
  tech:       { accent: 'border-violet-500/40', header: 'bg-violet-900/40 text-violet-200', tag: 'bg-violet-500/20 text-violet-300', node: 'bg-violet-900/50 border-violet-500/40 text-violet-200', arrow: 'text-violet-400', num: 'bg-violet-600 text-white', line: 'bg-violet-500/40' },
  economics:  { accent: 'border-yellow-500/40', header: 'bg-yellow-900/30 text-yellow-200', tag: 'bg-yellow-500/20 text-yellow-300', node: 'bg-yellow-900/40 border-yellow-500/40 text-yellow-200', arrow: 'text-yellow-400', num: 'bg-yellow-600 text-white', line: 'bg-yellow-500/40' },
  default:    { accent: 'border-slate-500/40',  header: 'bg-slate-800/60 text-slate-200',   tag: 'bg-slate-500/20 text-slate-300',   node: 'bg-slate-800/60 border-slate-500/40 text-slate-200',   arrow: 'text-slate-400', num: 'bg-slate-600 text-white', line: 'bg-slate-500/40' },
};

function BlockWrapper({ title, palette, children }) {
  return (
    <div className={`rounded-xl border ${palette.accent} bg-slate-900/40 overflow-hidden`}>
      {title && (
        <div className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide ${palette.header}`}>
          {title}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── TABLE ────────────────────────────────────────────────────────────────────
function TableBlock({ block, palette }) {
  // Soporta tanto block.headers/rows directo como block.data.headers/rows
  const headers = block.headers || block.data?.headers || [];
  const rows = block.rows || block.data?.rows || [];
  if (!headers.length) return null;
  return (
    <BlockWrapper title={block.title} palette={palette}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${palette.header} first:rounded-tl-lg last:rounded-tr-lg`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-white/80 border-t border-white/5">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockWrapper>
  );
}

// ─── COMPARISON ───────────────────────────────────────────────────────────────
function ComparisonBlock({ block, palette }) {
  const left_title = block.left_title || block.data?.left_title || 'A';
  const right_title = block.right_title || block.data?.right_title || 'B';
  const left_items = block.left_items || block.data?.left_items || [];
  const right_items = block.right_items || block.data?.right_items || [];
  return (
    <BlockWrapper title={block.title} palette={palette}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={`text-xs font-bold uppercase tracking-wide mb-2 px-2 py-1 rounded-lg text-center ${palette.tag}`}>{left_title}</div>
          <ul className="space-y-1.5">
            {left_items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${palette.num.split(' ')[0]}`} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2 px-2 py-1 rounded-lg text-center bg-slate-700/50 text-slate-300">{right_title}</div>
          <ul className="space-y-1.5">
            {right_items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </BlockWrapper>
  );
}

// ─── STEPS ────────────────────────────────────────────────────────────────────
function StepsBlock({ block, palette }) {
  // Soporta items o steps (del backend viene items[], del spec también steps[])
  const items = block.items || block.data?.steps || block.data?.items || [];
  return (
    <BlockWrapper title={block.title} palette={palette}>
      <div className="space-y-0">
        {items.map((step, i) => (
          <div key={i} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${palette.num}`}>
                {i + 1}
              </div>
              {i < items.length - 1 && <div className={`w-0.5 flex-1 my-1 ${palette.line}`} />}
            </div>
            <div className={`pb-4 pt-1 text-sm text-white/85 ${i === items.length - 1 ? '' : ''}`}>
              {step}
            </div>
          </div>
        ))}
      </div>
    </BlockWrapper>
  );
}

// ─── EQUATION ─────────────────────────────────────────────────────────────────
function EquationBlock({ block, palette }) {
  // Soporta equations[] (array) o data.equation (string)
  const equations = block.equations || (block.data?.equation ? [block.data.equation] : []);
  const explanation = block.data?.explanation || '';
  return (
    <BlockWrapper title={block.title} palette={palette}>
      <div className="space-y-2">
        {equations.map((eq, i) => (
          <div key={i} className="bg-slate-950/60 rounded-xl px-4 py-3 text-center">
            <span className={`font-mono text-xl tracking-wide font-bold ${palette.tag.split(' ')[1]}`}>{eq}</span>
          </div>
        ))}
        {explanation && (
          <p className="text-xs text-white/55 text-center mt-1 leading-relaxed">{explanation}</p>
        )}
      </div>
    </BlockWrapper>
  );
}

// ─── FLOW ─────────────────────────────────────────────────────────────────────
function FlowBlock({ block, palette }) {
  // Soporta steps[] (del backend) o data.nodes[]
  const steps = block.steps || block.data?.nodes || [];
  return (
    <BlockWrapper title={block.title} palette={palette}>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div className={`border rounded-lg px-3 py-2 text-xs font-medium text-center max-w-[120px] ${palette.node}`}>
              {step}
            </div>
            {i < steps.length - 1 && (
              <span className={`text-lg font-bold ${palette.arrow}`}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </BlockWrapper>
  );
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
function TimelineBlock({ block, palette }) {
  const events = block.events || block.data?.events || [];
  return (
    <BlockWrapper title={block.title} palette={palette}>
      <div className="space-y-0">
        {events.map((ev, i) => (
          <div key={i} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${palette.num.split(' ')[0]}`} />
              {i < events.length - 1 && <div className={`w-0.5 flex-1 my-1 ${palette.line}`} />}
            </div>
            <div className="pb-3">
              <span className={`text-xs font-bold mr-2 ${palette.tag.split(' ')[1]}`}>{ev.year}</span>
              <span className="text-sm text-white/80">{ev.title || ev.event}</span>
            </div>
          </div>
        ))}
      </div>
    </BlockWrapper>
  );
}

// ─── MAP ──────────────────────────────────────────────────────────────────────
function MapBlock({ block, palette }) {
  // Soporta nodes[] (del backend) o data.center + data.branches
  const center = block.data?.center || block.title || '';
  const branches = block.data?.branches || (block.nodes ? block.nodes.map(n => n.label) : []);
  return (
    <BlockWrapper title={center ? undefined : block.title} palette={palette}>
      <div className="flex flex-col items-center gap-3">
        {center && (
          <div className={`border-2 rounded-xl px-4 py-2 text-sm font-bold text-center ${palette.node} ${palette.accent}`}>
            {center}
          </div>
        )}
        {branches.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {branches.map((b, i) => (
              <div key={i} className={`border rounded-lg px-3 py-1.5 text-xs font-medium ${palette.node}`}>
                {b}
              </div>
            ))}
          </div>
        )}
      </div>
    </BlockWrapper>
  );
}

// ─── FALLBACK ─────────────────────────────────────────────────────────────────
function FallbackBlock({ block }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-white/40 italic">Bloque visual: {block.type}</p>
    </div>
  );
}

// ─── MAIN RENDERER ────────────────────────────────────────────────────────────
export default function VisualBlockRenderer({ block, subjectType = 'default' }) {
  const palette = THEME_PALETTE[subjectType] || THEME_PALETTE.default;

  switch (block?.type) {
    case 'table':      return <TableBlock block={block} palette={palette} />;
    case 'comparison': return <ComparisonBlock block={block} palette={palette} />;
    case 'steps':      return <StepsBlock block={block} palette={palette} />;
    case 'equation':   return <EquationBlock block={block} palette={palette} />;
    case 'flow':       return <FlowBlock block={block} palette={palette} />;
    case 'timeline':   return <TimelineBlock block={block} palette={palette} />;
    case 'map':        return <MapBlock block={block} palette={palette} />;
    default:           return <FallbackBlock block={block} />;
  }
}