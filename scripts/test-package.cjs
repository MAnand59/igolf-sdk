const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "igolf-sdk-package-"));

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" },
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }

  return result.stdout.trim();
}

try {
  const packOutput = run("npm", [
    "pack",
    "--ignore-scripts",
    "--json",
    "--pack-destination",
    temporaryDirectory,
  ], projectRoot);
  const packResult = JSON.parse(packOutput)[0];
  const paths = packResult.files.map((file) => file.path);

  assert(paths.includes("dist/index.js"));
  assert(paths.includes("dist/index.d.ts"));
  assert(paths.includes("src/igolf.ts"));
  assert(paths.includes("README.md"));
  assert(paths.includes("LICENSE"));
  assert(!paths.some((file) => file.includes("dist_temp")));
  assert(!paths.some((file) => /obfuscat/i.test(file)));

  const consumerDirectory = path.join(temporaryDirectory, "consumer");
  fs.mkdirSync(consumerDirectory);
  fs.writeFileSync(path.join(consumerDirectory, "package.json"), JSON.stringify({
    private: true,
    name: "igolf-sdk-consumer-test",
    version: "1.0.0",
  }));

  const tarballPath = path.join(temporaryDirectory, packResult.filename);
  run("npm", ["install", "--ignore-scripts", tarballPath], consumerDirectory);
  const runtimeOutput = run(process.execPath, [
    "-e",
    "const sdk=require('igolf-sdk'); console.log(Object.keys(sdk).sort().join(','))",
  ], consumerDirectory);

  assert.match(runtimeOutput, /IGOLF_SIGN_METHOD/);
  assert.match(runtimeOutput, /IGolfController/);

  const esmOutput = run(process.execPath, [
    "--input-type=module",
    "-e",
    "import { IGolfController } from 'igolf-sdk'; console.log(IGolfController.name)",
  ], consumerDirectory);
  assert.equal(esmOutput, "IGolfController");

  const typeFixture = path.join(consumerDirectory, "consumer.ts");
  fs.writeFileSync(typeFixture, [
    "import { IGolfController, type IgolfConfig } from 'igolf-sdk';",
    "const config = {} as IgolfConfig;",
    "const client = new IGolfController(config);",
    "async function check() {",
    "  const response = await client.requestWithActionCode<{ Status: 1; value: number }>('Example');",
    "  if (response.stat) response.data.value.toFixed();",
    "  else response.data.toUpperCase();",
    "}",
    "void check;",
  ].join("\n"));
  run(process.execPath, [
    path.join(projectRoot, "node_modules", "typescript", "bin", "tsc"),
    "--noEmit",
    "--strict",
    "--target",
    "ES2022",
    "--module",
    "CommonJS",
    "--moduleResolution",
    "Node",
    typeFixture,
  ], consumerDirectory);

  process.stdout.write(`Verified ${packResult.filename} in a clean consumer project.\n`);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
