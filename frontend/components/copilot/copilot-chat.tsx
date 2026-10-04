"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";

const SUGGESTIONS = [
  "Summarise this case for the credit committee",
  "Why did the model reach this decision?",
  "Is there any circular trading or GST mismatch?",
  "How is the interest rate built up?",
  "What would improve the score?",
  "Explain the Five Cs assessment",
];

/** Tiny, safe markdown: headings, bold, bullets, paragraphs (no HTML injection). */
function renderMarkdown(text: string): ReactNode {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em> : <Fragment key={i}>{part}</Fragment>);
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={out.length} className="my-1.5 list-disc space-y-0.5 pl-5">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  text.split("\n").forEach((line) => {
    const t = line.trim();
    if (/^[-•*] /.test(t)) { list.push(t.slice(2)); return; }
    flush();
    if (!t) return;
    if (t.startsWith("#")) out.push(<p key={out.length} className="mt-1 font-display font-semibold">{inline(t.replace(/^#+\s*/, ""))}</p>);
    else out.push(<p key={out.length} className="my-1">{inline(t)}</p>);
  });
  flush();
  return out;
}

interface Msg { role: "user" | "assistant"; content: string; provider?: string | null; meta?: string }

export function CopilotChat({ caseId, className }: { caseId: string | null; className?: string }) {
  const qc = useQueryClient();
  const { data: history } = useQuery({ queryKey: ["copilot", caseId], queryFn: () => api.copilot.history(caseId) });
  const { data: providers } = useQuery({ queryKey: ["copilot-providers"], queryFn: api.copilot.providers, staleTime: 60_000 });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages((history ?? []).map((m) => ({ role: m.role, content: m.content, provider: m.provider }))); }, [history]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const r = await api.copilot.chat(q, caseId);
      setMessages((m) => [...m, { role: "assistant", content: r.answer, provider: r.provider, meta: `${r.model} · ${r.input_tokens + r.output_tokens} tokens · ${Math.round(r.latency_ms)} ms${r.fallback_used ? " · fallback" : ""}` }]);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(errorMessage(e));
      setMessages((m) => m.slice(0, -1));
      setInput(q);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex h-[calc(100vh-260px)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Providers: {providers?.active.map((p) => <span key={p} className="rounded bg-muted px-1.5 py-0.5 font-mono">{p === "anthropic" ? `claude (${providers.models.anthropic})` : p}</span>)}
        <span className="ml-auto hidden sm:inline">Answers are grounded in this case's data only</span>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin" aria-live="polite">
        {!messages.length && (
          <div className="mx-auto max-w-xl py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bot className="h-6 w-6" /></div>
            <p className="font-display text-lg font-semibold">{caseId ? "Ask anything about this case" : "Pick a case to ground the copilot"}</p>
            <p className="mt-1 text-sm text-muted-foreground">The copilot reads the extracted financials, SHAP drivers, policy rules, fraud graph, research and analyst notes.</p>
            {caseId && <div className="mt-5 flex flex-wrap justify-center gap-2">{SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary hover:bg-primary/5">{s}</button>)}</div>}
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-muted" : "bg-primary/15 text-primary")}>
                {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-background")}>
                {m.role === "assistant" ? renderMarkdown(m.content) : m.content}
                {m.role === "assistant" && (m.meta || m.provider) && <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{m.meta ?? m.provider}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analysing case data…</div>}
        <div ref={endRef} />
      </div>
      <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <Textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} disabled={!caseId}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder={caseId ? "Ask about risks, pricing, fraud, the decision… (Enter to send)" : "Select a case first"} className="min-h-[42px] resize-none" aria-label="Message" />
        <Button type="submit" size="icon" className="h-[42px] w-[42px]" disabled={!input.trim() || busy || !caseId} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
