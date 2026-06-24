const COURSE_NAMES = {
  1: "Curs 1 – Şcolile teologice",
  2: "Curs 2 – Sf. Atanasie cel Mare",
  3: "Curs 3 – Sf. Chiril al Alexandriei",
  4: "Curs 4 – Sf. Vasile cel Mare",
  5: "Curs 5 – Sf. Grigorie de Nyssa",
  6: "Curs 6 – Sf. Grigorie de Nazianz",
  7: "Curs 7 – Sf. Efrem Sirul",
  8: "Curs 8 – Sf. Ioan Gură de Aur",
};

const STORAGE_KEY = "patrologieQuizStatsV1";

let selectedCourses = new Set(Object.keys(COURSE_NAMES).map(Number));
let mode = "all"; // "all" | "mistakes"
let pool = [];
let currentIndex = 0;
let sessionStats = { correct: 0, wrong: 0 };
let currentRevealed = false;
let currentMatch = null;

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}
function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizeWords(str) {
  return stripDiacritics(str.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function wordsMatch(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 4 && longer.startsWith(shorter)) return true;
  return false;
}

function evaluateAnswer(answerText, keywords) {
  const answerWords = normalizeWords(answerText);
  const matched = [];
  const missing = [];
  keywords.forEach((kw) => {
    const kwWords = normalizeWords(kw);
    const hit = kwWords.every((kww) =>
      answerWords.some((aw) => wordsMatch(kww, aw))
    );
    if (hit) matched.push(kw);
    else missing.push(kw);
  });
  const ratio = keywords.length ? matched.length / keywords.length : 0;
  return { matched, missing, ratio };
}

function buildPool() {
  const stats = loadStats();
  let candidates = QUESTIONS.filter((q) => selectedCourses.has(q.course));
  if (mode === "mistakes") {
    candidates = candidates.filter((q) => {
      const s = stats[q.id];
      return s && s.lastResult === "wrong";
    });
  }
  // shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates;
}

function el(id) {
  return document.getElementById(id);
}

function renderCourseChips() {
  const wrap = el("course-chips");
  wrap.innerHTML = "";
  Object.entries(COURSE_NAMES).forEach(([num, name]) => {
    const n = Number(num);
    const chip = document.createElement("div");
    chip.className = "chip" + (selectedCourses.has(n) ? " active" : "");
    chip.textContent = name;
    chip.onclick = () => {
      if (selectedCourses.has(n)) selectedCourses.delete(n);
      else selectedCourses.add(n);
      renderCourseChips();
      renderSetupStats();
    };
    wrap.appendChild(chip);
  });
}

el("chip-all").onclick = () => {
  selectedCourses = new Set(Object.keys(COURSE_NAMES).map(Number));
  renderCourseChips();
  renderSetupStats();
};
el("chip-none").onclick = () => {
  selectedCourses = new Set();
  renderCourseChips();
  renderSetupStats();
};

function renderSetupStats() {
  const stats = loadStats();
  const total = QUESTIONS.filter((q) => selectedCourses.has(q.course)).length;
  const mistakes = QUESTIONS.filter(
    (q) => selectedCourses.has(q.course) && stats[q.id]?.lastResult === "wrong"
  ).length;
  if (mode === "mistakes") {
    el("setup-stats").textContent =
      `${mistakes} întrebări de reluat (din ${total} selectate, marcate anterior ca greşite)`;
  } else {
    el("setup-stats").textContent =
      `${total} întrebări selectate · ${mistakes} marcate ca greşite anterior`;
  }
}

document.querySelectorAll(".mode-toggle .chip").forEach((btn) => {
  btn.onclick = () => {
    mode = btn.dataset.mode;
    document
      .querySelectorAll(".mode-toggle .chip")
      .forEach((b) => b.classList.toggle("active", b === btn));
    renderSetupStats();
  };
});

el("start-btn").onclick = () => {
  pool = buildPool();
  if (pool.length === 0) {
    alert("Nu există întrebări pentru filtrele alese. Alege alte cursuri sau modul „toate întrebările”.");
    return;
  }
  currentIndex = 0;
  sessionStats = { correct: 0, wrong: 0 };
  el("setup-screen").classList.add("hidden");
  el("summary-screen").classList.add("hidden");
  el("quiz-screen").classList.remove("hidden");
  renderQuestion();
};

function renderQuestion() {
  currentRevealed = false;
  currentMatch = null;
  const q = pool[currentIndex];
  el("q-tag").textContent = COURSE_NAMES[q.course];
  el("q-text").textContent = q.question;
  el("answer-input").value = "";
  el("answer-input").disabled = false;
  el("reveal-area").classList.add("hidden");
  el("check-btn").classList.remove("hidden");
  el("dont-know-btn").classList.remove("hidden");
  const pct = Math.round((currentIndex / pool.length) * 100);
  el("progress-fill").style.width = pct + "%";
  el("progress-label").textContent = `Întrebarea ${currentIndex + 1} din ${pool.length}`;
  el("answer-input").focus();
}

function showReveal(answerText) {
  const q = pool[currentIndex];
  currentMatch = evaluateAnswer(answerText, q.keywords || []);
  currentRevealed = true;

  el("check-btn").classList.add("hidden");
  el("dont-know-btn").classList.add("hidden");
  el("answer-input").disabled = true;

  const badge = el("match-badge");
  const ratio = currentMatch.ratio;
  let cls = "bad", txt = "Concordanţă slabă cu răspunsul model";
  if (ratio >= 0.65) { cls = "good"; txt = "Concordanţă bună cu răspunsul model"; }
  else if (ratio >= 0.35) { cls = "mid"; txt = "Concordanţă parţială cu răspunsul model"; }
  badge.className = "match-badge " + cls;
  badge.textContent = `${txt} — ${Math.round(ratio * 100)}% din elementele cheie`;

  el("model-answer-text").textContent = q.answer;

  const kwList = el("kw-list");
  kwList.innerHTML = "";
  currentMatch.matched.forEach((k) => {
    const span = document.createElement("span");
    span.className = "kw hit";
    span.textContent = "✓ " + k;
    kwList.appendChild(span);
  });
  currentMatch.missing.forEach((k) => {
    const span = document.createElement("span");
    span.className = "kw miss";
    span.textContent = "✗ " + k;
    kwList.appendChild(span);
  });

  el("funfact-text").textContent = q.funFact || "";
  el("funfact-box").classList.toggle("hidden", !q.funFact);

  el("reveal-area").classList.remove("hidden");
}

el("check-btn").onclick = () => {
  const val = el("answer-input").value.trim();
  if (!val) {
    el("answer-input").focus();
    return;
  }
  showReveal(val);
};

el("dont-know-btn").onclick = () => {
  showReveal("");
};

el("answer-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !currentRevealed) {
    el("check-btn").click();
  }
});

