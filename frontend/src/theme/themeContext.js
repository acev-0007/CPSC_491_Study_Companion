import { createContext, useContext } from "react";

export const isTheme = value => ["system", "light", "dark"].includes(value);
export const ThemeContext = createContext({ preference: "system", setPreference: () => {} });
export function useTheme() { return useContext(ThemeContext); }
