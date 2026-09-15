import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export class DocumentStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.storePath = path.join(dataDir, "documents.json");
  }

  async ensureReady() {
    await mkdir(this.dataDir, { recursive: true });
    try {
      await readFile(this.storePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await writeFile(this.storePath, "[]\n", "utf8");
    }
  }

  async readAll() {
    await this.ensureReady();
    const raw = await readFile(this.storePath, "utf8");
    return JSON.parse(raw);
  }

  async writeAll(documents) {
    await this.ensureReady();
    const tempPath = `${this.storePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(documents, null, 2)}\n`, "utf8");
    await writeFile(this.storePath, await readFile(tempPath));
  }

  async add(document) {
    const documents = await this.readAll();
    documents.push(document);
    await this.writeAll(documents);
    return document;
  }

  async listForUser(userId) {
    const documents = await this.readAll();
    return documents.filter((document) => document.userId === userId);
  }
}
