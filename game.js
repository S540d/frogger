(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const startBtn = document.getElementById("start-btn");

  const COLS = 12;
  const ROWS = 14;
  const TILE = canvas.width / COLS; // 40

  const HOME_ROW = 0;
  const RIVER_ROWS = [1, 2, 3, 4];
  const SAFE_ROW = 5;
  const ROAD_ROWS = [6, 7, 9, 10];
  const REST_ROW = 8; // Ruhezone mitten auf der Straße - hier fahren keine Autos
  const START_ROW = 13;

  const HOME_SLOTS = [1, 3.5, 6, 8.5, 11]; // column positions of the 5 lily pads
  const SLOT_WIDTH = 0.9;

  let score = 0;
  let lives = 3;
  let level = 1;
  let running = false;
  let homesFilled = [false, false, false, false, false];

  function makeFrog() {
    return { col: Math.floor(COLS / 2), row: START_ROW, x: null, y: null };
  }
  let frog = makeFrog();

  function resetFrogPosition() {
    frog.col = Math.floor(COLS / 2);
    frog.row = START_ROW;
    frog.x = null;
  }

  function baseSpeed() {
    return 1 + (level - 1) * 0.25;
  }

  function buildRoad() {
    const dirs = [1, -1, 1, -1];
    return ROAD_ROWS.map((row, i) => ({
      row,
      dir: dirs[i],
      speed: 0.2 * baseSpeed(),
      gap: 3 + (i % 2),
      width: i % 2 === 0 ? 1.4 : 1.1,
      cars: [],
    }));
  }

  function buildRiver() {
    const dirs = [-1, 1, -1, 1];
    return RIVER_ROWS.map((row, i) => ({
      row,
      dir: dirs[i],
      speed: 0.2 * baseSpeed(),
      gap: 3.5,
      width: i % 2 === 0 ? 2.2 : 1.6,
      logs: [],
    }));
  }

  let road = buildRoad();
  let river = buildRiver();

  function seedLane(lane, count) {
    lane.forEach((laneRow) => {
      const items = [];
      let pos = Math.random() * COLS;
      for (let i = 0; i < count; i++) {
        items.push(pos);
        pos += laneRow.width + laneRow.gap;
      }
      if (laneRow.cars) laneRow.cars = items;
      if (laneRow.logs) laneRow.logs = items;
    });
  }

  function initLevel() {
    road = buildRoad();
    river = buildRiver();
    seedLane(road, 5);
    seedLane(river, 4);
  }

  function updateHud() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    levelEl.textContent = level;
  }

  function showOverlay(title, text, btnLabel) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    startBtn.textContent = btnLabel;
    overlay.classList.remove("hidden");
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function startGame() {
    score = 0;
    lives = 3;
    level = 1;
    homesFilled = [false, false, false, false, false];
    resetFrogPosition();
    initLevel();
    updateHud();
    hideOverlay();
    running = true;
  }

  function loseLife(reason) {
    lives--;
    updateHud();
    if (lives <= 0) {
      running = false;
      showOverlay("Game Over", `Endpunktzahl: ${score}. Nochmal versuchen?`, "Neustart");
      return;
    }
    resetFrogPosition();
  }

  function nextLevel() {
    level++;
    homesFilled = [false, false, false, false, false];
    resetFrogPosition();
    initLevel();
    updateHud();
  }

  function moveLane(items, laneRow, dt) {
    const delta = laneRow.dir * laneRow.speed * dt;
    for (let i = 0; i < items.length; i++) {
      items[i] += delta;
      if (laneRow.dir > 0 && items[i] > COLS) items[i] -= COLS + laneRow.gap * items.length;
      if (laneRow.dir < 0 && items[i] < -laneRow.width) items[i] += COLS + laneRow.gap * items.length;
    }
  }

  function update(dt) {
    if (!running) return;
    road.forEach((laneRow) => moveLane(laneRow.cars, laneRow, dt));
    river.forEach((laneRow) => moveLane(laneRow.logs, laneRow, dt));

    // Carry frog on logs
    if (RIVER_ROWS.includes(frog.row)) {
      const laneRow = river.find((r) => r.row === frog.row);
      const onLog = laneRow.logs.some(
        (lx) => frog.col + 0.5 > lx && frog.col + 0.5 < lx + laneRow.width
      );
      if (!onLog) {
        loseLife("drowned");
        return;
      }
      frog.col += laneRow.dir * laneRow.speed * dt;
      if (frog.col < 0 || frog.col > COLS - 1) {
        loseLife("swept away");
        return;
      }
    }

    // Car collision
    if (ROAD_ROWS.includes(frog.row)) {
      const laneRow = road.find((r) => r.row === frog.row);
      const hit = laneRow.cars.some(
        (cx) => frog.col + 0.9 > cx && frog.col < cx + laneRow.width
      );
      if (hit) {
        loseLife("hit by car");
        return;
      }
    }

    // Reached home row - ein einziges Seerosenblatt reicht, um das Level zu schaffen
    if (frog.row === HOME_ROW) {
      const slotIndex = HOME_SLOTS.findIndex(
        (sx) => frog.col + 0.5 > sx - SLOT_WIDTH / 2 && frog.col + 0.5 < sx + 1 + SLOT_WIDTH / 2
      );
      if (slotIndex === -1) {
        loseLife("missed pad");
        return;
      }
      score += 100 + level * 10;
      updateHud();
      nextLevel();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ROWS; r++) {
      const y = r * TILE;
      if (r === HOME_ROW) ctx.fillStyle = "#0b3d0b";
      else if (RIVER_ROWS.includes(r)) ctx.fillStyle = "#1a4d7a";
      else if (r === SAFE_ROW || r === REST_ROW || r === START_ROW) ctx.fillStyle = "#2d2d2d";
      else if (ROAD_ROWS.includes(r)) ctx.fillStyle = "#333";
      else ctx.fillStyle = "#222";
      ctx.fillRect(0, y, canvas.width, TILE);
    }

    // Home pads
    HOME_SLOTS.forEach((sx, i) => {
      ctx.fillStyle = homesFilled[i] ? "#7CFC00" : "#0f5c0f";
      ctx.beginPath();
      ctx.ellipse(
        (sx + 0.5) * TILE,
        HOME_ROW * TILE + TILE / 2,
        TILE * 0.45,
        TILE * 0.35,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });

    // Logs
    river.forEach((laneRow) => {
      ctx.fillStyle = "#8b5a2b";
      laneRow.logs.forEach((lx) => {
        ctx.fillRect(lx * TILE, laneRow.row * TILE + 6, laneRow.width * TILE, TILE - 12);
      });
    });

    // Cars - als Auto-Emoji gezeichnet, gedreht je nach Fahrtrichtung
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${TILE * 0.9}px sans-serif`;
    road.forEach((laneRow) => {
      laneRow.cars.forEach((cx) => {
        const centerX = (cx + laneRow.width / 2) * TILE;
        const centerY = laneRow.row * TILE + TILE / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        if (laneRow.dir > 0) ctx.scale(-1, 1);
        ctx.fillText("🚗", 0, 2);
        ctx.restore();
      });
    });

    // Frog - als Frosch-Emoji gezeichnet
    ctx.font = `${TILE * 0.9}px sans-serif`;
    ctx.fillText("🐸", (frog.col + 0.5) * TILE, (frog.row + 0.5) * TILE + 2);
  }

  let lastTime = null;
  function loop(ts) {
    if (lastTime === null) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, 0.05) * 10;
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function tryMove(dCol, dRow) {
    if (!running) return;
    const nc = frog.col + dCol;
    const nr = frog.row + dRow;
    if (nc < 0 || nc > COLS - 1 || nr < 0 || nr > START_ROW) return;
    frog.col = nc;
    frog.row = nr;
    if (dRow < 0) {
      score += 1;
      updateHud();
    }
  }

  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        tryMove(0, -1);
        e.preventDefault();
        break;
      case "ArrowDown":
      case "s":
      case "S":
        tryMove(0, 1);
        e.preventDefault();
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        tryMove(-1, 0);
        e.preventDefault();
        break;
      case "ArrowRight":
      case "d":
      case "D":
        tryMove(1, 0);
        e.preventDefault();
        break;
    }
  });

  // Wisch-Steuerung fürs Handy: Start- und Endpunkt des Fingers vergleichen,
  // die Richtung mit dem größeren Ausschlag (waagerecht/senkrecht) gewinnt.
  let touchStartX = 0;
  let touchStartY = 0;
  const SWIPE_MIN_DISTANCE = 30;

  canvas.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    },
    { passive: true }
  );

  canvas.addEventListener("touchend", (e) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_DISTANCE) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      tryMove(dx > 0 ? 1 : -1, 0);
    } else {
      tryMove(0, dy > 0 ? 1 : -1);
    }
    e.preventDefault();
  });

  startBtn.addEventListener("click", startGame);

  showOverlay("Frogger", "Bring den Frosch sicher ans andere Ufer!", "Start");
  draw();
  requestAnimationFrame(loop);
})();
