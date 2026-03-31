import fs from "fs";
import path from "path";

/** Repo-root `agents/` directory (server-only). */
export function getAgentsRoot(): string {
  return path.join(process.cwd(), "agents");
}

export function readAgentFile(relativePath: string): string {
  const full = path.join(getAgentsRoot(), relativePath);
  return fs.readFileSync(full, "utf8");
}

export function fileExists(relativePath: string): boolean {
  try {
    return fs.existsSync(path.join(getAgentsRoot(), relativePath));
  } catch {
    return false;
  }
}
