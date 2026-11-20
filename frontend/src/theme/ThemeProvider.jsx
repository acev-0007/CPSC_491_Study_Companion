import { useEffect, useLayoutEffect, useState } from "react";
import { ThemeContext, isTheme } from "./themeContext";
import { useLocation } from "react-router-dom";
import { getAccount } from "../api/account";

export function ThemeProvider({ children }) {
  const { pathname } = useLocation();
  const [preference, setPreference] = useState("system");
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const protectedPath = /^\/(dashboard|account|flashcards|quiz|assignments|visual-generator|summarization|textbooks)(\/|$)/.test(pathname);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (!protectedPath) {
      return;
    }
    let active = true;
    // Revalidate on protected navigation so switching accounts never leaks a theme.
    getAccount().then(({ user }) => {
      if (active) setPreference(isTheme(user?.preferences?.theme) ? user.preferences.theme : "system");
    }).catch(() => {
      if (active) setPreference("system");
    });
    return () => { active = false; };
  }, [pathname, protectedPath]);

  useLayoutEffect(() => {
    const effectivePreference = protectedPath ? preference : "system";
    const resolved = effectivePreference === "system" ? (systemDark ? "dark" : "light") : effectivePreference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [preference, systemDark, protectedPath]);

  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>;
}
