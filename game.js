// TETRIS - minimal black & white
(() => {
  'use strict';

  const COLS = 10, ROWS = 20, CELL = 30;
  const NEXT_CELL = 20;

  const board = document.getElementById('board');
  const bctx = board.getContext('2d');
  const nextCanvas = document.getElementById('nextCanvas');
  const nctx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const linesEl = document.getElementById('lines');
  const overlay = document.getElementById('overlay');
  const overlayMsg = document.getElementById('overlayMsg');

  // piece shapes, drawn in a 4x4 or smaller matrix
  const SHAPES = {
    I: [
      [0,0,0,0],
      [1,1,1,1],
      [0,0,0,0],
      [0,0,0,0],
    ],
    O: [
      [1,1],
      [1,1],
    ],
    T: [
      [0,1,0],
      [1,1,1],
      [0,0,0],
    ],
    S: [
      [0,1,1],
      [1,1,0],
      [0,0,0],
    ],
    Z: [
      [1,1,0],
      [0,1,1],
      [0,0,0],
    ],
    J: [
      [1,0,0],
      [1,1,1],
      [0,0,0],
    ],
    L: [
      [0,0,1],
      [1,1,1],
      [0,0,0],
    ],
  };

  const TYPES = Object.keys(SHAPES);

  let grid, current, nextType, score, level, lines;
  let dropTimer = 0, dropInterval = 800, lastTime = 0;
  let paused = false, gameOver = false, running = false;

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomType() {
    return TYPES[(Math.random() * TYPES.length) | 0];
  }

  function makePiece(type) {
    const shape = SHAPES[type].map(r => r.slice());
    return {
      type,
      shape,
      x: (COLS - shape[0].length) >> 1,
      y: 0,
    };
  }

  function rotated(shape) {
    const n = shape.length;
    const out = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        out[x][n - 1 - y] = shape[y][x];
    return out;
  }

  function collides(shape, ox, oy) {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const nx = ox + x, ny = oy + y;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  function tryRotate() {
    const r = rotated(current.shape);
    // try with kicks: 0, -1, +1, -2, +2
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(r, current.x + kick, current.y)) {
        current.shape = r;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let y = 0; y < current.shape.length; y++) {
      for (let x = 0; x < current.shape[y].length; x++) {
        if (current.shape[y][x]) {
          const gy = current.y + y, gx = current.x + x;
          if (gy < 0) { gameOver = true; return; }
          grid[gy][gx] = 1;
        }
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(v => v)) {
        grid.splice(y, 1);
        grid.unshift(new Array(COLS).fill(0));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += [0, 100, 300, 500, 800][cleared] * level;
      level = 1 + Math.floor(lines / 10);
      dropInterval = Math.max(80, 800 - (level - 1) * 70);
    }
  }

  function spawn() {
    current = makePiece(nextType);
    nextType = randomType();
    drawNext();
    if (collides(current.shape, current.x, current.y)) {
      gameOver = true;
    }
  }

  function softDrop() {
    if (!collides(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lock();
    }
    dropTimer = 0;
  }

  function hardDrop() {
    while (!collides(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 2;
    }
    lock();
    dropTimer = 0;
  }

  function lock() {
    merge();
    if (gameOver) return;
    clearLines();
    updateHud();
    spawn();
  }

  function updateHud() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  // ---------- drawing ----------
  function drawCell(ctx, x, y, size) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
  }

  function drawGhostY() {
    let gy = current.y;
    while (!collides(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function draw() {
    bctx.clearRect(0, 0, board.width, board.height);

    // grid lines
    bctx.strokeStyle = '#151515';
    bctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      bctx.beginPath();
      bctx.moveTo(x * CELL + 0.5, 0);
      bctx.lineTo(x * CELL + 0.5, ROWS * CELL);
      bctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      bctx.beginPath();
      bctx.moveTo(0, y * CELL + 0.5);
      bctx.lineTo(COLS * CELL, y * CELL + 0.5);
      bctx.stroke();
    }

    // locked cells
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (grid[y][x]) drawCell(bctx, x, y, CELL);

    if (current && !gameOver) {
      // ghost
      const gy = drawGhostY();
      bctx.strokeStyle = '#444';
      bctx.lineWidth = 1;
      bctx.setLineDash([4, 4]);
      for (let y = 0; y < current.shape.length; y++)
        for (let x = 0; x < current.shape[y].length; x++)
          if (current.shape[y][x]) {
            bctx.strokeRect((current.x + x) * CELL + 1.5, (gy + y) * CELL + 1.5, CELL - 3, CELL - 3);
          }
      bctx.setLineDash([]);

      // active piece (filled white)
      bctx.fillStyle = '#fff';
      for (let y = 0; y < current.shape.length; y++)
        for (let x = 0; x < current.shape[y].length; x++)
          if (current.shape[y][x]) {
            bctx.fillRect((current.x + x) * CELL + 1, (current.y + y) * CELL + 1, CELL - 2, CELL - 2);
          }
    }
  }

  function drawNext() {
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = SHAPES[nextType];
    // trim empty rows/cols for centering
    let minX = 4, maxX = -1, minY = 4, maxY = -1;
    for (let y = 0; y < shape.length; y++)
      for (let x = 0; x < shape[y].length; x++)
        if (shape[y][x]) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const ox = (nextCanvas.width - w * NEXT_CELL) / 2;
    const oy = (nextCanvas.height - h * NEXT_CELL) / 2;
    nctx.fillStyle = '#fff';
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++)
        if (shape[y][x]) {
          nctx.fillRect(ox + (x - minX) * NEXT_CELL + 1, oy + (y - minY) * NEXT_CELL + 1, NEXT_CELL - 2, NEXT_CELL - 2);
        }
  }

  // ---------- loop ----------
  function tick(time) {
    if (!running) return;
    const dt = time - lastTime;
    lastTime = time;
    if (!paused && !gameOver) {
      dropTimer += dt;
      if (dropTimer >= dropInterval) {
        dropTimer = 0;
        if (!collides(current.shape, current.x, current.y + 1)) {
          current.y++;
        } else {
          lock();
        }
      }
    }
    draw();
    requestAnimationFrame(tick);
  }

  function startGame() {
    grid = emptyGrid();
    score = 0; level = 1; lines = 0;
    dropInterval = 800; dropTimer = 0;
    paused = false; gameOver = false;
    nextType = randomType();
    spawn();
    updateHud();
    overlay.classList.add('hidden');
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(tick);
  }

  function endGame() {
    running = false;
    gameOver = true;
    overlayMsg.textContent = 'GAME OVER — PRESS ANY KEY';
    overlay.classList.remove('hidden');
    overlay.querySelector('h1').textContent = 'GAME OVER';
  }

  // ---------- input ----------
  document.addEventListener('keydown', (e) => {
    if (!running) {
      startGame();
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      if (gameOver) return;
      paused = !paused;
      if (paused) {
        overlayMsg.textContent = 'PAUSED — PRESS P TO RESUME';
        overlay.querySelector('h1').textContent = 'PAUSED';
        overlay.classList.remove('hidden');
      } else {
        overlay.classList.add('hidden');
        lastTime = performance.now();
      }
      return;
    }
    if (paused || gameOver) return;

    switch (e.key) {
      case 'ArrowLeft':
        if (!collides(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case 'ArrowRight':
        if (!collides(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case 'ArrowDown':
        softDrop();
        break;
      case 'ArrowUp':
        tryRotate();
        break;
      case ' ':
        e.preventDefault();
        hardDrop();
        break;
    }
    updateHud();
    draw();
  });

  // initial static frame
  grid = emptyGrid();
  draw();
})();
