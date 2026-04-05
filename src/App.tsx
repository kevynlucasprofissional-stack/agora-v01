import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

// Public pages (lightweight – keep eager)
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import NotFound from "@/pages/NotFound";

// Public pages (lazy)
const PetraMixPage = lazy(() => import("@/pages/PetraMixPage"));
const PricingPage = lazy(() => import("@/pages/PricingPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));

// App pages (lazy – heavy)
const DashboardPage = lazy(() => import("@/pages/app/DashboardPage"));
const NewAnalysisPage = lazy(() => import("@/pages/app/NewAnalysisPage"));
const AnalysisResultsPage = lazy(() => import("@/pages/app/AnalysisResultsPage"));
const ConversationHistoryPage = lazy(() => import("@/pages/app/ConversationHistoryPage"));
const AnalysisReportPage = lazy(() => import("@/pages/app/AnalysisReportPage"));
const AnalysisChatPage = lazy(() => import("@/pages/app/AnalysisChatPage"));
const CampaignDocumentPage = lazy(() => import("@/pages/app/CampaignDocumentPage"));
const CampaignComparatorPage = lazy(() => import("@/pages/app/CampaignComparatorPage"));
const CreativeStudioPage = lazy(() => import("@/pages/app/CreativeStudioPage"));
const AccountPage = lazy(() => import("@/pages/app/AccountPage"));
const SettingsPage = lazy(() => import("@/pages/app/SettingsPage"));
const IntegrationsPage = lazy(() => import("@/pages/app/IntegrationsPage"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[50vh]">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
    </div>
  );
}

function NewAnalysisWithKey() {
  const [searchParams] = useSearchParams();
  return (
    <Suspense fallback={<PageLoader />}>
      <NewAnalysisPage key={searchParams.get("t") || "default"} />
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/petramix" element={<Suspense fallback={<PageLoader />}><PetraMixPage /></Suspense>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pricing" element={<Suspense fallback={<PageLoader />}><PricingPage /></Suspense>} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/privacy" element={<Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense>} />
            <Route path="/terms" element={<Suspense fallback={<PageLoader />}><TermsPage /></Suspense>} />

            {/* App (protected) */}
            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
              <Route path="new-analysis" element={<NewAnalysisWithKey />} />

              <Route path="analyses" element={<Suspense fallback={<PageLoader />}><AnalysisResultsPage /></Suspense>} />
              <Route path="conversations" element={<Suspense fallback={<PageLoader />}><ConversationHistoryPage /></Suspense>} />
              <Route path="analysis/:id/report" element={<Suspense fallback={<PageLoader />}><AnalysisReportPage /></Suspense>} />
              <Route path="analysis/:id/chat" element={<Suspense fallback={<PageLoader />}><AnalysisChatPage /></Suspense>} />
              <Route path="analysis/:id/campaign" element={<Suspense fallback={<PageLoader />}><CampaignDocumentPage /></Suspense>} />

              <Route path="comparator" element={<Suspense fallback={<PageLoader />}><CampaignComparatorPage /></Suspense>} />

              <Route path="account" element={<Suspense fallback={<PageLoader />}><AccountPage /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
              <Route path="integrations" element={<Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense>} />
              <Route path="creative-studio" element={<Suspense fallback={<PageLoader />}><CreativeStudioPage /></Suspense>} />
              <Route path="creative-studio/:jobId" element={<Suspense fallback={<PageLoader />}><CreativeStudioPage /></Suspense>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
