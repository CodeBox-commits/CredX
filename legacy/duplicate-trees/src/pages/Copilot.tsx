import { motion } from "framer-motion";
import { Bot, Send, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const sampleConversation: Message[] = [
  { role: "user", content: "What are the major risks for Adani Power Limited?" },
 {
    role: "assistant",
    content: `Based on my analysis, Adani Power Limited has **4 critical risk factors**:

1. **Capacity Utilization (HIGH)**: Factory operating at only 40% capacity, significantly below the 75% industry benchmark. This directly impacts debt servicing ability.

2. **Promoter Pledge Risk (HIGH)**: Promoter shareholding pledge surged from 12% to 28% in 3 months - a 133% increase. This pattern historically correlates with a 42% higher probability of default.

3. **Shell Company Linkage (MEDIUM-HIGH)**: Gamma Trading Co, linked via common directors, shows characteristics of a shell entity. Rs 45 Cr in unsecured loans to this entity raises fund diversion concerns.

4. **Sector Stress (MEDIUM)**: Infrastructure sector NPA at 8.2%, combined with input cost inflation (steel +22%, cement +15%), creates margin pressure.

**Overall Risk Rating: MODERATE-HIGH (67/100)**
Recommended action: Reduce exposure and add monitoring covenants.`,
  },
  { role: "user", content: "What is the safest loan amount?" },
  {
    role: "assistant",
    content: `Based on risk-adjusted analysis:

| Scenario | Loan Amount | PD | Risk Score |
|----------|------------|-----|-----------|
| Conservative | **Rs 80 Cr** | 3.2% | 82/100 |
| Moderate | **Rs 120 Cr** | 6.8% | 67/100 |
| Aggressive | **Rs 200 Cr** | 12.4% | 48/100 |

**Recommended: Rs 120 Cr** - This balances the borrower's needs with acceptable risk levels. At this amount, collateral coverage remains at 1.8x and DSCR stays above 1.3x.

The conservative option of Rs 80 Cr provides the safest exposure but may not meet the borrower's capacity expansion requirements. The aggressive option of Rs 200 Cr exceeds comfortable risk thresholds given current capacity utilization and sector conditions.`,
  },
];

const quickPrompts = [
  "What are the major risks for this borrower?",
  "Explain the decline in revenue",
  "Summarize the annual report",
  "What is the safest loan amount?",
  "Compare with industry benchmarks",
  "Generate risk mitigation strategies",
];

const Copilot = () => {
  const [messages, setMessages] = useState<Message[]>(sampleConversation);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: input },
      { role: "assistant", content: "Analyzing your query against the borrower's financial data, research intelligence, and risk models... This is a demo response. In production, this would be powered by the AI Credit Copilot engine with real-time data analysis." },
    ]);
    setInput("");
  };

  return (
    <div className="page-shell h-full min-h-0 flex flex-col">
      <div className="mb-4">
        <h1 className="text-xl font-bold">AI Credit Copilot</h1>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          INTERACTIVE AI ASSISTANT | DATA-BACKED CREDIT ANALYSIS
        </p>
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => setInput(prompt)}
            className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border hover:border-primary/30 hover:bg-primary/5 transition-all"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 pr-2 mb-4">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
          >
            <div className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
              msg.role === "assistant" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
            )}>
              {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className={cn(
              "max-w-[75%] rounded-lg p-3 text-xs leading-relaxed",
              msg.role === "assistant"
                ? "bg-card border border-border"
                : "bg-primary/10 border border-primary/20"
            )}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask the AI Credit Copilot..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={handleSend}
          className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Copilot;