function recordResult(isCorrect) {
  const q = pool[currentIndex];
  const stats = loadStats();
  const s = stats[q.id] || { seen: 0, correct: 0, wrong: 0 };
  s.seen += 1;
  if (isCorrect) { s.correct += 1; sessionStats.correct++; }
  else { s.wrong += 1; sessionStats.wrong++; }
  s.lastResult = isCorrect ? "correct" : "wrong";
  stats[q.id] = s;
  saveStats(stats);
}

el("grade-correct-btn").onclick = () => {
  recordResult(true);
  advance();
};
el("grade-wrong-btn").onclick = () => {
  recordResult(false);
  advance();
};

function advance() {
  currentIndex++;
  if (currentIndex >= pool.length) {
    showSummary();
  } else {
    renderQuestion();
  }
}

function showSummary() {
  el("quiz-screen").classList.add("hidden");
  el("summary-screen").classList.remove("hidden");
  const total = sessionStats.correct + sessionStats.wrong;
  const pct = total ? Math.round((sessionStats.correct / total) * 100) : 0;
  el("sum-correct").textContent = sessionStats.correct;
  el("sum-wrong").textContent = sessionStats.wrong;
  el("sum-pct").textContent = pct + "%";

  const stats = loadStats();
  const breakdown = el("course-breakdown");
  breakdown.innerHTML = "";
  Object.entries(COURSE_NAMES).forEach(([num, name]) => {
    const n = Number(num);
    const qs = QUESTIONS.filter((q) => q.course === n && stats[q.id]);
    if (qs.length === 0) return;
    const correctCount = qs.filter((q) => stats[q.id].lastResult === "correct").length;
    const pctC = Math.round((correctCount / qs.length) * 100);
    const row = document.createElement("div");
    row.className = "cb-row";
    row.innerHTML = `
      <div class="cb-name">${name}</div>
      <div class="cb-bar-track"><div class="cb-bar-fill" style="width:${pctC}%"></div></div>
      <div class="cb-pct">${pctC}%</div>
    `;
    breakdown.appendChild(row);
  });
}

el("retry-mistakes-btn").onclick = () => {
  mode = "mistakes";
  document.querySelectorAll(".mode-toggle .chip").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === "mistakes")
  );
  el("summary-screen").classList.add("hidden");
  el("setup-screen").classList.remove("hidden");
  renderSetupStats();
};

el("back-to-setup-btn").onclick = () => {
  el("summary-screen").classList.add("hidden");
  el("setup-screen").classList.remove("hidden");
  renderSetupStats();
};

el("reset-stats-btn").onclick = () => {
  if (confirm("Sigur vrei să ştergi tot istoricul de răspunsuri salvat local?")) {
    localStorage.removeItem(STORAGE_KEY);
    renderSetupStats();
  }
};

renderCourseChips();
renderSetupStats();
