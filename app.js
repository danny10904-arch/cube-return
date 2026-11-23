const $ = (selector) => document.querySelector(selector);
const Cube = window.Cube;

const FACE_COLORS = { U: "Y", R: "G", F: "R", D: "W", L: "B", B: "O" };
const COLOR_TO_FACE = { Y: "U", G: "R", R: "F", W: "D", B: "L", O: "B" };
const COLOR_META = {
  Y: { name: "黃", css: "yellow" }, W: { name: "白", css: "white" }, R: { name: "紅", css: "red" },
  B: { name: "藍", css: "blue" }, O: { name: "橘", css: "orange" }, G: { name: "綠", css: "green" },
};
const COLOR_ORDER = ["Y", "W", "R", "G", "B", "O"];
const COLOR_KEYS = { 1: "Y", 2: "W", 3: "R", 4: "G", 5: "B", 6: "O" };
const COLOR_KEY_LABELS = { Y: "1", W: "2", R: "3", G: "4", B: "5", O: "6" };
const FACE_NAMES = { U: "黃色頂面", R: "綠色右面", F: "紅色前面", D: "白色底面", L: "藍色左面", B: "橘色後面" };
const FACE_ORDER = ["U", "R", "F", "D", "L", "B"];

const EDGES = [
  { id: "UR", facelets: [["U", 5], ["R", 1]] }, { id: "UF", facelets: [["U", 7], ["F", 1]] }, { id: "UL", facelets: [["U", 3], ["L", 1]] }, { id: "UB", facelets: [["U", 1], ["B", 1]] },
  { id: "DR", facelets: [["D", 5], ["R", 7]] }, { id: "DF", facelets: [["D", 1], ["F", 7]] }, { id: "DL", facelets: [["D", 3], ["L", 7]] }, { id: "DB", facelets: [["D", 7], ["B", 7]] },
  { id: "FR", facelets: [["F", 5], ["R", 3]] }, { id: "FL", facelets: [["F", 3], ["L", 5]] }, { id: "BL", facelets: [["B", 5], ["L", 3]] }, { id: "BR", facelets: [["B", 3], ["R", 5]] },
];
const CORNERS = [
  { id: "URF", facelets: [["U", 8], ["R", 0], ["F", 2]] }, { id: "UFL", facelets: [["U", 6], ["F", 0], ["L", 2]] }, { id: "ULB", facelets: [["U", 0], ["L", 0], ["B", 2]] }, { id: "UBR", facelets: [["U", 2], ["B", 0], ["R", 2]] },
  { id: "DFR", facelets: [["D", 2], ["F", 8], ["R", 6]] }, { id: "DLF", facelets: [["D", 0], ["L", 8], ["F", 6]] }, { id: "DBL", facelets: [["D", 6], ["B", 8], ["L", 6]] }, { id: "DRB", facelets: [["D", 8], ["R", 8], ["B", 6]] },
];
const EDGE_TYPES = EDGES.map((position) => position.facelets.map(([face]) => FACE_COLORS[face]));
const CORNER_TYPES = CORNERS.map((position) => position.facelets.map(([face]) => FACE_COLORS[face]));
const PIECES = [...EDGES.map((position) => ({ ...position, kind: "edge" })), ...CORNERS.map((position) => ({ ...position, kind: "corner" }))];
const pieceBySticker = new Map(PIECES.flatMap((piece) => piece.facelets.map(([face, index]) => [`${face}-${index}`, piece])));
const FACE_GEOMETRY = {
  U: { normal: [0, 1, 0], horizontal: [1, 0, 0], vertical: [0, 0, 1] },
  D: { normal: [0, -1, 0], horizontal: [1, 0, 0], vertical: [0, 0, -1] },
  F: { normal: [0, 0, 1], horizontal: [1, 0, 0], vertical: [0, -1, 0] },
  B: { normal: [0, 0, -1], horizontal: [-1, 0, 0], vertical: [0, -1, 0] },
  R: { normal: [1, 0, 0], horizontal: [0, 0, -1], vertical: [0, -1, 0] },
  L: { normal: [-1, 0, 0], horizontal: [0, 0, 1], vertical: [0, -1, 0] },
};
const DRAW_COLORS = { Y: "#FFFF37", W: "#eff5f1", R: "#FF0000", B: "#0C7ACF", O: "#FF8000", G: "#00EC00", unknown: "#334b58" };
const VIEW_AXES = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
const VIEW_LABELS = { U: "上", D: "下", F: "前", B: "後", R: "右", L: "左" };

