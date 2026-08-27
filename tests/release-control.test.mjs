import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const sot = readFileSync(new URL("../SOT.md", import.meta.url), "utf8");
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");

test("Cloudflare identity and primary D1 metadata are pinned to the verified control plane", () => {
  assert.match(wrangler, /^account_id\s*=\s*"eb1a8dd5723031d94e57642e3eaaebda"$/m);
  assert.match(
    wrangler,
    /\[\[d1_databases\]\]\s*binding\s*=\s*"DB"\s*database_name\s*=\s*"lighthouse"\s*database_id\s*=\s*"e46f2daa-7e97-45a3-9bf0-49003a42850c"/m
  );
});

test("production deployment is manual, main-only, serialized, gated, and receipted", () => {
  const triggerBlock = workflow
    .slice(workflow.indexOf("on:"), workflow.indexOf("concurrency:"))
    .trim()
    .replace(/\r\n/g, "\n");
  assert.equal(triggerBlock, "on:\n  workflow_dispatch:");
  assert.match(workflow, /group:\s*lighthouse-production/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.match(workflow, /GITHUB_REF[^\n]*refs\/heads\/main/);
  assert.doesNotMatch(workflow, /accountId:|CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(workflow, /deployments:\s*write/);

  const mainGuard = workflow.indexOf("GITHUB_REF");
  const install = workflow.indexOf("npm ci");
  const typecheck = workflow.indexOf("npm run typecheck");
  const tests = workflow.indexOf("npm test");
  const deploy = workflow.indexOf("command: deploy --keep-vars --strict");
  const receipt = workflow.indexOf("command: deployments status --json");
  assert.ok(mainGuard >= 0 && mainGuard < install);
  assert.ok(install < typecheck);
  assert.ok(typecheck < tests && tests < deploy);
  assert.ok(deploy < receipt);
  assert.match(workflow, /id:\s*production_deploy/);
  assert.match(workflow, /always\(\)[^\n]*steps\.production_deploy\.outcome[^\n]*'skipped'/);
});

test("operator scripts expose reads and upload without a direct production bypass", () => {
  assert.equal(packageJson.scripts.deploy, undefined);
  assert.equal(packageJson.scripts["release:deploy"], undefined);
  assert.equal(packageJson.scripts["release:upload"], "wrangler versions upload");
  assert.equal(packageJson.scripts["release:status"], "wrangler deployments status --json");
  assert.equal(packageJson.scripts["release:history"], "wrangler deployments list --json");
  assert.equal(packageJson.repository.url, "git+https://github.com/True-Good-Craft/lighthouse.git");
});

test("the mandatory release-control bundle records the verified external receipt", () => {
  assert.equal(packageJson.version, "1.29.4");
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
  assert.match(sot, /^## Release-control and infrastructure reconciliation — v1\.29\.4$/m);
  assert.match(changelog, /^## \[1\.29\.4\] - 2026-08-26$/m);
  assert.match(
    sot,
    /\*\*External release-control verification — 2026-08-26:\*\*[\s\S]*Deploy command[\s\S]*Version command[\s\S]*exactly `npx wrangler versions upload`/
  );
  assert.match(sot, /Workers Builds may now create version or preview state[\s\S]*must not promote active traffic/);
  assert.match(sot, /`CLOUDFLARE_API_TOKEN` remain unverified/);
  assert.doesNotMatch(sot, /production command (?:remains|still uses|still runs) `npx wrangler deploy`/i);
});
