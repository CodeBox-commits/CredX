import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import DocumentAnalyzer from "./pages/DocumentAnalyzer";
import CorporateResearch from "./pages/CorporateResearch";
import CreditRisk from "./pages/CreditRisk";
import CAMGenerator from "./pages/CAMGenerator";
import Copilot from "./pages/Copilot";
import AboutUs from "./pages/AboutUs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route index element={<Landing />} />
            <Route path="home" element={<Landing />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="document-analyzer" element={<DocumentAnalyzer />} />
            <Route path="research" element={<CorporateResearch />} />
            <Route path="credit-risk" element={<CreditRisk />} />
            <Route path="cam-generator" element={<CAMGenerator />} />
            <Route path="copilot" element={<Copilot />} />
            <Route path="about" element={<AboutUs />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
