import { motion } from "framer-motion";
import { Bot, Send, User } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { generateCopilotReply } from "@/lib/intelliCredit";
import { requestCopilotResponse } from "@/lib/platformApi";
import { buildCopilotContext } from "@/lib/platformWorkspace";
import { WorkspaceSyncBanner } from "@/components/WorkspaceSyncBanner";

interface Message {
  role: "user" | "assistant";
  content: string;
  provider?: string;
  tokensUsed?: number;
}

const quickPrompts = [
  "What are the major risks for this borrower?",
  "Summarize the uploaded documents",
  "How do GST and bank flows reconcile?",
  "What changed after the site-visit note?",
  "Walk me through the recommendation logic",
  "Which source buckets are still missing?",
];

function buildIntroMessage(companyName: string): Message {
  return {
    role: "assistant",
    content: `CredX Copilot is ready for ${companyName}. Ask about research signals, document findings, or the current recommendation.`,
  };
}

const Copilot = () => {
  const { workspace, analysis } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([
    buildIntroMessage(workspace.companyName),
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setMessages([buildIntroMessage(workspace.companyName)]);
  }, [workspace.companyName]);

  const handleSend = async (prompt?: string) => {
    const question = (prompt ?? input).trim();
    if (!question || isSending) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: question },
    ]);
    setInput("");
    setIsSending(true);

    try {
      const response = await requestCopilotResponse({
        question,
        context: buildCopilotContext(workspace, analysis),
      });
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: response.answer,
          provider: response.provider,
          tokensUsed: response.tokens_used,
        },
      ]);
    } catch {
      const answer = generateCopilotReply(workspace, question);
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: answer,
          provider: "local-fallback",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="page-shell flex h-full min-h-0 flex-col">
      <div className="mb-4">
        <h1 className="text-xl font-bold">AI Credit Copilot</h1>
        <p className="mt-0.5 text-xs font-mono text-muted-foreground">
          INTERACTIVE AI ASSISTANT | RESEARCH + DOCUMENT + RECOMMENDATION CONTEXT
        </p>
        <div className="mt-3">
          <WorkspaceSyncBanner
            status={analysis.status}
            message={analysis.message}
            updated_at={analysis.updated_at}
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => void handleSend(prompt)}
            disabled={isSending}
            className="rounded-md border border-border bg-secondary px-2.5 py-1 text-[10px] font-mono text-secondary-foreground transition-all hover:border-primary/30 hover:bg-primary/5"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mb-4 flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
        {messages.map((message, index) => (
          <motion.div
            key={`${message.role}-${index}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                message.role === "assistant"
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {message.role === "assistant" ? (
                <Bot className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[78%] rounded-lg p-3 text-xs leading-relaxed",
                message.role === "assistant"
                  ? "border border-border bg-card"
                  : "border border-primary/20 bg-primary/10",
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.role === "assistant" && message.provider ? (
                <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                  {message.provider}
                  {message.tokensUsed ? ` | ${message.tokensUsed} tokens` : ""}
                </div>
              ) : null}
            </div>
          </motion.div>
        ))}
        {isSending ? (
          <div className="text-xs font-mono text-muted-foreground">
            CredX Copilot is analyzing the current case context...
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void handleSend()}
          placeholder="Ask the AI Credit Copilot..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={() => void handleSend()}
          disabled={isSending}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Copilot;
