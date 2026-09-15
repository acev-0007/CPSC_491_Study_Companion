import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 3001);

const app = createApp({
  dataDir: path.join(backendRoot, "data"),
  uploadDir: path.join(backendRoot, "data", "uploads"),
});

app.listen(port, () => {
  console.log(`Textbook Hub mock backend listening on http://localhost:${port}`);
});
