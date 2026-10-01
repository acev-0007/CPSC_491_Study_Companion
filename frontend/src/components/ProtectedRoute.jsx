import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getCurrentUser } from "../api/auth";

function ProtectedRoute({
  children,
  redirectTo = "/login",
}) {
  const routeProtectionEnabled =
    import.meta.env.VITE_ENABLE_ROUTE_PROTECTION === "true";

  const [authStatus, setAuthStatus] =
    useState("checking");

  useEffect(() => {
    if (!routeProtectionEnabled) {
      return;
    }

    let isMounted = true;

    async function verifySession() {
      try {
        const result = await getCurrentUser();

        if (isMounted) {
          setAuthStatus(
            result.user
              ? "authenticated"
              : "unauthenticated"
          );
        }
      } catch {
        if (isMounted) {
          setAuthStatus("unauthenticated");
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [routeProtectionEnabled]);

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

  if (authStatus === "unauthenticated") {
    return (
      <Navigate
        to={redirectTo}
        replace
      />
    );
  }

  return children;
}

export default ProtectedRoute;
