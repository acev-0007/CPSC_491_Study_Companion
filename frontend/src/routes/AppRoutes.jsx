import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import ProtectedRoute from "../components/ProtectedRoute";
import { getCurrentUser } from "../api/auth";
import Landing from "../pages/Landing";
import Login from "../pages/Login";
import ForgotPassword from "../pages/ForgotPassword";
import Register from "../pages/Register";
import EmailConfirmation from "../pages/EmailConfirmation";
import Dashboard from "../pages/Dashboard";
import Flashcards from "../pages/Flashcards";
import Quiz from "../pages/Quiz";
import AssignmentTracker from "../pages/AssignmentTracker";
import VisualGenerator from "../pages/VisualGenerator";
import Summarization from "../pages/Summarization";
import TextbookHub from "../pages/TextbookHub";
import NotFound from "../pages/NotFound";
import Account from "../pages/Account";
import { ProfileSettings, SecuritySettings, PreferenceSettings, PrivacySettings, SettingsMenu } from "../components/Account/SettingsSections";
// Only the home route uses this guard. ProtectedRoute remains responsible
// for enforcing authentication on the dashboard and other private pages.
function LandingRoute() {
  const [status, setStatus] = useState("checking");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const result = await getCurrentUser();
        if (active) {
          setStatus(result.user ? "authenticated" : "unauthenticated");
        }
      } catch (error) {
        if (active) {
          setStatus(error.status === 401 ? "unauthenticated" : "error");
        }
      }
    }

    checkSession();
    return () => {
      active = false;
    };
  }, [retryCount]);

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  if (status === "unauthenticated") {
    return <Landing />;
  }

  if (status === "error") {
    return (
      <main className="session-error" aria-labelledby="home-session-error-title">
        <section className="session-error-card" role="alert">
          <h1 id="home-session-error-title" className="session-error-title">
            Unable to check your session
          </h1>
          <p className="session-error-message">
            We couldn't connect to the server. Please try again.
          </p>
          <button
            type="button"
            className="session-error-button"
            onClick={() => {
              setStatus("checking");
              setRetryCount((count) => count + 1);
            }}
          >
            Try Again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="session-error" role="status" aria-live="polite">
      <p>Checking your session…</p>
    </main>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          <>
            <title>AI Study Companion | Study Smarter</title>
            <LandingRoute />
          </>
        }
      />
      <Route
        path="/login"
        element={
          <>
            <title>Login | AI Study Companion</title>
            <Login />
          </>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <>
            <title>Forgot Password | AI Study Companion</title>
            <ForgotPassword />
          </>
        }
      />

      <Route
        path="/register"
        element={
          <>
            <title>Register | AI Study Companion</title>
            <Register />
          </>
        }
      />
      <Route
        path="/auth/confirm"
        element={
          <>
            <title>Confirm Email | AI Study Companion</title>
            <EmailConfirmation />
          </>
        }
      />
      <Route element={<Layout />}>
        <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="menu" element={<SettingsMenu />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="preferences" element={<PreferenceSettings />} />
          <Route path="privacy" element={<PrivacySettings />} />
        </Route>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <>
                <title>Dashboard | AI Study Companion</title>
                <Dashboard />
              </>
            </ProtectedRoute>
          }
        />
        <Route
          path="/flashcards"
          element={
            <ProtectedRoute>
              <>
                <title>Flashcards | AI Study Companion</title>
                <Flashcards />
              </>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <>
                <title>Quiz Generator | AI Study Companion</title>
                <Quiz />
              </>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assignments"
          element={
            <ProtectedRoute>
              <>
                <title>Assignment Tracker | AI Study Companion</title>
                <AssignmentTracker />
              </>
            </ProtectedRoute>
          }
        />
        <Route
          path="/visual-generator"
          element={
            <ProtectedRoute>
              <>
                <title>Visual Generator | AI Study Companion</title>
                <VisualGenerator />
              </>
            </ProtectedRoute>
          }
        />
        <Route
          path="/summarization"
          element={
            <ProtectedRoute>
              <>
                <title>Summarization | AI Study Companion</title>
                <Summarization />
              </>
            </ProtectedRoute>
          }
        />
        <Route
          path="/textbooks"
          element={
            <ProtectedRoute>
              <>
                <title>Textbook Hub | AI Study Companion</title>
                <TextbookHub />
              </>
            </ProtectedRoute>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <>
            <title>Page Not Found | AI Study Companion</title>
            <NotFound />
          </>
        }
      />
    </Routes>
  );
}
export default AppRoutes;
