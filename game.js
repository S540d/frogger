(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const animalsEl = document.getElementById("animals");
  const recordRow = document.getElementById("record-row");
  const recordEl = document.getElementById("record");
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

  const MAX_LEVEL = 5; // Ab Level 6 geht es endlos weiter, das Tempo bleibt dann gleich

  // Tier-Emojis, die man sich nach jedem geschafften Level verdient
  const ANIMAL_EMOJIS = ["🐢", "🦋", "🐦", "🦆", "🐟", "🦉", "🐿️", "🦔", "🐌", "🦎"];

  let score = 0;
  let lives = 3;
  let level = 1;
  let running = false;
  let checkpointLevel = 1; // Level, bei dem nach einem Game Over wieder gestartet wird
  let collectedAnimals = []; // Gesammelte Tier-Emojis in diesem Durchlauf
  let record = Number(localStorage.getItem("froggerRecord") || 0); // Bestwert im Endlos-Level

  function makeFrog() {
    return { col: Math.floor(COLS / 2), row: START_ROW, x: null, y: null };
  }
  let frog = makeFrog();

  function resetFrogPosition() {
    frog.col = Math.floor(COLS / 2);
    frog.row = START_ROW;
    frog.x = null;
  }

  function levelSpeed() {
    // Level 1 = 0,1 ... Level 5 = 0,4. Danach (Endlos-Level) bleibt es bei 0,4.
    const cappedLevel = Math.min(level, MAX_LEVEL);
    return 0.1 + (cappedLevel - 1) * 0.075;
  }

  function buildRoad() {
    const dirs = [1, -1, 1, -1];
    return ROAD_ROWS.map((row, i) => ({
      row,
      dir: dirs[i],
      speed: levelSpeed(),
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
      speed: levelSpeed(),
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
    levelEl.textContent = level > MAX_LEVEL ? `${level} (Endlos)` : level;
    animalsEl.textContent = collectedAnimals.join(" ");
    recordRow.classList.toggle("hidden", level <= MAX_LEVEL);
    recordEl.textContent = record;
  }

  // Merkt sich im Endlos-Level den bisher besten Punktestand
  function maybeUpdateRecord() {
    if (level > MAX_LEVEL && score > record) {
      record = score;
      localStorage.setItem("froggerRecord", String(record));
    }
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
    level = checkpointLevel;
    collectedAnimals = [];
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
    // Fuer das geschaffte Level gibt es ein neues Tier-Emoji
    const animal = ANIMAL_EMOJIS[(level - 1) % ANIMAL_EMOJIS.length];
    collectedAnimals.push(animal);

    level++;
    checkpointLevel = level;
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

    // Anderes Ufer erreicht - das ganze Ufer zaehlt als Ziel, keine Seerose mehr noetig
    if (frog.row === HOME_ROW) {
      score += 100 + level * 10;
      maybeUpdateRecord();
      updateHud();
      nextLevel();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ROWS; r++) {
      const y = r * TILE;
      if (r === HOME_ROW) ctx.fillStyle = "#2d6a2d"; // Ufer auf der anderen Seite
      else if (RIVER_ROWS.includes(r)) ctx.fillStyle = "#1a4d7a";
      else if (r === SAFE_ROW || r === REST_ROW || r === START_ROW) ctx.fillStyle = "#2d2d2d";
      else if (ROAD_ROWS.includes(r)) ctx.fillStyle = "#333";
      else ctx.fillStyle = "#222";
      ctx.fillRect(0, y, canvas.width, TILE);
    }

    // Baumstaemme - mit runden Enden und Holzmaserung gezeichnet
    river.forEach((laneRow) => {
      laneRow.logs.forEach((lx) => {
        const x = lx * TILE;
        const y = laneRow.row * TILE + 6;
        const w = laneRow.width * TILE;
        const h = TILE - 12;
        const radius = h / 2;

        ctx.fillStyle = "#8b5a2b";
        ctx.strokeStyle = "#5c3a1a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.arc(x + w - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(x + radius, y + h);
        ctx.arc(x + radius, y + h - radius, radius, Math.PI / 2, (3 * Math.PI) / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Holzringe an den Enden - so sieht man, dass es ein Baumstamm ist
        ctx.strokeStyle = "#5c3a1a";
        ctx.lineWidth = 1.5;
        [x + radius, x + w - radius].forEach((ringX) => {
          ctx.beginPath();
          ctx.ellipse(ringX, y + h / 2, radius * 0.55, radius * 0.85, 0, 0, Math.PI * 2);
          ctx.stroke();
        });
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
      maybeUpdateRecord();
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
