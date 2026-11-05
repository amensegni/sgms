import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "../src/database-url.js";

const rootDatabaseUrl = pathToFileURL(
  resolve(import.meta.dirname, "../../../dev.sqlite")
).href;

describe("resolveDatabaseUrl", () => {
  it("uses the repository database when no URL is configured", () => {
    expect(resolveDatabaseUrl()).toBe(rootDatabaseUrl);
  });

  it("resolves relative SQLite URLs against the repository root", () => {
    expect(resolveDatabaseUrl("file:./dev.sqlite")).toBe(rootDatabaseUrl);
  });

  it("preserves absolute SQLite URLs and query options", () => {
    expect(resolveDatabaseUrl("file:/tmp/sgms.sqlite?mode=ro")).toBe(
      `${pathToFileURL("/tmp/sgms.sqlite").href}?mode=ro`
    );
  });
});
