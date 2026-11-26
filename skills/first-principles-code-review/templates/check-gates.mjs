#!/usr/bin/env node
/**
 * Minimal Constitutional Mechanical Gate Script (~80 lines).
 * Keep this script lean and deterministic:
 * - Mechanical red lines belong here (zero runtime cost, zero ambiguity).
 * - Semantic / architectural judgment belongs to the independent constitutional reviewer.
 * - Never build a bloated multi-thousand-line self-checking scaffold.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const violations = [];

// Customize these for your repository:
const SOURCE_DIRS = ["packages", "apps", "src"];
const BASE_SCAFFOLD_PREFIX = ""; // e.g. "@official-framework/" to block local forks
const FORBIDDEN_PATCH_DIRS = ["patches"];

function walk(dir, filter) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

// 1. Protect base scaffold from monkey-patching / pnpm patches
const rootPkgPath = join(ROOT, "package.json");
if (existsSync(rootPkgPath)) {
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
  if (rootPkg.pnpm?.patchedDependencies) {
    violations.push("package.json [NO_BASE_PATCH] Forbidden pnpm.patchedDependencies (do not patch base scaffold).");
  }
}
for (const dir of FORBIDDEN_PATCH_DIRS) {
  if (existsSync(join(ROOT, dir))) {
    violations.push(`${dir}/ [NO_BASE_PATCH] Forbidden local patch directory.`);
  }
}

// 2. Scan source files against mechanical red lines
const srcFiles = SOURCE_DIRS.flatMap((d) =>
  walk(join(ROOT, d), (p) => /\.(?:ts|tsx|js|jsx|mjs)$/.test(p) && !p.endsWith("check-gates.mjs"))
);

const RULES = [
  {
    id: "NO_EMPTY_CATCH",
    re: /(?:\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}|\.catch\s*\(\s*\([^)]*\)\s*=>\s*\{\s*\}\s*\))/g,
    msg: "Forbidden silent empty catch block (surface real errors honestly).",
  },
  {
    id: "NO_UNKNOWN_DOUBLE_CAST",
    re: /\bas\s+unknown\s+as\b/g,
    msg: "Forbidden 'as unknown as' type escape hatch (fix the shared contract instead).",
  },
  // Add project-specific red lines here (e.g., forbidden single-tenant slugs, deprecated terms, secret leaks):
  // { id: "NO_SINGLE_TENANT_HARDCODE", re: /['"`](acme-vip-tenant)['"`]/g, msg: "Forbidden single-tenant special case." },
];

for (const file of srcFiles) {
  const lines = readFileSync(file, "utf8").split("\n");
  const rel = relative(ROOT, file);
  for (const rule of RULES) {
    lines.forEach((line, idx) => {
      if (rule.re.test(line)) violations.push(`${rel}:${idx + 1} [${rule.id}] ${rule.msg}`);
      rule.re.lastIndex = 0;
    });
  }
}

// 3. Optional: forbid locally forking upstream scaffold package namespace
if (BASE_SCAFFOLD_PREFIX) {
  const pkgJsons = SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d), (p) => p.endsWith("/package.json")));
  for (const pj of pkgJsons) {
    const parsed = JSON.parse(readFileSync(pj, "utf8"));
    if (typeof parsed.name === "string" && parsed.name.startsWith(BASE_SCAFFOLD_PREFIX)) {
      violations.push(`${relative(ROOT, pj)} [NO_SCAFFOLD_FORK] Do not locally fork ${BASE_SCAFFOLD_PREFIX}*.`);
    }
  }
}

if (violations.length > 0) {
  console.error("Constitutional mechanical gate FAILED:");
  for (const v of violations) console.error("  - " + v);
  process.exit(1);
}

console.log(`check-gates PASS (${srcFiles.length} source files scanned).`);
