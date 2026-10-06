import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const apiRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../../", import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), "utf8");
const readRepo = (path) => readFileSync(new URL(path, repoRoot), "utf8");

test("Swagger/OpenAPI được bật cho local dev và có JSON endpoint ổn định", () => {
  const main = readApi("src/main.ts");
  const packageJson = JSON.parse(readApi("package.json"));

  assert.equal(packageJson.dependencies["@nestjs/swagger"], "^11.4.7");
  assert.match(main, /SwaggerModule\.setup\("docs"/);
  assert.match(main, /jsonDocumentUrl:\s*"docs-json"/);
  assert.match(main, /deepScanRoutes:\s*true/);
  assert.match(main, /addBearerAuth/);
  assert.match(main, /addSecurityRequirements\("kaitokid-jwt"\)/);
  assert.match(main, /NODE_ENV !== "production"/);
  assert.match(main, /SWAGGER_ENABLED/);
});

test("Node launcher tự cài dependency Swagger khi node_modules cũ", () => {
  const launcher = readRepo("scripts/run-node-api.bat");
  assert.match(launcher, /node_modules\\@nestjs\\swagger\\package\.json/);
  assert.match(launcher, /call npm install/);
});

test("Swagger có runbook vận hành trong cùng thay đổi", () => {
  assert.equal(existsSync(new URL("docs/runbooks/SWAGGER_API_DOCS.md", repoRoot)), true);
});
