import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

export const resolveDatabaseUrl = (configuredUrl?: string): string => {
  const url = configuredUrl ?? "file:./dev.sqlite";
  if (!url.startsWith("file:")) {
    return url;
  }

  const [databasePath, query] = url.slice("file:".length).split("?", 2);
  if (!databasePath) {
    throw new Error("DATABASE_URL must include a SQLite database path.");
  }
  const absolutePath = isAbsolute(databasePath)
    ? databasePath
    : resolve(repositoryRoot, databasePath);
  const fileUrl = pathToFileURL(absolutePath).href;
  return query ? `${fileUrl}?${query}` : fileUrl;
};
