#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packagesDir = path.join(root, "docs", "dynaxis", "program", "work-packages");
const statuses = ["in_progress", "review", "ready", "blocked", "backlog", "done"];
const allowedStatuses = new Set(["backlog", "ready", "in_progress", "review", "blocked", "done"]);
const allowedAgents = new Set(["unassigned", "codex", "claude", "cursor"]);
const wpIdPattern = /^WP-(7[C-I]|8[A-H]|9|10)-\d{2,}$/;

async function listMarkdownFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(fullPath);
      if (entry.isFile() && entry.name.endsWith(".md")) return [fullPath];
      return [];
    }),
  );

  return files.flat();
}

function parseFrontMatter(source, file) {
  if (!source.startsWith("---\n")) return { file, fields: {}, errors: ["missing front matter"] };

  const end = source.indexOf("\n---", 4);
  if (end === -1) return { file, fields: {}, errors: ["unterminated front matter"] };

  const fields = {};
  const errors = [];
  const lines = source.slice(4, end).split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!match) {
      errors.push(`unsupported front matter line: ${line}`);
      continue;
    }

    fields[match[1]] = parseScalar(match[2]);
  }

  return { file, fields, errors };
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "[]") return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

function validate(pkg) {
  const { fields, errors } = pkg;

  if (!fields.id || !wpIdPattern.test(fields.id)) errors.push("invalid id");
  if (!fields.status || !allowedStatuses.has(fields.status)) errors.push("invalid status");
  if (!fields.agent || !allowedAgents.has(fields.agent)) errors.push("invalid agent");

  return { ...pkg, errors };
}

function relative(file) {
  return path.relative(root, file);
}

const files = await listMarkdownFiles(packagesDir);
const packages = (await Promise.all(files.map(async (file) => parseFrontMatter(await readFile(file, "utf8"), file)))).map(validate);

if (packages.length === 0) {
  console.log("No Work Packages found.");
  process.exit(0);
}

for (const status of statuses) {
  const group = packages
    .filter((pkg) => pkg.fields.status === status)
    .sort((a, b) => String(a.fields.id).localeCompare(String(b.fields.id)));

  console.log(`\n${status}`);
  console.log("-".repeat(status.length));

  if (group.length === 0) {
    console.log("(none)");
    continue;
  }

  for (const pkg of group) {
    const id = pkg.fields.id ?? "(missing id)";
    const agent = pkg.fields.agent ?? "(missing agent)";
    const title = pkg.fields.title ?? "(missing title)";
    const errors = pkg.errors.length ? ` [INVALID: ${pkg.errors.join("; ")}]` : "";
    console.log(`${id.padEnd(10)} ${agent.padEnd(10)} ${title}${errors}`);
  }
}

const invalid = packages.filter((pkg) => pkg.errors.length);
if (invalid.length > 0) {
  console.error("\nInvalid Work Packages:");
  for (const pkg of invalid) {
    console.error(`- ${relative(pkg.file)}: ${pkg.errors.join("; ")}`);
  }
  process.exit(1);
}
