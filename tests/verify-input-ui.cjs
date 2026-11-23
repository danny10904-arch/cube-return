const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Cube = require("../vendor/cubejs/cube");

const elements = new Map();
const documentListeners = {};
const animationFrames = [];
function element() {
  return {
    innerHTML: "", textContent: "", className: "", disabled: false, hidden: false, value: "", dataset: {}, listeners: {}, drawCalls: 0,
    addEventListener(name, listener) { this.listeners[name] = listener; },
    querySelector() { return { style: {} }; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 440, height: 370 }; },
    getContext() {
      const owner = this;
      return { clearRect() {}, beginPath() { owner.drawCalls += 1; }, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, ellipse() {}, lineJoin: "" };
    },
    classList: { add() {}, remove() {}, toggle() {} },
  };
}

global.window = { Cube, requestAnimationFrame(callback) { animationFrames.push(callback); return animationFrames.length; }, cancelAnimationFrame() {} };
global.document = {
  querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  },
  addEventListener(name, listener) { documentListeners[name] = listener; },
};

vm.runInThisContext(fs.readFileSync("app.js", "utf8"));
assert.ok(elements.get("#cubeCanvas").drawCalls >= 60, "The Canvas renderer should draw all six faces and 54 stickers.");

const initialYaw = vm.runInThisContext("rotation.y");
elements.get("#cubeCanvas").listeners.pointerdown({
  clientX: 100, clientY: 100, pointerId: 1, preventDefault() {}, target: { closest: () => null },
});
elements.get("#cubeCanvas").listeners.pointermove({ clientX: 145, clientY: 100, pointerId: 1, preventDefault() {} });
elements.get("#cubeCanvas").listeners.pointerup({ clientX: 145, clientY: 100, pointerId: 1, preventDefault() {} });
assert.notEqual(vm.runInThisContext("rotation.y"), initialYaw, "The cube should be draggable immediately after page load.");

elements.get("#cubeCanvas").listeners.pointerdown({
  clientX: 100, clientY: 100, pointerId: 1, target: { closest: (selector) => selector === ".cube-sticker" ? { dataset: { face: "U", index: "0" } } : null },
});
elements.get("#cubeCanvas").listeners.pointerup({
  clientX: 100, clientY: 100, pointerId: 1, target: { closest: () => null },
});
assert.equal(elements.get("#colorPicker").hidden, false, "Clicking an edge/corner sticker should open the colour picker.");
assert.equal((elements.get("#colorOptions").innerHTML.match(/color-option/g) || []).length, 6, "Colour picker should show six colour choices.");
assert.doesNotMatch(elements.get("#colorOptions").innerHTML, /disabled/, "Input should not pre-emptively block any colour on a partial cube.");
elements.get("#cubeCanvas").listeners.pointerdown({
  clientX: 100, clientY: 100, pointerId: 1, target: { closest: (selector) => selector === ".cube-sticker" ? { dataset: { face: "U", index: "4" } } : null },
});
elements.get("#cubeCanvas").listeners.pointerup({ clientX: 100, clientY: 100, pointerId: 1, target: { closest: () => null } });
assert.equal(vm.runInThisContext("stickers.U[4]"), "Y", "The yellow centre must remain locked.");
assert.equal(vm.runInThisContext("selected.index"), 0, "Clicking a centre must not select it for editing.");
vm.runInThisContext("stickers.U[4] = 'R'; selected = { face: 'U', index: 4 }; changeSticker('B'); render();");
assert.equal(vm.runInThisContext("stickers.U[4]"), "Y", "Centres must be restored even if a stale selection attempts to alter one.");
const centreTargets = vm.runInThisContext("FACE_ORDER.flatMap((face) => Array.from({ length: 9 }, (_, index) => ({ face, index }))).filter((current) => current.index !== 4).flatMap((current) => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map((direction) => editableAdjacentSelection(current, direction))).filter((target) => target.index === 4).length");
assert.equal(centreTargets, 0, "Arrow navigation must always skip every face centre.");
vm.runInThisContext("selected = { face: 'U', index: 0 }; render();");
documentListeners.keydown({ key: "ArrowRight", target: { tagName: "CANVAS" }, preventDefault() {} });
assert.equal(vm.runInThisContext("selected.index"), 1, "Right arrow should move selection to the next sticker.");
documentListeners.keydown({ key: "3", target: { tagName: "CANVAS" }, preventDefault() {} });
assert.equal(vm.runInThisContext("stickers.U[1]"), "R", "Number 3 should assign red to the selected sticker.");

elements.get("#colorOptions").listeners.click({
  target: { closest: (selector) => selector === "[data-color]" ? { dataset: { color: "Y" }, disabled: false } : null },
});
assert.ok(elements.get("#cubeCanvas").drawCalls > 60, "Selected colour should trigger a new 3D cube render.");

// Feed a legal scrambled state through the same sticker-click route. The UI
// should recognise it as valid after all 48 non-centre stickers are supplied.
elements.get("#clearCube").listeners.click();
const scrambled = new Cube();
["R", "U", "R"].forEach((move) => scrambled.move(move));
const state = scrambled.asString();
const order = ["U", "R", "F", "D", "L", "B"];
const faceColours = { U: "Y", R: "G", F: "R", D: "W", L: "B", B: "O" };
order.forEach((face, faceIndex) => {
  for (let index = 0; index < 9; index += 1) {
    if (index === 4) continue;
    const color = faceColours[state[faceIndex * 9 + index]];
    elements.get("#cubeCanvas").listeners.pointerdown({
      clientX: 100, clientY: 100, pointerId: 1, target: { closest: (selector) => selector === ".cube-sticker" ? { dataset: { face, index: String(index) } } : null },
    });
    elements.get("#cubeCanvas").listeners.pointerup({
      clientX: 100, clientY: 100, pointerId: 1, target: { closest: () => null },
    });
    elements.get("#colorOptions").listeners.click({
      target: { closest: (selector) => selector === "[data-color]" ? { dataset: { color }, disabled: false } : null },
    });
  }
});
assert.match(elements.get("#validity").textContent, /有效/, "A complete legal cube state should pass validation.");
vm.runInThisContext("solverReady = true; render();");
assert.equal(elements.get("#solveButton").disabled, false, "A valid scrambled cube should enable the 20-step solve button once the solver is ready.");
assert.equal(elements.get("#mobileSolutionActions").hidden, true, "Mobile playback controls should remain hidden until a formula has been generated.");
vm.runInThisContext("solverReady = false; render();");
assert.equal(elements.get("#solveButton").disabled, false, "A completed cube should keep the solve button clickable while the solver is still preparing.");
vm.runInThisContext("solverReady = true; render();");

