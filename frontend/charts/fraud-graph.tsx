"use client";

import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { Building2, Maximize2, User, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatCr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GraphLink, GraphNode } from "@/types/api";

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = Omit<GraphLink, "source" | "target"> & SimulationLinkDatum<SimNode> & { key: string };

const W = 900;
const H = 560;
const LINK_COLOR: Record<string, string> = {
  PAYS: "hsl(var(--chart-3))",
  INVOICES: "hsl(var(--chart-1))",
  DIRECTOR_OF: "hsl(var(--muted-foreground))",
};

function layout(nodes: GraphNode[], links: GraphLink[], borrowerId: string) {
  const simNodes: SimNode[] = nodes.map((n) => ({ ...n, ...(n.id === borrowerId ? { fx: W / 2, fy: H / 2 } : {}) }));
  const ids = new Set(simNodes.map((n) => n.id));
  const simLinks: SimLink[] = links
    .filter((l) => ids.has(l.source) && ids.has(l.target))
    .map((l, i) => ({ ...l, key: `${l.source}-${l.target}-${l.type}-${i}` }));
  const sim = forceSimulation<SimNode>(simNodes)
    .force("link", forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance((l) => (l.type === "DIRECTOR_OF" ? 95 : 210)).strength(0.55))
    .force("charge", forceManyBody().strength(-1100))
    .force("collide", forceCollide<SimNode>().radius((d) => d.size + 34))
    .force("x", forceX(W / 2).strength(0.025))
    .force("y", forceY(H / 2).strength(0.05))
    .stop();
  for (let i = 0; i < 320; i++) sim.tick();
  return { simNodes, simLinks };
}

