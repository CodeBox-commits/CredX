"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, Sparkles } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";

const CASE_SUGGESTIONS = [
  "Why did the model reach this decision?",
  "Is there any circular trading or GST mismatch?",
  "How is the interest rate built up?",
  "What would improve the score?",
  "Summarise the external intelligence",
  "How much can we lend and why?",
];
const PORTFOLIO_SUGGESTIONS = ["Give me a portfolio snapshot", "Which cases need attention?"];

/** Tiny, safe markdown: headings, bold, italics, bullets, paragraphs (no HTML injection). */
function renderMarkdown(text: string): ReactNode {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <em key={i} className="text-muted-foreground">{part.slice(1, -1)}</em>
      : <Fragment key={i}>{part}</Fragment>);
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(<ul key={out.length} className="my-1.5 space-y-1 pl-1">{list.map((l, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/70" /><span>{inline(l)}</span></li>)}</ul>);
      list = [];
    }
  };
  text.split("\n").forEach((line) => {
    const t = line.trim();
    if (/^[-•*] /.test(t)) { list.push(t.slice(2)); return; }
    flush();
    if (!t) return;
    if (t.startsWith("#")) out.push(<p key={out.length} className="mt-2 font-display font-semibold">{inline(t.replace(/^#+\s*/, ""))}</p>);
    else out.push(<p key={out.length} className="my-1.5">{inline(t)}</p>);
  });
  flush();
  return out;
}

interface Msg { role: "user" | "assistant"; content: string; provider?: string | null; meta?: string; typing?: boolean }

/** Reveals an answer a few words at a time (timer-driven, so it always completes). */
function TypedAnswer({ text, onDone }: { text: string; onDone: () => void }) {
  const words = text.split(/(\s+)/);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(words.length);
      onDone();
      return;
    }
    const t = setInterval(() => {
      setCount((c) => {
        const next = Math.min(words.length, c + 4);
        if (next >= words.length) {
          clearInterval(t);
          setTimeout(onDone, 0);
        }
        return next;
      });
    }, 28);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <>
      {renderMarkdown(words.slice(0, count).join(""))}
      {count < words.length && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary/70" aria-hidden />}
    </>
  );
}

export function CopilotChat({ caseId, className, variant = "page", companyName }: { caseId: string | null; className?: string; variant?: "page" | "panel"; companyName?: string }) {
  const qc = useQueryClient();
  const { data: history } = useQuery({ queryKey: ["copilot", caseId], queryFn: () => api.copilot.history(caseId) });
  const { data: providers } = useQuery({ queryKey: ["copilot-providers"], queryFn: api.copilot.providers, staleTime: 60_000 });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages((history ?? []).map((m) => ({ role: m.role, content: m.content, provider: m.provider }))); }, [history]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const r = await api.copilot.chat(q, caseId);
      setMessages((m) => [...m, { role: "assistant", content: r.answer, provider: r.provider, typing: true, meta: `${r.provider} · ${r.model}${r.input_tokens + r.output_tokens ? ` · ${r.input_tokens + r.output_tokens} tokens` : ""}${r.fallback_used ? " · fallback" : ""}` }]);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(errorMessage(e));
      setMessages((m) => m.slice(0, -1));
      setInput(q);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = caseId ? CASE_SUGGESTIONS : PORTFOLIO_SUGGESTIONS;
  const active = providers?.active ?? [];
  return (
    <div className={cn("flex flex-col overflow-hidden", variant === "page" ? "panel h-[calc(100vh-230px)] min-h-[520px]" : "h-full", className)}>
      <div className={cn("flex items-center gap-2 border-b border-border px-4 py-3 text-xs text-muted-foreground", variant === "panel" && "pr-12")}>
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white"><Sparkles className="h-3.5 w-3.5" /></span>
        <span className="font-medium text-foreground">CredX Copilot</span>
        {active.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px]">{active[0] === "anthropic" ? providers?.models.anthropic : active[0]}</span>}
        <span className="ml-auto hidden truncate sm:inline">{caseId ? `Grounded in ${companyName ?? "this case"}` : "Portfolio mode"}</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5 scrollbar-thin" aria-live="polite">
        {!messages.length && (
          <div className="mx-auto max-w-lg py-6 text-center">
            <div className="relative mx-auto mb-4 h-14 w-14">
              <div className="absolute inset-0 animate-float rounded-2xl bg-gradient-to-br from-primary to-accent opacity-30 blur-xl" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg"><Bot className="h-6 w-6" /></div>
            </div>
            <p className="font-display text-lg font-semibold">{caseId ? "Ask anything about this case" : "Ask about your portfolio"}</p>
            <p className="mt-1 text-sm text-muted-foreground">Answers cite the extracted financials, SHAP drivers, policy rules, fraud graph, research and your notes.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {suggestions.map((s, i) => (
                <motion.button key={s} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                  onClick={() => send(s)} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-[13px] transition hover:border-primary/40 hover:bg-primary/[0.04]">
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
              {m.role === "assistant" && <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white"><Sparkles className="h-3.5 w-3.5" /></span>}
              <div className={cn("text-sm leading-relaxed", m.role === "user" ? "max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground" : "min-w-0 max-w-[92%]")}>
                {m.role === "assistant"
                  ? m.typing
                    ? <TypedAnswer text={m.content} onDone={() => setMessages((all) => all.map((x, j) => (j === i ? { ...x, typing: false } : x)))} />
                    : renderMarkdown(m.content)
                  : m.content}
                {m.role === "assistant" && m.meta && !m.typing && <p className="mt-2 font-mono text-[10px] text-muted-foreground">{m.meta}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white"><Sparkles className="h-3.5 w-3.5" /></span>
            <span className="flex gap-1">{[0, 1, 2].map((d) => <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}</span>
          </div>
        )}
      </div>

      {messages.length > 0 && !busy && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-none">
          {suggestions.slice(0, 4).map((s) => <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground">{s}</button>)}
        </div>
      )}
      <form className="border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <div className="flex items-end gap-2 rounded-xl border border-input bg-surface p-1.5 transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
          <Textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={caseId ? "Ask about risks, pricing, fraud, the decision…" : "Ask about the portfolio…"}
            className="max-h-32 min-h-[36px] resize-none border-0 bg-transparent p-1.5 shadow-none focus-visible:ring-0" aria-label="Message" />
          <Button type="submit" size="icon-sm" className="shrink-0 rounded-lg" disabled={!input.trim() || busy} aria-label="Send"><ArrowUp /></Button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">Enter to send · Shift+Enter for a new line · AI can be wrong — verify before sanctioning.</p>
      </form>
    </div>
  );
}
