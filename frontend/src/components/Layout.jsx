import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar/Sidebar";
import SettingsSidebar from "./Account/SettingsSidebar";
import "./Layout.css";

function Layout() {
  const { pathname } = useLocation();
  const inSettings = pathname === "/account" || pathname.startsWith("/account/");
  return (
    <div className={`app-shell${inSettings ? " app-shell-settings" : ""}`}>
      {inSettings ? <SettingsSidebar /> : <Sidebar />}
      <main className="app-main">
        <div className="app-main-content"><Outlet /></div>
      </main>
    </div>
  );
}

export default Layout;