const stickers = Object.fromEntries(FACE_ORDER.map((face) => [face, Array(9).fill(null)]));
Object.entries(FACE_COLORS).forEach(([face, color]) => { stickers[face][4] = color; });

let selected = null;
let rotation = { x: 27, y: -36 };
let solverReady = false;
let solving = false;
let worker;
let solverMode = "none";
let mainSolverQueued = false;
let solution = [];
let solutionCube = null;
let solutionStart = null;
let solutionIndex = 0;
let hasSolution = false;
let toastTimer;
let dragStart = null;
let dragDistance = 0;
let cubeHits = [];
let animation = null;
let animationFrame = null;
let animationTimer = null;
let animationPlaying = false;

function displayedColor(face, index) {
  if (index === 4) return FACE_COLORS[face];
  if (!solutionCube) return stickers[face][index];
  const string = solutionCube.asString();
  const offset = FACE_ORDER.indexOf(face) * 9;
  return FACE_COLORS[string[offset + index]];
}

function lockCentres() { Object.entries(FACE_COLORS).forEach(([face, color]) => { stickers[face][4] = color; }); }
function filledCount() { return FACE_ORDER.reduce((sum, face) => sum + stickers[face].filter((color, index) => index !== 4 && color).length, 0); }
function stickerValue(face, index, proposed) { return proposed?.face === face && proposed?.index === index ? proposed.color : stickers[face][index]; }
function coloursOfPiece(piece, proposed) { return piece.facelets.map(([face, index]) => stickerValue(face, index, proposed)); }
function key(colors) { return [...colors].sort().join(""); }

function allowedColorForSelection() {
  // Do not reject a partial observation: the exact cubie/orientation check runs
  // once every sticker is entered, so a real cube is never blocked mid-input.
  return Boolean(selected);
}

function cubeString() { return FACE_ORDER.map((face) => stickers[face].map((color, index) => COLOR_TO_FACE[index === 4 ? FACE_COLORS[face] : color]).join("")).join(""); }
function parity(permutation) { let inv = 0; for (let i = 0; i < permutation.length; i += 1) for (let j = i + 1; j < permutation.length; j += 1) if (permutation[i] > permutation[j]) inv += 1; return inv % 2; }

function validateCube() {
  lockCentres();
  if (filledCount() < 48) return { complete: false, valid: false, message: `還有 ${48 - filledCount()} 格尚未填色` };
  for (const color of Object.keys(COLOR_META)) {
    const count = FACE_ORDER.reduce((sum, face) => sum + stickers[face].filter((value) => value === color).length, 0);
    if (count !== 9) return { valid: false, message: `${COLOR_META[color].name}色必須剛好有 9 格` };
  }
  try {
    const string = cubeString();
    const cube = Cube.fromString(string);
    if (cube.asString() !== string) return { valid: false, message: "有重複或不存在的邊塊／角塊色組" };
    if (cube.eo.reduce((sum, value) => sum + value, 0) % 2) return { valid: false, message: "邊塊翻轉方向不可能" };
    if (cube.co.reduce((sum, value) => sum + value, 0) % 3) return { valid: false, message: "角塊轉向不可能" };
    if (parity(cube.ep) !== parity(cube.cp)) return { valid: false, message: "邊塊與角塊的排列奇偶不一致" };
    return { complete: true, valid: true, cube, message: cube.isSolved() ? "方塊已解好" : "方塊狀態有效，可開始求解" };
  } catch { return { valid: false, message: "這個方塊狀態無法建立" }; }
}

function setStatus(text, type = "") { const status = $("#solverStatus"); status.className = `solver-status ${type}`; status.innerHTML = `<i></i> ${text}`; }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600); }

