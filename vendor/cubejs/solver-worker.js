/* cube.js worker wrapper — runs the expensive table generation off the UI thread. */
importScripts("cube.js", "solve.js");

let ready = false;

self.onmessage = (event) => {
  const { type, cube, maxDepth = 20 } = event.data;
  if (type === "init") {
    Cube.initSolver();
    ready = true;
    self.postMessage({ type: "ready" });
    return;
  }
  if (type === "solve" && ready) {
    const state = new Cube(cube);
    self.postMessage({ type: "solution", algorithm: state.solve(maxDepth) });
  }
};
