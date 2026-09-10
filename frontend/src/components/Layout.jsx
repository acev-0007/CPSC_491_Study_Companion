import { Outlet } from "react-router-dom";

function Layout() {
  return (
    <div>
      <header>
        <h1>AI Study Companion</h1>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