function add(a, b, scale = 1) { return [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale]; }
function rotatePoint([x, y, z]) {
  const yaw = rotation.y * Math.PI / 180; const pitch = rotation.x * Math.PI / 180;
  const yawX = x * Math.cos(yaw) + z * Math.sin(yaw); const yawZ = -x * Math.sin(yaw) + z * Math.cos(yaw);
  return [yawX, y * Math.cos(pitch) - yawZ * Math.sin(pitch), y * Math.sin(pitch) + yawZ * Math.cos(pitch)];
}
function shade(hex, amount) {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return `rgb(${rgb.map((value) => Math.round(Math.min(255, value * amount))).join(",")})`;
}
function pointOnFace(face, horizontal, vertical) {
  const geometry = FACE_GEOMETRY[face];
  return add(add(geometry.normal, geometry.horizontal, horizontal), geometry.vertical, vertical);
}
function project(point, width, height) {
  const rotated = rotatePoint(point); const factor = 4.8 / (4.8 - rotated[2]); const scale = Math.min(width, height) * .29;
  return { x: width / 2 + rotated[0] * scale * factor, y: height / 2 - rotated[1] * scale * factor, z: rotated[2], factor };
}
function polygon(context, points, fill, stroke, width = 1) {
  context.beginPath(); context.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => context.lineTo(point.x, point.y)); context.closePath();
  if (fill) { context.fillStyle = fill; context.fill(); }
  if (stroke) { context.lineWidth = width; context.strokeStyle = stroke; context.stroke(); }
}
function isInside(point, polygonPoints) {
  let inside = false;
  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i, i += 1) {
    const a = polygonPoints[i]; const b = polygonPoints[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function rotateAroundAxis(point, axis, angle) {
  const cosine = Math.cos(angle); const sine = Math.sin(angle); const projection = dot(axis, point) * (1 - cosine);
  return [
    point[0] * cosine + (axis[1] * point[2] - axis[2] * point[1]) * sine + axis[0] * projection,
    point[1] * cosine + (axis[2] * point[0] - axis[0] * point[2]) * sine + axis[1] * projection,
    point[2] * cosine + (axis[0] * point[1] - axis[1] * point[0]) * sine + axis[2] * projection,
  ];
}
function animatedTile(face, worldPoints) {
  if (!animation) return { worldPoints, normal: FACE_GEOMETRY[face].normal };
  const axis = FACE_GEOMETRY[animation.move[0]].normal;
  const isOnLayer = Math.max(...worldPoints.map((point) => dot(point, axis))) > .9;
  if (!isOnLayer) return { worldPoints, normal: FACE_GEOMETRY[face].normal };
  const turns = animation.move.endsWith("2") ? 2 : 1; const direction = animation.move.endsWith("'") ? 1 : -1;
  const angle = direction * turns * Math.PI / 2 * animation.progress;
  return { worldPoints: worldPoints.map((point) => rotateAroundAxis(point, axis, angle)), normal: rotateAroundAxis(FACE_GEOMETRY[face].normal, axis, angle) };
}

function renderCube() {
  const canvas = $("#cubeCanvas"); if (!canvas?.getContext) return;
  const rect = canvas.getBoundingClientRect?.() || { width: 440, height: 370 }; const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round((rect.width || 440) * ratio)); const height = Math.max(1, Math.round((rect.height || 370) * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const context = canvas.getContext("2d"); context.clearRect(0, 0, width, height); context.lineJoin = "round";
  context.beginPath(); context.ellipse(width / 2, height * .76, width * .22, height * .055, 0, 0, Math.PI * 2); context.fillStyle = "rgba(0,0,0,.26)"; context.fill();
  const faces = FACE_ORDER.map((face) => {
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([horizontal, vertical]) => project(pointOnFace(face, horizontal, vertical), width, height));
    return { face, corners, depth: corners.reduce((sum, point) => sum + point.z, 0) / 4 };
  }).sort((a, b) => a.depth - b.depth);
  faces.forEach(({ corners }) => polygon(context, corners, "#07141e", "rgba(230,246,245,.18)", 2 * ratio));
  const tiles = [];
  FACE_ORDER.forEach((face) => {
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
      const index = row * 3 + column; const cell = 2 / 3; const gap = 0;
      const left = -1 + column * cell + gap; const right = -1 + (column + 1) * cell - gap;
      const top = -1 + row * cell + gap; const bottom = -1 + (row + 1) * cell - gap;
      const rawPoints = [[left, top], [right, top], [right, bottom], [left, bottom]].map(([horizontal, vertical]) => pointOnFace(face, horizontal, vertical));
      const transformed = animatedTile(face, rawPoints); const points = transformed.worldPoints.map((point) => project(point, width, height));
      tiles.push({ face, index, points, normal: transformed.normal, depth: points.reduce((sum, point) => sum + point.z, 0) / 4 });
    }
  });
  tiles.sort((a, b) => a.depth - b.depth).forEach((tile) => {
    const color = displayedColor(tile.face, tile.index); const normalDepth = rotatePoint(tile.normal)[2]; const light = Math.max(.62, Math.min(1.12, .86 + normalDepth * .2));
    polygon(context, tile.points, shade(DRAW_COLORS[color] || DRAW_COLORS.unknown, light), "#020405", 1.2 * ratio);
    if (selected?.face === tile.face && selected?.index === tile.index) polygon(context, tile.points, null, "#c5ff6a", 4 * ratio);
  });
  cubeHits = tiles;
}

function pickSticker(event) {
  const legacySticker = event.target?.closest?.(".cube-sticker");
  if (legacySticker) return { face: legacySticker.dataset.face, index: Number(legacySticker.dataset.index) };
  const canvas = $("#cubeCanvas"); const rect = canvas.getBoundingClientRect();
  const point = { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  return [...cubeHits].reverse().find((hit) => isInside(point, hit.points)) || null;
}

function renderPicker() {
  const picker = $("#colorPicker");
  if (!selected || selected.index === 4) { picker.hidden = true; return; }
  const piece = pieceBySticker.get(`${selected.face}-${selected.index}`);
  $("#pickerLabel").textContent = `${FACE_NAMES[selected.face]} · ${piece.id}：選擇顏色`;
  $("#colorOptions").innerHTML = COLOR_ORDER.map((color) => {
    const meta = COLOR_META[color];
    return `<button class="color-option ${meta.css}" data-color="${color}" type="button" aria-label="${COLOR_KEY_LABELS[color]}：選 ${meta.name}色" ${allowedColorForSelection(color) ? "" : "disabled"}><span>${COLOR_KEY_LABELS[color]}</span></button>`;
  }).join("");
  picker.hidden = false;
}

function renderSolution() {
  const check = validateCube();
  $("#fillCount").textContent = `已填入 ${filledCount()} / 48`;
  const validity = $("#validity"); validity.textContent = check.message; validity.classList.toggle("valid", check.valid);
  $("#solveButton").disabled = filledCount() < 48 || solving;
  $("#solutionEmpty").hidden = hasSolution;
  $("#solutionContent").hidden = !hasSolution;
  $("#mobileSolutionActions").hidden = !hasSolution;
  $("#mobileAnimationSpeedControl").hidden = !hasSolution;
  if (!hasSolution) return;
  const done = solutionIndex >= solution.length;
  const move = solution[solutionIndex];
  const showingCurrentMove = animationPlaying && !done;
  const solutionCount = $("#solutionCount");
  solutionCount.textContent = showingCurrentMove ? viewAdjustedMove(move) : `${solution.length} 步`;
  solutionCount.classList.toggle("showing-current-move", showingCurrentMove);
  $("#baseFormula").textContent = solution.join(" ");
  $("#orientationGuide").textContent = `目前持方　${viewOrientationText()}`;
  $("#moves").innerHTML = solution.map((move, index) => `<span class="move ${index < solutionIndex ? "done" : index === solutionIndex ? "current" : ""}" data-step="${index}" role="button" tabindex="0" title="從這一步開始；固定公式：${move}">${viewAdjustedMove(move)}</span>`).join("");
  $("#currentMove").textContent = done ? "✓" : viewAdjustedMove(move);
  $("#moveGuide").textContent = done ? "完成，方塊已還原。" : `${moveText(move)} 固定公式：${move}。`;
  const nextDisabled = done || Boolean(animation) || animationPlaying;
  const playbackLabel = animationPlaying ? "暫停播放" : done ? "從頭播放" : "連續播放";
  $("#nextMove").disabled = nextDisabled;
  $("#mobileNextMove").disabled = nextDisabled;
  $("#animateToggle").textContent = playbackLabel;
  $("#mobileAnimateToggle").textContent = playbackLabel;
  $("#animateToggle").disabled = Boolean(animation) && !animationPlaying;
  $("#mobileAnimateToggle").disabled = Boolean(animation) && !animationPlaying;
}

function animationDuration() {
  const position = Number($("#animationSpeed").value);
  if (!Number.isFinite(position)) return 1200;
  return position <= 50 ? 600 + position * 12 : 1200 + (position - 50) * 16;
}
function syncAnimationSpeed(value) {
  $("#animationSpeed").value = value;
  $("#mobileAnimationSpeed").value = value;
}
function render() { lockCentres(); renderCube(); renderPicker(); renderSolution(); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function faceByNormal(normal) { return FACE_ORDER.find((face) => dot(FACE_GEOMETRY[face].normal, normal) === 1); }
function oppositeFace(face) { return faceByNormal(FACE_GEOMETRY[face].normal.map((value) => -value)); }
function orientationFrame() {
  let best = null;
  FACE_ORDER.forEach((front) => FACE_ORDER.forEach((up) => {
    if (dot(FACE_GEOMETRY[front].normal, FACE_GEOMETRY[up].normal) !== 0) return;
    const right = faceByNormal(cross(FACE_GEOMETRY[up].normal, FACE_GEOMETRY[front].normal));
    const frame = { F: front, U: up, R: right, B: oppositeFace(front), D: oppositeFace(up), L: oppositeFace(right) };
    const score = Object.entries(frame).reduce((sum, [relativeFace, fixedFace]) => sum + dot(rotatePoint(FACE_GEOMETRY[fixedFace].normal), VIEW_AXES[relativeFace]), 0);
    if (!best || score > best.score) best = { frame, score };
  }));
  return best.frame;
}
function viewRelativeFaceCode(face) { return Object.entries(orientationFrame()).find(([, fixedFace]) => fixedFace === face)[0]; }
function sourceFaceAt(relativeFace) { return orientationFrame()[relativeFace]; }
function colourName(face) { return COLOR_META[FACE_COLORS[face]].name; }
function viewOrientationText() { return ["F", "U", "R"].map((relativeFace) => `${VIEW_LABELS[relativeFace]}：${colourName(sourceFaceAt(relativeFace))}`).join("　"); }
function viewAdjustedMove(move) { return `${viewRelativeFaceCode(move[0])}${move.slice(1)}`; }
function moveText(move) { const direction = move.endsWith("2") ? "轉 180°" : move.endsWith("'") ? "逆時針轉 90°" : "順時針轉 90°"; const relativeFace = viewRelativeFaceCode(move[0]); return `${relativeFace}＝${colourName(move[0])}色（固定公式 ${move[0]}），${direction}`; }

function clearSolution() { clearPlayback(); solution = []; solutionCube = null; solutionStart = null; solutionIndex = 0; hasSolution = false; }
function changeSticker(color) { if (!selected || selected.index === 4) return; stickers[selected.face][selected.index] = color; clearSolution(); render(); }

function clearCube() {
  FACE_ORDER.forEach((face) => stickers[face].fill(null));
  lockCentres();
  selected = null; clearSolution(); render();
}

function finishSolution(algorithm) {
  solving = false;
  if (!algorithm) { setStatus("20 步內未找到公式", "error"); showToast("求解器沒有在 20 步限制內找到公式"); render(); return; }
  solution = algorithm.trim().split(/\s+/).filter(Boolean);
  if (solution.length > 20) { setStatus("結果超出限制", "error"); showToast("已拒絕超過 20 步的結果"); render(); return; }
  const check = validateCube();
  if (!check.valid) { setStatus("方塊狀態已變更", "error"); render(); return; }
  solutionStart = check.cube.toJSON(); solutionCube = new Cube(solutionStart); solutionIndex = 0; hasSolution = true;
  setStatus("求解器已就緒", "ready"); render();
}

function initialiseMainThreadSolver() {
  if (mainSolverQueued || solverReady) return;
  if (!Cube?.initSolver) { setStatus("求解器無法載入", "error"); render(); return; }
  mainSolverQueued = true; setStatus("正在準備相容求解器"); render();
  setTimeout(() => {
    try { Cube.initSolver(); solverMode = "main"; solverReady = true; setStatus("求解器已就緒", "ready"); }
    catch { solverMode = "none"; solverReady = false; setStatus("求解器無法載入", "error"); }
    render();
  }, 0);
}

function initialiseWorker() {
  if (!Cube) { setStatus("求解器無法載入", "error"); render(); return; }
  if (!window.Worker) { initialiseMainThreadSolver(); return; }
  try { worker = new Worker("vendor/cubejs/solver-worker.js"); }
  catch { initialiseMainThreadSolver(); return; }
  worker.onmessage = ({ data }) => {
    if (data.type === "ready") { solverMode = "worker"; solverReady = true; setStatus("求解器已就緒", "ready"); render(); }
    if (data.type === "solution") finishSolution(data.algorithm);
  };
  worker.onerror = () => { worker = null; solverMode = "none"; solverReady = false; solving = false; initialiseMainThreadSolver(); };
  try { worker.postMessage({ type: "init" }); } catch { worker = null; initialiseMainThreadSolver(); }
}

function solve() {
  const check = validateCube();
  if (solving) return;
  if (!check.valid) { showToast(check.message); return; }
  if (!solverReady) { showToast("求解器正在準備，請稍候再試"); return; }
  if (check.cube.isSolved()) { showToast("這顆方塊已經解好"); return; }
  solving = true; setStatus("正在搜尋 20 步內公式"); render();
  if (solverMode === "worker" && worker) { worker.postMessage({ type: "solve", cube: check.cube.toJSON(), maxDepth: 20 }); return; }
  if (solverMode === "main") {
    setTimeout(() => {
      try { finishSolution(check.cube.solve(20)); }
      catch { solving = false; setStatus("求解器發生錯誤", "error"); render(); }
    }, 0);
  }
}
function nextMove() { if (!hasSolution || animationPlaying || animation || solutionIndex >= solution.length) return; startAnimatedMove(); }
function jumpToStep(index) {
  if (!hasSolution || !solutionStart || !Number.isInteger(index) || index < 0 || index >= solution.length) return;
  clearPlayback(); solutionCube = new Cube(solutionStart);
  solution.slice(0, index).forEach((move) => solutionCube.move(move)); solutionIndex = index; render();
}
function requestFrame(callback) { return window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(() => callback(Date.now()), 16); }
function cancelFrame(frame) { if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame); else clearTimeout(frame); }
function clearPlayback() {
  if (animationFrame !== null) cancelFrame(animationFrame); if (animationTimer !== null) clearTimeout(animationTimer);
  animationFrame = null; animationTimer = null; animation = null; animationPlaying = false;
}
function startAnimatedMove() {
  if (animation || !hasSolution || solutionIndex >= solution.length) return;
  animation = { move: solution[solutionIndex], progress: 0, startedAt: null, duration: animationDuration() }; render();
  const frame = (timestamp) => {
    if (!animation) return;
    if (animation.startedAt === null) animation.startedAt = timestamp;
    animation.progress = Math.min(1, (timestamp - animation.startedAt) / animation.duration); renderCube();
    if (animation.progress < 1) { animationFrame = requestFrame(frame); return; }
    const move = animation.move; animation = null; animationFrame = null; solutionCube.move(move); solutionIndex += 1;
    if (solutionIndex >= solution.length) animationPlaying = false;
    render();
    if (animationPlaying) animationTimer = setTimeout(startAnimatedMove, Math.round(animationDuration() * .18));
  };
  animationFrame = requestFrame(frame);
}
function toggleAnimation() {
  if (!hasSolution) return;
  if (animationPlaying || animationTimer) { clearPlayback(); render(); return; }
  if (animation) return;
  if (solutionIndex >= solution.length) { if (!solutionStart) return; solutionCube = new Cube(solutionStart); solutionIndex = 0; }
  animationPlaying = true; startAnimatedMove();
}
function restart() { if (!solutionStart) return; clearPlayback(); solutionCube = new Cube(solutionStart); solutionIndex = 0; render(); }

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function clampGrid(value) { return Math.max(0, Math.min(2, Math.floor((value + 1) * 1.5))); }
function crossFaceSelection(face, row, column, direction) {
  const geometry = FACE_GEOMETRY[face];
  const horizontal = -1 + (column + .5) * 2 / 3; const vertical = -1 + (row + .5) * 2 / 3;
  const vectors = {
    ArrowLeft: { outward: geometry.horizontal.map((value) => -value), tangent: geometry.vertical, position: vertical },
    ArrowRight: { outward: geometry.horizontal, tangent: geometry.vertical, position: vertical },
    ArrowUp: { outward: geometry.vertical.map((value) => -value), tangent: geometry.horizontal, position: horizontal },
    ArrowDown: { outward: geometry.vertical, tangent: geometry.horizontal, position: horizontal },
  }[direction];
  const nextFace = FACE_ORDER.find((candidate) => dot(FACE_GEOMETRY[candidate].normal, vectors.outward) === 1);
  const next = FACE_GEOMETRY[nextFace];
  const nextHorizontal = dot(geometry.normal, next.horizontal) + dot(vectors.tangent, next.horizontal) * vectors.position;
  const nextVertical = dot(geometry.normal, next.vertical) + dot(vectors.tangent, next.vertical) * vectors.position;
  return { face: nextFace, index: clampGrid(nextVertical) * 3 + clampGrid(nextHorizontal) };
}
function adjacentSelection(current, direction) {
  const row = Math.floor(current.index / 3); const column = current.index % 3;
  if (direction === "ArrowLeft" && column > 0) return { face: current.face, index: current.index - 1 };
  if (direction === "ArrowRight" && column < 2) return { face: current.face, index: current.index + 1 };
  if (direction === "ArrowUp" && row > 0) return { face: current.face, index: current.index - 3 };
  if (direction === "ArrowDown" && row < 2) return { face: current.face, index: current.index + 3 };
  return crossFaceSelection(current.face, row, column, direction);
}
function editableAdjacentSelection(current, direction) {
  let candidate = current;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    candidate = adjacentSelection(candidate, direction);
    if (candidate.index !== 4) return candidate;
  }
  return current;
}
function stickerCentre(selection) {
  const row = Math.floor(selection.index / 3); const column = selection.index % 3;
  return pointOnFace(selection.face, -1 + (column + .5) * 2 / 3, -1 + (row + .5) * 2 / 3);
}
function screenRelativeSelection(current, direction) {
  const desired = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[direction];
  const origin = rotatePoint(stickerCentre(current));
  const candidates = [...new Map(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].map((key) => {
    const candidate = editableAdjacentSelection(current, key); return [`${candidate.face}-${candidate.index}`, candidate];
  })).values()];
  return candidates.map((candidate) => {
    const point = rotatePoint(stickerCentre(candidate)); const delta = [point[0] - origin[0], -(point[1] - origin[1])];
    const length = Math.hypot(...delta) || 1; return { candidate, score: (delta[0] * desired[0] + delta[1] * desired[1]) / length };
  }).sort((a, b) => b.score - a.score)[0].candidate;
}
function moveKeyboardSelection(direction) {
  const current = selected || { face: sourceFaceAt("F"), index: 0 };
  selected = screenRelativeSelection(current, direction); if (solutionCube) clearSolution();
  render();
}
function handleKeyboardInput(event) {
  const target = event.target?.tagName;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target)) return;
  if (COLOR_KEYS[event.key] && selected) { event.preventDefault(); changeSticker(COLOR_KEYS[event.key]); return; }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); moveKeyboardSelection(event.key); }
}