export function FraudGraph({ nodes, links, borrowerId, onSelect, selectedId }: {
  nodes: GraphNode[]; links: GraphLink[]; borrowerId: string; onSelect?: (n: GraphNode | null) => void; selectedId?: string | null;
}) {
  const [showPeople, setShowPeople] = useState(true);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [flow, setFlow] = useState(true);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const visible = useMemo(() => {
    let ns = nodes.filter((n) => showPeople || n.type !== "person");
    if (flaggedOnly) ns = ns.filter((n) => n.flagged || n.id === borrowerId);
    const ids = new Set(ns.map((n) => n.id));
    return { ns, ls: links.filter((l) => ids.has(l.source) && ids.has(l.target)) };
  }, [nodes, links, showPeople, flaggedOnly, borrowerId]);

  const { simNodes, simLinks } = useMemo(() => layout(visible.ns, visible.ls, borrowerId), [visible, borrowerId]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  useEffect(() => setPositions(Object.fromEntries(simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]))), [simNodes]);

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    simLinks.forEach((l) => {
      const s = (l.source as SimNode).id;
      const t = (l.target as SimNode).id;
      m.set(s, (m.get(s) ?? new Set()).add(t));
      m.set(t, (m.get(t) ?? new Set()).add(s));
    });
    return m;
  }, [simLinks]);
  const focus = hover ?? selectedId ?? null;
  const dim = (id: string) => focus && id !== focus && !neighbours.get(focus)?.has(id);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const k = Math.min(2.5, Math.max(0.5, view.k * (e.deltaY < 0 ? 1.1 : 0.9)));
    setView((v) => ({ ...v, k }));
  }, [view.k]);

  const nodeDrag = useRef<string | null>(null);
  const toSvg = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-dots bg-[length:18px_18px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.08),transparent_65%)]" />
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
        <label className="flex items-center gap-1.5"><Switch checked={showPeople} onCheckedChange={setShowPeople} aria-label="Show directors" /> Directors</label>
        <label className="flex items-center gap-1.5"><Switch checked={flaggedOnly} onCheckedChange={setFlaggedOnly} aria-label="Flagged only" /> Flagged only</label>
        <label className="flex items-center gap-1.5"><Switch checked={flow} onCheckedChange={setFlow} aria-label="Animate money flow" /> Money flow</label>
        <span className="h-4 w-px bg-border" />
        <Button variant="ghost" size="icon-sm" className="h-7 w-7" onClick={() => setView((v) => ({ ...v, k: Math.min(2.5, v.k * 1.2) }))} aria-label="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon-sm" className="h-7 w-7" onClick={() => setView((v) => ({ ...v, k: Math.max(0.5, v.k / 1.2) }))} aria-label="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon-sm" className="h-7 w-7" onClick={() => setView({ x: 0, y: 0, k: 1 })} aria-label="Reset view"><Maximize2 className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-3 rounded-xl border border-border bg-surface/90 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: LINK_COLOR.PAYS }} />Payments</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: LINK_COLOR.INVOICES }} />Invoices</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t border-dashed border-muted-foreground" />Director of</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-destructive" />Suspicious loop</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[520px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label="Entity relationship graph"
        onWheel={onWheel}
        onPointerDown={(e) => { if (!nodeDrag.current) drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; }}
        onPointerMove={(e) => {
          if (nodeDrag.current) {
            const p = toSvg(e);
            setPositions((pos) => ({ ...pos, [nodeDrag.current!]: { x: (p.x - view.x - W / 2) / view.k + W / 2, y: (p.y - view.y - H / 2) / view.k + H / 2 } }));
          } else if (drag.current) {
            const rect = svgRef.current!.getBoundingClientRect();
            setView((v) => ({ ...v, x: drag.current!.vx + ((e.clientX - drag.current!.x) / rect.width) * W, y: drag.current!.vy + ((e.clientY - drag.current!.y) / rect.height) * H }));
          }
        }}
        onPointerUp={() => { drag.current = null; nodeDrag.current = null; }}
        onPointerLeave={() => { drag.current = null; nodeDrag.current = null; }}
        onClick={(e) => { if (e.target === svgRef.current) onSelect?.(null); }}
      >
        <defs>
          {Object.entries(LINK_COLOR).concat([["FLAG", "hsl(var(--destructive))"]]).map(([k, c]) => (
            <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
            </marker>
          ))}
        </defs>
        <g transform={`translate(${view.x + W / 2} ${view.y + H / 2}) scale(${view.k}) translate(${-W / 2} ${-H / 2})`}>
          {simLinks.map((l) => {
            const s = positions[(l.source as SimNode).id];
            const t = positions[(l.target as SimNode).id];
            if (!s || !t) return null;
            const target = simNodes.find((n) => n.id === (l.target as SimNode).id);
            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const len = Math.hypot(dx, dy) || 1;
            const pad = (target?.size ?? 8) + 4;
            const ex = t.x - (dx / len) * pad;
            const ey = t.y - (dy / len) * pad;
            // Curve parallel edges (invoice vs payment between the same pair) apart.
            const bend = l.type === "INVOICES" ? 22 : l.type === "PAYS" ? -22 : 0;
            const mx = (s.x + ex) / 2 - (dy / len) * bend;
            const my = (s.y + ey) / 2 + (dx / len) * bend;
            const faded = focus && dim((l.source as SimNode).id) && dim((l.target as SimNode).id);
            const color = l.flagged ? "hsl(var(--destructive))" : LINK_COLOR[l.type] ?? "hsl(var(--border))";
            return (
              <g key={l.key} opacity={faded ? 0.12 : 1}>
                <path
                  d={`M ${s.x} ${s.y} Q ${mx} ${my} ${ex} ${ey}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={l.flagged ? 2.6 : l.type === "DIRECTOR_OF" ? 1 : 1.6}
                  strokeOpacity={l.flagged ? 1 : 0.7}
                  strokeDasharray={l.type === "DIRECTOR_OF" ? "4 4" : l.flagged ? "8 5" : undefined}
                  markerEnd={l.type === "DIRECTOR_OF" ? undefined : `url(#arrow-${l.flagged ? "FLAG" : l.type})`}
                  className={l.flagged ? "[animation:dash_1.2s_linear_infinite]" : undefined}
                >
                  <title>{`${l.type} ${l.amount ? formatCr(l.amount) : ""}${l.count ? ` · ${l.count} txns` : ""}`}</title>
                </path>
                {flow && l.flagged && l.type !== "DIRECTOR_OF" && !faded && [0, 0.5].map((offset) => (
                  <circle key={offset} r={3.2} fill="hsl(var(--destructive))" className="pointer-events-none">
                    <animateMotion dur="2.4s" begin={`${offset * 2.4}s`} repeatCount="indefinite" path={`M ${s.x} ${s.y} Q ${mx} ${my} ${ex} ${ey}`} />
                  </circle>
                ))}
                {flow && !l.flagged && l.type === "PAYS" && !faded && (
                  <circle r={2.2} fill={color} opacity={0.8} className="pointer-events-none">
                    <animateMotion dur="3.6s" repeatCount="indefinite" path={`M ${s.x} ${s.y} Q ${mx} ${my} ${ex} ${ey}`} />
                  </circle>
                )}
                {l.amount && view.k > 0.9 && !faded && (
                  <text x={mx} y={my} textAnchor="middle" className="pointer-events-none fill-muted-foreground font-mono text-[9px]">{formatCr(l.amount, 1)}</text>
                )}
              </g>
            );
          })}
          {simNodes.map((n) => {
            const p = positions[n.id];
            if (!p) return null;
            const isBorrower = n.id === borrowerId;
            const fill = isBorrower ? "hsl(var(--primary))" : n.type === "person" ? "hsl(var(--chart-4))" : n.risk >= 0.75 ? "hsl(var(--destructive))" : n.risk >= 0.45 ? "hsl(var(--warning))" : "hsl(var(--chart-5))";
            const r = isBorrower ? Math.max(n.size, 16) : n.size;
            return (
              <g
                key={n.id}
                transform={`translate(${p.x} ${p.y})`}
                opacity={dim(n.id) ? 0.2 : 1}
                className="cursor-pointer"
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
                onPointerDown={(e) => { e.stopPropagation(); nodeDrag.current = n.id; }}
                onClick={(e) => { e.stopPropagation(); onSelect?.(n); }}
                tabIndex={0}
                role="button"
                aria-label={`${n.label}${n.flagged ? ", flagged" : ""}`}
                onKeyDown={(e) => e.key === "Enter" && onSelect?.(n)}
              >
                {isBorrower && <circle r={r + 10} fill="hsl(var(--primary))" opacity={0.12} />}
                {n.flagged && <circle r={r + 7} fill="none" stroke="hsl(var(--destructive))" strokeOpacity={0.5} strokeWidth={2} className="animate-pulse" />}
                {selectedId === n.id && <circle r={r + 4} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1.5} />}
                {n.type === "person" ? (
                  <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.45} fill={fill} stroke="hsl(var(--background))" strokeWidth={2} />
                ) : (
                  <circle r={r} fill={fill} stroke="hsl(var(--background))" strokeWidth={2.5} />
                )}
                {(n.type === "person" || isBorrower) && (
                  <text textAnchor="middle" dy="0.35em" className="pointer-events-none fill-white font-semibold" style={{ fontSize: Math.max(8, r * 0.75) }}>
                    {n.label.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </text>
                )}
                <text y={r + 14} textAnchor="middle" paintOrder="stroke" stroke="hsl(var(--background))" strokeWidth={3} className={cn("pointer-events-none fill-foreground text-[10px]", isBorrower && "text-[11px] font-semibold")}>
                  {n.label.length > 26 ? `${n.label.slice(0, 24)}…` : n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <style>{`@keyframes dash { to { stroke-dashoffset: -26; } }`}</style>
    </div>
  );
}

export function NodeIcon({ type }: { type: string }) {
  return type === "person" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />;
}
