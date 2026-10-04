"use client";

import { motion } from "framer-motion";

import { AnimatedNumber } from "@/components/common/primitives";
import { scoreTone, toneHsl } from "@/lib/tones";

const MIN = 300;
const MAX = 900;
const BANDS = [
  { to: 600, color: "hsl(var(--destructive))" },
  { to: 680, color: "hsl(var(--warning))" },
  { to: 760, color: "hsl(var(--primary))" },
  { to: 900, color: "hsl(var(--success))" },
];

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 180) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};
const angle = (s: number) => ((Math.min(MAX, Math.max(MIN, s)) - MIN) / (MAX - MIN)) * 180;

export function ScoreGauge({ score, modelScore, label, size = 240 }: { score: number; modelScore?: number; label?: string; size?: number }) {
  const cx = 120;
  const cy = 120;
  const r = 96;
  const tone = scoreTone(score);
  let prev = MIN;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.62 }} role="img" aria-label={`Credit score ${score} out of 900`}>
      <svg viewBox="0 0 240 150" className="h-full w-full overflow-visible">
        {BANDS.map((b) => {
          const d = arc(cx, cy, r, angle(prev), angle(b.to) - 0.8);
          prev = b.to;
          return <path key={b.to} d={d} stroke={b.color} strokeOpacity={0.18} strokeWidth={14} fill="none" strokeLinecap="butt" />;
        })}
        <motion.path
          d={arc(cx, cy, r, 0, 180)}
          stroke={toneHsl[tone]}
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: angle(score) / 180 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        {modelScore !== undefined && modelScore !== score && (() => {
          const [x, y] = polar(cx, cy, r + 13, angle(modelScore));
          return <circle cx={x} cy={y} r={3.5} fill="hsl(var(--muted-foreground))"><title>Model score before overlays: {modelScore}</title></circle>;
        })()}
        {[300, 600, 680, 760, 900].map((t) => {
          const [x, y] = polar(cx, cy, r - 22, angle(t));
          return <text key={t} x={x} y={y} textAnchor="middle" className="fill-muted-foreground font-mono text-[8px]">{t}</text>;
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="numeric text-4xl font-semibold leading-none"><AnimatedNumber value={score} /></p>
        {label && <p className="eyebrow mt-1.5">{label}</p>}
      </div>
    </div>
  );
}
