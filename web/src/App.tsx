import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AppShell from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { useAuthStatus } from "@/hooks/useSecurity";
import { errorMessage, isOwnerBlockedError } from "@/lib/api";
import AuthCallback from "@/pages/AuthCallback";
import Blocked from "@/pages/Blocked";
import Calendar from "@/pages/Calendar";
import Coach from "@/pages/Coach";
import Guide from "@/pages/Guide";
import MfaSetup from "@/pages/MfaSetup";
import MfaUnlock from "@/pages/MfaUnlock";
import NotFound from "@/pages/NotFound";
import Onboarding from "@/pages/Onboarding";
import RecordingDetail from "@/pages/RecordingDetail";
import Recordings from "@/pages/Recordings";
import Review from "@/pages/Review";
import Settings from "@/pages/Settings";
import SignIn from "@/pages/SignIn";
import Today from "@/pages/Today";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

/**
 * Three gates in order: Google identity → owner allowlist → authenticator
 * session. Only past all three does any vault data load.
 */
function Gate() {
  const { user, isLoading, sessionToken } = useAuth();
  const { status, isLoading: statusLoading, error: statusError } = useAuthStatus(Boolean(user));
  const { me, isLoading: meLoading, isError } = useMe(Boolean(user) && Boolean(sessionToken));

  if (isLoading) return <FullScreenLoader />;
  if (!user) return <SignIn />;

  // The backend rejects any non-owner Google account with 403 NOT_OWNER.
  if (isOwnerBlockedError(statusError)) return <Blocked email={user.email} />;
  if (statusLoading) return <FullScreenLoader />;
  if (statusError || !status) return <StartupError message={errorMessage(statusError)} />;

  if (!status.mfa_enrolled) return <MfaSetup />;
  if (!sessionToken || !status.session_valid) return <MfaUnlock email={status.email ?? user.email} />;

  if (meLoading) return <FullScreenLoader />;
  if (!isError && me && !me.profile.onboarding_done) return <Onboarding />;
  return <AppShell />;
}

function StartupError({ message }: { message: string }) {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <img src="/icon.png" alt="" className="h-12 w-12 rounded-xl" />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-2">
        <button className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => window.location.reload()}>Try again</button>
        <button className="rounded-xl px-4 py-2 text-sm underline" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <img src="/icon.png" alt="" className="h-9 w-9 animate-pulse rounded-xl" />
        Opening your memory…
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster position="top-center" toastOptions={{ className: "font-sans" }} />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route element={<Gate />}>
              <Route path="/" element={<Today />} />
              <Route path="/review" element={<Review />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/recordings" element={<Recordings />} />
              <Route path="/recordings/:id" element={<RecordingDetail />} />
              <Route path="/coach" element={<Coach />} />
              <Route path="/coach/:threadId" element={<Coach />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/onboarding" element={<Navigate to="/" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
