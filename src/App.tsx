import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import DocumentAnalyzer from "./pages/DocumentAnalyzer";
import CorporateResearch from "./pages/CorporateResearch";
import CreditRisk from "./pages/CreditRisk";
import CAMGenerator from "./pages/CAMGenerator";
import Copilot from "./pages/Copilot";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/document-analyzer" element={<DocumentAnalyzer />} />
            <Route path="/research" element={<CorporateResearch />} />
            <Route path="/credit-risk" element={<CreditRisk />} />
            <Route path="/cam-generator" element={<CAMGenerator />} />
            <Route path="/copilot" element={<Copilot />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
