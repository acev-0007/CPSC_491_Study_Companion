import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getCurrentUser } from "../api/auth";
import "../styles/account.css";

export default function Account() {
  const [state, setState] = useState({ user: null, loading: true, error: false });
  const [attempt, setAttempt] = useState(0);
  const { pathname } = useLocation();
  const retry = useCallback(() => { setState(previous => ({ ...previous, loading: true, error: false })); setAttempt(n => n + 1); }, []);
  useEffect(() => {
    let active = true;
    getCurrentUser().then(result => {
      if (active) setState({ user: result.user || null, loading: false, error: false });
    }).catch(() => { if (active) setState({ user: null, loading: false, error: true }); });
    return () => { active = false; };
  }, [attempt]);
  return <div className={`account-page${pathname.endsWith("/menu") ? " account-show-menu" : ""}`}><Outlet context={{ ...state, retry }} /></div>;
}
