import {
  useEffect,
  useState,
} from "react";

import {
  Navigate,
} from "react-router-dom";

import {
  getCurrentUser,
} from "../api/auth";

import "./ProtectedRoute.css";


function ProtectedRoute({
  children,
  redirectTo = "/login",
}) {
  const routeProtectionEnabled =
    import.meta.env
      .VITE_ENABLE_ROUTE_PROTECTION ===
    "true";

  const [
    authStatus,
    setAuthStatus,
  ] = useState("checking");

  const [
    retryCount,
    setRetryCount,
  ] = useState(0);


  useEffect(() => {
    if (!routeProtectionEnabled) {
      return;
    }

    let isMounted = true;


    async function verifySession() {
      try {
        const result =
          await getCurrentUser();

        if (!isMounted) {
          return;
        }

        setAuthStatus(
          result.user
            ? "authenticated"
            : "unauthenticated"
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error.status === 401) {
          setAuthStatus(
            "unauthenticated"
          );

          return;
        }

        setAuthStatus("error");
      }
    }


    verifySession();


    return () => {
      isMounted = false;
    };
  }, [
    routeProtectionEnabled,
    retryCount,
  ]);


  function handleRetry() {
    setAuthStatus("checking");

    setRetryCount(
      (current) =>
        current + 1
    );
  }


  // Temporary development bypass.
  // When route protection is disabled,
  // preserve the application's existing behavior.
  if (!routeProtectionEnabled) {
    return children;
  }


  // Prevent protected content from briefly rendering
  // while the existing session is being checked.
  if (authStatus === "checking") {
    return null;
  }


  // A 401 means the backend confirmed that no valid
  // session could be established.
  if (
    authStatus ===
    "unauthenticated"
  ) {
    return (
      <Navigate
        to={redirectTo}
        replace
      />
    );
  }


  // Do not treat server or network failures as logout.
  // Give the user control to retry session verification.
  if (authStatus === "error") {
    return (
      <main
        className="session-error"
        aria-labelledby="session-error-title"
      >
        <section
          className="session-error-card"
          role="alert"
        >
          <h1
            id="session-error-title"
            className="session-error-title"
          >
            Unable to verify your session
          </h1>

          <p
            className="session-error-message"
          >
            We couldn't connect to the
            server. Please try again.
          </p>

          <button
            type="button"
            className="session-error-button"
            onClick={handleRetry}
          >
            Try Again
          </button>
        </section>
      </main>
    );
  }


  return children;
}


export default ProtectedRoute;
