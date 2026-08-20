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
  const characterBtn = document.getElementById("character-btn");
  const characterPreview = document.getElementById("character-preview");
  const characterPanel = document.getElementById("character-panel");
  const characterOptions = document.getElementById("character-options");
  const levelBtn = document.getElementById("level-btn");
  const levelPreview = document.getElementById("level-preview");
  const levelPanel = document.getElementById("level-panel");
  const levelOptions = document.getElementById("level-options");

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

  // Muster fuer das Endlos-Level: wiederholt sich immer wieder nach oben.
  // "safe" = sicherer Streifen, "river" = Wasser mit Baumstaemmen, "road" = Strasse mit Autos
  const ENDLESS_PATTERN = [
    { type: "safe" },
    { type: "river", dir: -1, width: 2.2 },
    { type: "river", dir: 1, width: 1.6 },
    { type: "river", dir: -1, width: 2.2 },
    { type: "river", dir: 1, width: 1.6 },
    { type: "safe" },
    { type: "road", dir: 1, width: 1.4 },
    { type: "road", dir: -1, width: 1.1 },
    { type: "safe" },
    { type: "road", dir: 1, width: 1.4 },
    { type: "road", dir: -1, width: 1.1 },
    { type: "safe" },
  ];
  const ANCHOR_SCREEN_ROW = 7; // Bildschirm-Zeile, in der der Frosch im Endlos-Level bleibt (Kamera folgt ihm)
  const ENDLESS_REWARD_INTERVAL_MS = 15 * 60 * 1000; // Alle 15 Minuten gibt es im Endlos-Level ein neues Tier

  // Tier-Emojis, die man sich nach jedem geschafften Level verdient
  const ANIMAL_EMOJIS = ["🐢", "🦋", "🐦", "🦆", "🐟", "🦉", "🐿️", "🦔", "🐌", "🦎"];

  // Als Spielfigur waehlbar sind nur Tiere, die man sich schon in einem Level verdient hat.
  // Der Frosch ist die Startfigur und deshalb immer dabei.
  let unlockedAnimals = new Set(JSON.parse(localStorage.getItem("froggerUnlocked") || "[]"));
  unlockedAnimals.add("🐸");
  let playerChar = localStorage.getItem("froggerCharacter") || "🐸";

  function unlockedCharacterList() {
    return ["🐸", ...ANIMAL_EMOJIS.filter((a) => unlockedAnimals.has(a))];
  }

  let score = 0;
  let lives = 3;
  let level = 1;
  let running = false;
  let checkpointLevel = 1; // Hoechstes bisher erreichtes Level (bestimmt die Levelauswahl)
  let startLevel = 1; // Level, mit dem das naechste Spiel beginnt (per Levelauswahl waehlbar)
  let collectedAnimals = []; // Gesammelte Tier-Emojis in diesem Durchlauf
  let record = Number(localStorage.getItem("froggerRecord") || 0); // Bestwert im Endlos-Level

  let endlessLanes = new Map(); // Weltzeile -> Spur mit Autos/Baumstaemmen, fuer das Endlos-Level
  let endlessPlayMs = 0; // Wie lange man in diesem Durchlauf schon im Endlos-Level unterwegs ist
  let endlessNextRewardMs = ENDLESS_REWARD_INTERVAL_MS; // Wann das naechste Endlos-Tier wartet

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
      items: [],
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
      items: [],
    }));
  }

  let road = buildRoad();
  let river = buildRiver();

  function seedItems(width, gap, count) {
    const items = [];
    let pos = Math.random() * COLS;
    for (let i = 0; i < count; i++) {
      items.push(pos);
      pos += width + gap;
    }
    return items;
  }

  function seedLane(lane, count) {
    lane.forEach((laneRow) => {
      laneRow.items = seedItems(laneRow.width, laneRow.gap, count);
    });
  }

  function initLevel() {
    road = buildRoad();
    river = buildRiver();
    seedLane(road, 5);
    seedLane(river, 4);
    endlessLanes = new Map();
  }

  // Welche Gelaendeart im Endlos-Level an einer bestimmten Weltzeile liegt.
  // Das Muster wiederholt sich immer wieder, je weiter man nach oben kommt.
  function endlessTerrainAt(worldRow) {
    const p = ENDLESS_PATTERN;
    // Am START_ROW (dort beginnt man im Endlos-Level) liegt immer ein sicherer Streifen
    const offset = worldRow - START_ROW;
    const idx = ((offset % p.length) + p.length) % p.length;
    return p[idx];
  }

  // Holt die Spur (Autos/Baumstaemme) fuer eine Weltzeile im Endlos-Level.
  // Wird eine Zeile zum ersten Mal sichtbar, wird sie neu erzeugt und gemerkt,
  // damit sich ihre Autos/Baumstaemme beim naechsten Mal weiterbewegen statt neu zu starten.
  function getEndlessLane(worldRow) {
    const terrain = endlessTerrainAt(worldRow);
    if (terrain.type === "safe") return null;
    if (!endlessLanes.has(worldRow)) {
      const gap = terrain.type === "river" ? 3.5 : 3;
      const count = terrain.type === "river" ? 4 : 5;
      endlessLanes.set(worldRow, {
        dir: terrain.dir,
        width: terrain.width,
        gap,
        speed: levelSpeed(),
        items: seedItems(terrain.width, gap, count),
      });
    }
    return endlessLanes.get(worldRow);
  }

  function updateHud() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    levelEl.textContent = level > MAX_LEVEL ? `${level} (Endlos)` : level;
    animalsEl.textContent = collectedAnimals.join(" ");
    recordRow.classList.toggle("hidden", level <= MAX_LEVEL);
    recordEl.textContent = record;
    levelPreview.textContent = startLevel > MAX_LEVEL ? "Endlos" : String(startLevel);
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
    level = startLevel;
    collectedAnimals = [];
    endlessPlayMs = 0;
    endlessNextRewardMs = ENDLESS_REWARD_INTERVAL_MS;
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
    // Fuer das geschaffte Level gibt es ein neues Tier-Emoji, das man sich damit
    // dauerhaft als Spielfigur freischaltet
    const animal = ANIMAL_EMOJIS[(level - 1) % ANIMAL_EMOJIS.length];
    collectedAnimals.push(animal);
    if (!unlockedAnimals.has(animal)) {
      unlockedAnimals.add(animal);
      localStorage.setItem("froggerUnlocked", JSON.stringify([...unlockedAnimals]));
    }

    level++;
    checkpointLevel = level;
    startLevel = level;
    resetFrogPosition();
    initLevel();
    updateHud();
  }

  // Belohnt im Endlos-Level alle 15 Minuten Spielzeit ein weiteres Tier-Emoji
  function maybeAwardEndlessAnimal() {
    if (endlessPlayMs < endlessNextRewardMs) return;
    endlessNextRewardMs += ENDLESS_REWARD_INTERVAL_MS;
    const animal = ANIMAL_EMOJIS[collectedAnimals.length % ANIMAL_EMOJIS.length];
    collectedAnimals.push(animal);
    if (!unlockedAnimals.has(animal)) {
      unlockedAnimals.add(animal);
      localStorage.setItem("froggerUnlocked", JSON.stringify([...unlockedAnimals]));
    }
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

  // Bewegung und Kollisionen im Endlos-Level: die Kamera folgt dem Frosch nach oben,
  // das Gelaende wiederholt sich immer wieder (siehe ENDLESS_PATTERN)
  function updateEndless(dt) {
    const cameraTop = frog.row - ANCHOR_SCREEN_ROW;

    // Alle sichtbaren Spuren (plus etwas Rand) weiterbewegen
    for (let r = cameraTop - 2; r < cameraTop + ROWS + 2; r++) {
      const lane = getEndlessLane(r);
      if (lane) moveLane(lane.items, lane, dt);
    }

    // Spuren aufraeumen, die laengst nicht mehr zu sehen sind
    for (const key of endlessLanes.keys()) {
      if (key > cameraTop + ROWS + 10 || key < cameraTop - 10) {
        endlessLanes.delete(key);
      }
    }

    const terrain = endlessTerrainAt(frog.row);
    if (terrain.type === "river") {
      const lane = getEndlessLane(frog.row);
      const onLog = lane.items.some(
        (lx) => frog.col + 0.5 > lx && frog.col + 0.5 < lx + lane.width
      );
      if (!onLog) {
        loseLife("drowned");
        return;
      }
      frog.col += lane.dir * lane.speed * dt;
      if (frog.col < 0 || frog.col > COLS - 1) {
        loseLife("swept away");
        return;
      }
    } else if (terrain.type === "road") {
      const lane = getEndlessLane(frog.row);
      const hit = lane.items.some((cx) => frog.col + 0.9 > cx && frog.col < cx + lane.width);
      if (hit) {
        loseLife("hit by car");
        return;
      }
    }
  }

  function update(dt) {
    if (!running) return;

    if (level > MAX_LEVEL) {
      updateEndless(dt);
      return;
    }

    road.forEach((laneRow) => moveLane(laneRow.items, laneRow, dt));
    river.forEach((laneRow) => moveLane(laneRow.items, laneRow, dt));

    // Carry frog on logs
    if (RIVER_ROWS.includes(frog.row)) {
      const laneRow = river.find((r) => r.row === frog.row);
      const onLog = laneRow.items.some(
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
      const hit = laneRow.items.some(
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

  // Zeichnet Baumstaemme einer Spur - mit runden Enden und Holzmaserung. y = Pixel-Position der Zeile.
  function drawLogs(laneRow, y) {
    laneRow.items.forEach((lx) => {
      const x = lx * TILE;
      const yy = y + 6;
      const w = laneRow.width * TILE;
      const h = TILE - 12;
      const radius = h / 2;

      ctx.fillStyle = "#8b5a2b";
      ctx.strokeStyle = "#5c3a1a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + radius, yy);
      ctx.lineTo(x + w - radius, yy);
      ctx.arc(x + w - radius, yy + radius, radius, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x + radius, yy + h);
      ctx.arc(x + radius, yy + h - radius, radius, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Holzringe an den Enden - so sieht man, dass es ein Baumstamm ist
      ctx.strokeStyle = "#5c3a1a";
      ctx.lineWidth = 1.5;
      [x + radius, x + w - radius].forEach((ringX) => {
        ctx.beginPath();
        ctx.ellipse(ringX, yy + h / 2, radius * 0.55, radius * 0.85, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
    });
  }

  // Zeichnet Autos einer Spur als Auto-Emoji, gedreht je nach Fahrtrichtung. y = Pixel-Position der Zeile.
  function drawCars(laneRow, y) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${TILE * 0.9}px sans-serif`;
    laneRow.items.forEach((cx) => {
      const centerX = (cx + laneRow.width / 2) * TILE;
      const centerY = y + TILE / 2;
      ctx.save();
      ctx.translate(centerX, centerY);
      if (laneRow.dir > 0) ctx.scale(-1, 1);
      ctx.fillText("🚗", 0, 2);
      ctx.restore();
    });
  }

  function drawFrog(x, y) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${TILE * 0.9}px sans-serif`;
    ctx.fillText(playerChar, x, y + 2);
  }

  function drawFixedLevel() {
    for (let r = 0; r < ROWS; r++) {
      const y = r * TILE;
      if (r === HOME_ROW) ctx.fillStyle = "#2d6a2d"; // Ufer auf der anderen Seite
      else if (RIVER_ROWS.includes(r)) ctx.fillStyle = "#1a4d7a";
      else if (r === SAFE_ROW || r === REST_ROW || r === START_ROW) ctx.fillStyle = "#2d2d2d";
      else if (ROAD_ROWS.includes(r)) ctx.fillStyle = "#333";
      else ctx.fillStyle = "#222";
      ctx.fillRect(0, y, canvas.width, TILE);
    }

    river.forEach((laneRow) => drawLogs(laneRow, laneRow.row * TILE));
    road.forEach((laneRow) => drawCars(laneRow, laneRow.row * TILE));
    drawFrog((frog.col + 0.5) * TILE, (frog.row + 0.5) * TILE);
  }

  // Zeichnet das Endlos-Level: die Kamera folgt dem Frosch, das Gelaende wiederholt sich
  function drawEndlessLevel() {
    const cameraTop = frog.row - ANCHOR_SCREEN_ROW;

    for (let i = 0; i < ROWS; i++) {
      const worldRow = cameraTop + i;
      const terrain = endlessTerrainAt(worldRow);
      if (terrain.type === "river") ctx.fillStyle = "#1a4d7a";
      else if (terrain.type === "road") ctx.fillStyle = "#333";
      else ctx.fillStyle = "#2d2d2d";
      ctx.fillRect(0, i * TILE, canvas.width, TILE);
    }

    for (let i = 0; i < ROWS; i++) {
      const worldRow = cameraTop + i;
      const terrain = endlessTerrainAt(worldRow);
      if (terrain.type === "river") drawLogs(getEndlessLane(worldRow), i * TILE);
      else if (terrain.type === "road") drawCars(getEndlessLane(worldRow), i * TILE);
    }

    drawFrog((frog.col + 0.5) * TILE, ANCHOR_SCREEN_ROW * TILE + TILE / 2);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (level > MAX_LEVEL) drawEndlessLevel();
    else drawFixedLevel();
  }

  let lastTime = null;
  function loop(ts) {
    if (lastTime === null) lastTime = ts;
    const realMs = ts - lastTime;
    const dt = Math.min(realMs / 1000, 0.05) * 10;
    lastTime = ts;
    if (running && level > MAX_LEVEL) {
      endlessPlayMs += realMs;
      maybeAwardEndlessAnimal();
    }
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function tryMove(dCol, dRow) {
    if (!running) return;
    const nc = frog.col + dCol;
    const nr = frog.row + dRow;
    // Im Endlos-Level gibt es keine obere Grenze - man kann unendlich weit nach oben laufen
    const minRow = level > MAX_LEVEL ? -Infinity : 0;
    if (nc < 0 || nc > COLS - 1 || nr < minRow || nr > START_ROW) return;
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


  // Spielfigur-Auswahl: Panel mit den freigeschalteten Tieren aufbauen und Klicks behandeln
  function renderCharacterOptions() {
    characterOptions.innerHTML = "";
    unlockedCharacterList().forEach((animal) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "character-option" + (animal === playerChar ? " selected" : "");
      btn.textContent = animal;
      btn.addEventListener("click", () => {
        playerChar = animal;
        localStorage.setItem("froggerCharacter", playerChar);
        characterPreview.textContent = playerChar;
        renderCharacterOptions();
        characterPanel.classList.add("hidden");
      });
      characterOptions.appendChild(btn);
    });
  }
  renderCharacterOptions();
  characterPreview.textContent = playerChar;

  characterBtn.addEventListener("click", () => {
    renderCharacterOptions(); // neu gewonnene Tiere seit dem letzten Öffnen mit aufnehmen
    characterPanel.classList.toggle("hidden");
  });

  // Levelauswahl: Panel mit allen bisher erreichten Leveln aufbauen und Klicks behandeln
  function renderLevelOptions() {
    levelOptions.innerHTML = "";
    const highestFixedLevel = Math.min(checkpointLevel, MAX_LEVEL);
    for (let n = 1; n <= highestFixedLevel; n++) {
      addLevelOption(n, String(n));
    }
    if (checkpointLevel > MAX_LEVEL) {
      addLevelOption(MAX_LEVEL + 1, "Endlos");
    }
  }

  function addLevelOption(n, label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level-option" + (n === startLevel ? " selected" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      startLevel = n;
      levelPreview.textContent = label;
      renderLevelOptions();
      levelPanel.classList.add("hidden");
    });
    levelOptions.appendChild(btn);
  }

  renderLevelOptions();
  levelPreview.textContent = String(startLevel);

  levelBtn.addEventListener("click", () => {
    renderLevelOptions(); // neu erreichte Level seit dem letzten Öffnen mit aufnehmen
    levelPanel.classList.toggle("hidden");
  });

  showOverlay("Frogger", "Bring den Frosch sicher ans andere Ufer!", "Start");
  draw();
  requestAnimationFrame(loop);
})();
