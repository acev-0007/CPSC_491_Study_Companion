import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logoutAccount } from "../../api/auth";
import { settingsItems } from "./settingsItems";

export default function SettingsSidebar() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const handleLogout = async () => {
    setLogoutError("");
    setLoggingOut(true);
    try {
      await logoutAccount();
      navigate("/", { replace: true });
    } catch (error) {
      setLogoutError(error.message || "Unable to log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };
  return <aside className="settings-shell-sidebar" aria-label="Settings navigation">
    <NavLink className="settings-shell-brand" to="/dashboard"><span className="sidebar-brand-mark" aria-hidden="true">✦</span><span>AI Study Companion</span></NavLink>
    <NavLink className="settings-return-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</NavLink>
    <nav className="settings-shell-links" aria-label="Account settings">
      <p className="settings-shell-label">ACCOUNT SETTINGS</p>
      {settingsItems.map(item => <NavLink key={item.path} to={`/account/${item.path}`} className={({isActive})=>`settings-shell-link${isActive?" is-active":""}`}><span className="settings-shell-symbol" aria-hidden="true">{item.symbol}</span>{item.label}</NavLink>)}
    </nav>
    <div className="settings-shell-footer">
      {logoutError && <p className="settings-shell-error" role="alert">{logoutError}</p>}
      <button className="settings-shell-logout" type="button" disabled={loggingOut} onClick={handleLogout}>
        {loggingOut ? "Logging out..." : "Log out"}
      </button>
    </div>
  </aside>;
}
