const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Cube = require("../vendor/cubejs/cube");

// Execute the browser worker in a small Node harness, so the same worker entry
// point used by the website is checked rather than only the underlying library.
global.Cube = Cube;
const workerDirectory = "vendor/cubejs/";
const messages = [];
global.self = { postMessage: (message) => messages.push(message) };
global.importScripts = (...files) => files
  .filter((file) => file !== "cube.js")
  .forEach((file) => vm.runInThisContext(fs.readFileSync(`${workerDirectory}${file}`, "utf8")));

vm.runInThisContext(fs.readFileSync(`${workerDirectory}solver-worker.js`, "utf8"));
self.onmessage({ data: { type: "init" } });
assert.equal(messages[0]?.type, "ready", "Solver worker should initialise.");

const scrambled = new Cube();
["R", "U", "R"].forEach((move) => scrambled.move(move));
self.onmessage({ data: { type: "solve", cube: scrambled.toJSON(), maxDepth: 20 } });

const solution = messages.find((message) => message.type === "solution")?.algorithm;
assert.ok(solution, "20-step mode should return a solution for the regression scramble.");
assert.ok(solution.split(/\s+/).length <= 20, "Solution must respect the 20-step limit.");
scrambled.move(solution);
assert.equal(scrambled.asString(), new Cube().asString(), "Returned algorithm should solve the cube.");

console.log(`Verified worker solution: ${solution} (${solution.split(/\s+/).length} moves).`);
