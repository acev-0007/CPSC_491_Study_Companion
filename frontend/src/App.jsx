import AppRoutes from "./routes/AppRoutes";
import { ThemeProvider } from "./theme/ThemeProvider";

function App() {
  return <ThemeProvider><AppRoutes /></ThemeProvider>;
}

export default App;
