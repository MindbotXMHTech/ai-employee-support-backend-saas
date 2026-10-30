import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function filesUnder(relativeDir: string): string[] {
  const absoluteDir = join(repoRoot, relativeDir);
  const found: string[] = [];
  for (const name of readdirSync(absoluteDir)) {
    const path = join(absoluteDir, name);
    if (statSync(path).isDirectory()) {
      found.push(...filesUnder(join(relativeDir, name)));
    } else {
      found.push(path);
    }
  }
  return found;
}

const sessionReset = /reset_ai_session_base|\breset_base\b|\bresetBase\b/;

describe("AI session base reset schedule", () => {
  it("does not reset session base from a job route or the trial downgrade", () => {
    const paths = [
      ...filesUnder("src/app/api/jobs"),
      join(repoRoot, "src/lib/services/tenantService.ts"),
    ];
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(sessionReset);
    }
  });

  it("does not schedule a session reset in SQL", () => {
    const migrations = filesUnder("supabase/migrations");
    expect(migrations.length).toBeGreaterThan(0);
    for (const path of migrations) {
      expect(readFileSync(path, "utf8").toLowerCase(), path).not.toMatch(/cron\.schedule|pg_cron/);
    }
  });
});
