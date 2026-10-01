import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar/Sidebar";
import "./Layout.css";

function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        <div className="app-main-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
