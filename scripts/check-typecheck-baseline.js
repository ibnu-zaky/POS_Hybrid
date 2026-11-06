#!/usr/bin/env node
"use strict";

// Ratchet checkJs: jumlah error `tsc -p apps/api/jsconfig.json` tidak boleh
// melebihi baseline, dan tidak boleh ada error baru di file yang sebelumnya
// bersih. Baseline disimpan di scripts/typecheck-baseline.json.
//
// Pakai: node scripts/check-typecheck-baseline.js
// Exit 0 = lulus, exit 1 = ratchet terlanggar.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const baselinePath = path.join(__dirname, "typecheck-baseline.json");
const tscPath = path.join(root, "apps", "web", "node_modules", ".bin", "tsc");
const jsconfigPath = path.join(root, "apps", "api", "jsconfig.json");

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

let output = "";
try {
  output = execFileSync(tscPath, ["-p", jsconfigPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  // tsc exit code 1 = ada error; output tetap di stdout/stderr.
  output = `${error.stdout || ""}${error.stderr || ""}`;
}

const errorLines = output.split("\n").filter((line) => /error TS\d+/.test(line));
const count = errorLines.length;

const filesWithErrors = [
  ...new Set(
    errorLines.map((line) => {
      const abs = line.split("(")[0];
      return path.relative(path.join(root, "apps", "api"), abs).replace(/\\/g, "/");
    }),
  ),
].sort();

const failures = [];

if (count > baseline.maxErrors) {
  failures.push(
    `Jumlah error checkJs naik: ${count} > baseline ${baseline.maxErrors}`,
  );
}

const newFiles = filesWithErrors.filter(
  (file) => !baseline.filesWithErrors.includes(file),
);
if (newFiles.length > 0) {
  failures.push(
    `Error baru di file yang sebelumnya bersih:\n  - ${newFiles.join("\n  - ")}`,
  );
}

if (failures.length > 0) {
  console.error("Ratchet checkJs GAGAL:");
  for (const failure of failures) {
    console.error(`  ${failure}`);
  }
  console.error(
    "\nJika perubahan ini disengaja, perbarui scripts/typecheck-baseline.json.",
  );
  process.exit(1);
}

console.log(
  `Ratchet checkJs lulus: ${count}/${baseline.maxErrors} error, ` +
    `${filesWithErrors.length} file dengan error (baseline ${baseline.filesWithErrors.length}).`,
);