function bind() {
  $("#colorOptions").addEventListener("click", (event) => { const button = event.target.closest("[data-color]"); if (button && !button.disabled) changeSticker(button.dataset.color); });
  $("#clearSticker").addEventListener("click", () => { if (!selected) return; changeSticker(null); });
  $("#clearCube").addEventListener("click", clearCube);
  $("#solveButton").addEventListener("click", solve); $("#nextMove").addEventListener("click", nextMove); $("#mobileNextMove").addEventListener("click", nextMove); $("#restart").addEventListener("click", restart); $("#mobileRestart").addEventListener("click", restart); $("#animateToggle").addEventListener("click", toggleAnimation); $("#mobileAnimateToggle").addEventListener("click", toggleAnimation);
  $("#animationSpeed").addEventListener("input", () => syncAnimationSpeed($("#animationSpeed").value));
  $("#mobileAnimationSpeed").addEventListener("input", () => syncAnimationSpeed($("#mobileAnimationSpeed").value));
  $("#moves").addEventListener("click", (event) => { const move = event.target.closest("[data-step]"); if (move) jumpToStep(Number(move.dataset.step)); });
  $("#moves").addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { const move = event.target.closest("[data-step]"); if (move) { event.preventDefault(); jumpToStep(Number(move.dataset.step)); } } });

  const canvas = $("#cubeCanvas");
  const scene = $("#cubeScene");
  const beginDrag = (event) => {
    if (animation) return;
    event.preventDefault?.();
    dragStart = { x: event.clientX, y: event.clientY, rotation: { ...rotation }, target: pickSticker(event) };
    dragDistance = 0;
    scene.classList.add("is-dragging");
    try { canvas.setPointerCapture?.(event.pointerId); } catch { /* Pointer capture can be unavailable during initial page activation. */ }
  };
  const moveDrag = (event) => {
    if (!dragStart) return;
    event.preventDefault?.();
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    dragDistance = Math.hypot(dx, dy);
    const base = dragStart.rotation;
    rotation = { x: Math.max(-72, Math.min(72, base.x + dy * .22)), y: base.y + dx * .3 };
    renderCube();
  };
  const endDrag = (event) => {
    if (!dragStart) return;
    event.preventDefault?.();
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    rotation = { x: Math.max(-72, Math.min(72, dragStart.rotation.x + dy * .22)), y: dragStart.rotation.y + dx * .3 };
    const moved = Math.max(Math.abs(dx), Math.abs(dy)) >= 8;
    const target = dragStart.target;
    dragStart = null;
    scene.classList.remove("is-dragging");
    try { canvas.releasePointerCapture?.(event.pointerId); } catch { /* The pointer may already have been released by the browser. */ }
    if (moved) selected = null;
    else if (target?.index === 4) showToast("中心塊固定，不能更改顏色");
    else if (target) { if (solutionCube) clearSolution(); selected = target; }
    render();
  };
  const cancelDrag = () => { if (dragStart) rotation = dragStart.rotation; dragStart = null; scene.classList.remove("is-dragging"); render(); };
  canvas.addEventListener("pointerdown", beginDrag, { passive: false });
  canvas.addEventListener("pointermove", moveDrag, { passive: false });
  canvas.addEventListener("pointerup", endDrag, { passive: false });
  canvas.addEventListener("pointercancel", cancelDrag);
  // Pointer capture keeps normal drags on the canvas; these document listeners
  // complete a drag if a browser drops capture during the first page interaction.
  document.addEventListener?.("pointermove", (event) => { if (event.target !== canvas) moveDrag(event); }, { passive: false });
  document.addEventListener?.("pointerup", endDrag, { passive: false });
  document.addEventListener?.("pointercancel", cancelDrag);
  document.addEventListener?.("keydown", handleKeyboardInput);
}

bind();
render();
initialiseWorker();