const pitchBeforeUpDrag = vm.runInThisContext("rotation.x");
elements.get("#cubeCanvas").listeners.pointerdown({ clientX: 100, clientY: 100, pointerId: 1, target: { closest: () => null } });
elements.get("#cubeCanvas").listeners.pointermove({ clientX: 100, clientY: 10, pointerId: 1 });
elements.get("#cubeCanvas").listeners.pointerup({ clientX: 100, clientY: 10, pointerId: 1 });
assert.ok(vm.runInThisContext("rotation.x") < pitchBeforeUpDrag, "Dragging upward should tilt the view toward the bottom face.");

vm.runInThisContext("rotation = { x: 0, y: 180 }; selected = { face: 'B', index: 0 }; moveKeyboardSelection('ArrowRight');");
assert.equal(vm.runInThisContext("selected.face + selected.index"), "B1", "Arrow navigation should follow the currently viewed back face rather than fixed centre colours.");
const yellowDown = vm.runInThisContext("(() => { rotation = { x: 27, y: -36 }; selected = { face: 'U', index: 0 }; const before = rotatePoint(stickerCentre(selected)); moveKeyboardSelection('ArrowDown'); const after = rotatePoint(stickerCentre(selected)); return -(after[1] - before[1]); })()");
assert.ok(yellowDown > 0, "Down arrow on the yellow face should move toward the bottom of the screen.");
const redDown = vm.runInThisContext("(() => { rotation = { x: 27, y: -36 }; selected = { face: 'F', index: 0 }; const before = rotatePoint(stickerCentre(selected)); moveKeyboardSelection('ArrowDown'); const after = rotatePoint(stickerCentre(selected)); return -(after[1] - before[1]); })()");
assert.ok(redDown > 0, "Down arrow on the red face should move toward the bottom of the screen.");

vm.runInThisContext("rotation = { x: 0, y: 90 }; render();");
assert.equal(vm.runInThisContext("viewAdjustedMove('F')"), "R", "Formula notation should remap when the user rotates the cube view.");

vm.runInThisContext("solution = ['R', 'U']; solutionStart = validateCube().cube.toJSON(); solutionCube = new Cube(solutionStart); solutionIndex = 0; hasSolution = true; render();");
assert.match(elements.get("#orientationGuide").textContent, /前：藍/, "The orientation guide should identify the colour currently facing the user.");
assert.equal(elements.get("#baseFormula").textContent, "R U", "The original centre-based formula should remain available after the view formula is remapped.");
assert.equal(elements.get("#mobileSolutionActions").hidden, false, "Mobile playback controls should appear when a formula is available.");
assert.equal(typeof elements.get("#mobileNextMove").listeners.click, "function", "The mobile next-step button should trigger guided playback.");
document.querySelector("#animationSpeed").value = "0";
assert.equal(vm.runInThisContext("animationDuration()"), 600, "The speed slider should use 0.6 seconds at the fast endpoint without displaying a numeric duration.");
document.querySelector("#animationSpeed").value = "50";
assert.equal(vm.runInThisContext("animationDuration()"), 1200, "The slider centre should use the 1.2-second default pace.");
document.querySelector("#animationSpeed").value = "100";
assert.equal(vm.runInThisContext("animationDuration()"), 2000, "The slow endpoint should use two seconds per move.");
document.querySelector("#animationSpeed").value = "0";
elements.get("#nextMove").listeners.click({});
assert.equal(vm.runInThisContext("animationPlaying"), false, "Next-step mode should animate only one move without starting continuous playback.");
animationFrames.shift()(0);
animationFrames.shift()(700);
assert.equal(vm.runInThisContext("solutionIndex"), 1, "Animation mode should apply one guided move after its turn animation.");
elements.get("#animateToggle").listeners.click({});
assert.equal(vm.runInThisContext("animationPlaying"), true, "Continuous playback should start from the next move.");
assert.equal(elements.get("#solutionCount").textContent, vm.runInThisContext("viewAdjustedMove(solution[solutionIndex])"), "Continuous playback should show the pending formula where the total step count normally appears.");
animationFrames.shift()(0);
animationFrames.shift()(700);
assert.equal(vm.runInThisContext("solutionIndex"), 2, "Continuous playback should continue through the remaining move.");
assert.equal(vm.runInThisContext("animationPlaying"), false, "Animation mode should stop after the final move.");
assert.equal(elements.get("#solutionCount").textContent, "2 步", "The total step count should return after continuous playback finishes.");
elements.get("#moves").listeners.click({ target: { closest: (selector) => selector === "[data-step]" ? { dataset: { step: "1" } } : null } });
assert.equal(vm.runInThisContext("solutionIndex"), 1, "Clicking a move should reset the cube and start from that move.");

console.log("Verified free 3D cube input: picker, keyboard shortcuts, speed control, step jumping, and animated move playback.");
