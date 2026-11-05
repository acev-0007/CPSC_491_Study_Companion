import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { logoutAccount } from "../../api/auth";
import "./Sidebar.css";

const navigationGroups = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", to: "/dashboard" }],
  },
  {
    label: "Study",
    items: [
      { label: "Flashcards", to: "/flashcards" },
      { label: "Quiz", to: "/quiz" },
      { label: "Summarization", to: "/summarization" },
      { label: "Visual Generator", to: "/visual-generator" },
    ],
  },
  {
    label: "Organize",
    items: [{ label: "Assignments", to: "/assignments" }],
  },
  {
    label: "Resources",
    items: [{ label: "Textbooks", to: "/textbooks" }],
  },
];

function NavigationLinks({ onNavigate }) {
  return navigationGroups.map((group) => (
    <div className="sidebar-nav-group" key={group.label}>
      <p className="sidebar-nav-label">{group.label}</p>
      <div className="sidebar-nav-links">
        {group.items.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `sidebar-nav-link${isActive ? " is-active" : ""}`
            }
            end={item.to === "/dashboard"}
            key={item.to}
            onClick={onNavigate}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  ));
}

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpenPath, setMobileOpenPath] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const mobileOpen = mobileOpenPath === location.pathname;

  const toggleMobileNavigation = () => {
    setMobileOpenPath(mobileOpen ? null : location.pathname);
  };

  const closeMobileNavigation = () => {
    setMobileOpenPath(null);
  };

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

  return (
    <>
      <aside className="app-sidebar" aria-label="Application navigation">
        <NavLink className="sidebar-brand" end to="/dashboard">
          <span className="sidebar-brand-mark" aria-hidden="true">✦</span>
          <span className="sidebar-brand-name">AI Study Companion</span>
        </NavLink>
        <nav className="sidebar-navigation" aria-label="Primary">
          <NavigationLinks />
        </nav>
        <div className="sidebar-footer">
          <NavLink
            className={({ isActive }) =>
              `sidebar-nav-link sidebar-settings-link${isActive ? " is-active" : ""}`
            }
            to="/account"
          >
            Settings
          </NavLink>
          {logoutError && <p className="sidebar-error" role="alert">{logoutError}</p>}
          <button
            className="sidebar-logout"
            disabled={loggingOut}
            onClick={handleLogout}
            type="button"
          >
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </aside>
      <div className="mobile-app-navigation">
        <div className="mobile-app-bar">
          <NavLink className="mobile-brand" end to="/dashboard">
            <span className="sidebar-brand-mark" aria-hidden="true">✦</span>
            <span className="sidebar-brand-name">AI Study Companion</span>
          </NavLink>
          <button
            aria-controls="mobile-primary-navigation"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            className="mobile-menu-button"
            onClick={toggleMobileNavigation}
            type="button"
          >
            <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
          </button>
        </div>
        <div
          className={`mobile-nav-panel${mobileOpen ? " is-open" : ""}`}
          id="mobile-primary-navigation"
        >
          <nav className="mobile-nav-links" aria-label="Mobile primary">
            <NavigationLinks onNavigate={closeMobileNavigation} />
          </nav>
          <div className="mobile-nav-footer">
          <NavLink
            className={({ isActive }) =>
              `sidebar-nav-link sidebar-settings-link${isActive ? " is-active" : ""}`
            }
            onClick={closeMobileNavigation}
            to="/account"
          >
            Settings
          </NavLink>
            {logoutError && <p className="sidebar-error" role="alert">{logoutError}</p>}
            <button
              className="sidebar-logout"
              disabled={loggingOut}
              onClick={handleLogout}
              type="button"
            >
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
