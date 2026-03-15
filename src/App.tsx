import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

// Public pages
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import PricingPage from "@/pages/PricingPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";

// App pages
import DashboardPage from "@/pages/app/DashboardPage";
import NewAnalysisPage from "@/pages/app/NewAnalysisPage";
import HistoryPage from "@/pages/app/HistoryPage";
import AnalysisReportPage from "@/pages/app/AnalysisReportPage";
import AnalysisChatPage from "@/pages/app/AnalysisChatPage";
import CampaignDocumentPage from "@/pages/app/CampaignDocumentPage";
import AssetsPage from "@/pages/app/AssetsPage";
import AccountPage from "@/pages/app/AccountPage";
import SettingsPage from "@/pages/app/SettingsPage";
import IntegrationsPage from "@/pages/app/IntegrationsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* App (protected) */}
            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="new-analysis" element={<NewAnalysisPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="analysis/:id/report" element={<AnalysisReportPage />} />
              <Route path="analysis/:id/chat" element={<AnalysisChatPage />} />
              <Route path="assets" element={<AssetsPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
