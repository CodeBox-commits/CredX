import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AppProviders } from "@/providers/AppProviders";
import { CommandPalette } from "@/components/CommandPalette";
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

const App = () => (
  <AppProviders>
      <BrowserRouter>
        <CommandPalette />
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
  </AppProviders>
);

export default App;
