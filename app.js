/* ============================================================
   FocusFlow — Application logic
   Vanilla JavaScript. No dependencies. Data stays in localStorage.
   ============================================================ */

"use strict";

/* ---------- Configuration ---------- */
const DEFAULT_SETTINGS = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  sessionsBeforeLong: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
};

const PHASE_LABELS = {
  focus: "Ready to focus",
  short: "Short break",
  long: "Long break",
};

/* ---------- State ---------- */
let settings = { ...DEFAULT_SETTINGS };
let mode = "focus";
let remaining = DEFAULT_SETTINGS.focusMin * 60;
let timerId = null;
let endTime = null; // real timestamp the running session ends — immune to tab throttling
let audioCtx = null; // single shared AudioContext (browsers cap new ones)

let tasks = [];
let selectedTaskId = null;

/* Stats persisted per day */
let stats = {
  date: todayKey(),
  sessions: 0,
  focusMinutes: 0,
  streak: 0,
  lastFocusDay: null,
};

/* ---------- DOM handles ---------- */
const $ = (id) => document.getElementById(id);

const timeDisplay = $("time-display");
const phaseLabel = $("phase-label");
const progressFill = $("progress-fill");
const timerCard = $("timer-card");
const startBtn = $("start-btn");
const skipBtn = $("skip-btn");
const resetBtn = $("reset-btn");
const activeTaskEl = $("active-task");

const taskForm = $("task-form");
const taskInput = $("task-input");
const taskList = $("task-list");
const taskCounter = $("task-counter");
const taskEmpty = $("task-empty");

const themeToggle = $("theme-toggle");
const themeIcon = $("theme-icon");

const statSessions = $("stat-sessions");
const statMinutes = $("stat-minutes");
const statStreak = $("stat-streak");

const settingsModal = $("settings-modal");

/* ---------- Utilities ---------- */
function todayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function durationFor(m) {
  return settings[`${m}Min`] * 60;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/* ---------- Persistence ---------- */
function loadState() {
  settings = Object.assign(
    {},
    DEFAULT_SETTINGS,
    loadJSON("focusflow.settings", {})
  );
  tasks = loadJSON("focusflow.tasks", []);
  selectedTaskId = loadJSON("focusflow.selectedTask", null);
  stats = Object.assign(
    {},
    { date: todayKey(), sessions: 0, focusMinutes: 0, streak: 0, lastFocusDay: null },
    loadJSON("focusflow.stats", {})
  );
  if (stats.date !== todayKey()) {
    // New day: keep the streak only if the last focus day was yesterday.
    stats.date = todayKey();
    stats.sessions = 0;
    stats.focusMinutes = 0;
  }
}

function persistTasks() {
  saveJSON("focusflow.tasks", tasks);
  saveJSON("focusflow.selectedTask", selectedTaskId);
}

function persistStats() {
  saveJSON("focusflow.stats", stats);
}

/* ---------- Timer ---------- */
function setMode(newMode) {
  mode = newMode;
  remaining = durationFor(mode);
  document.body.dataset.mode = mode;

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });

  pauseTimer(true);
  phaseLabel.textContent = PHASE_LABELS[mode];
  render();
}

function startTimer() {
  if (timerId) return;
  endTime = Date.now() + remaining * 1000;
  timerId = setInterval(tick, 250);
  timerCard.classList.add("running");
  startBtn.textContent = "Pause";
  phaseLabel.textContent =
    mode === "focus" ? "Focusing…" : "Recharging…";
  requestNotifications();
}

function pauseTimer(updateButton = true) {
  clearInterval(timerId);
  timerId = null;
  timerCard.classList.remove("running");
  if (updateButton) startBtn.textContent = "Start";
}

function tick() {
  remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  if (remaining <= 0) completeSession();
  render();
}

function completeSession() {
  pauseTimer(false);
  playChime();
  notify(
    mode === "focus"
      ? "Great work! Time for a break 🎉"
      : "Break over — back to focus! 💪"
  );

  if (mode === "focus") {
    recordFocusSession();
    setMode(
      stats.sessions % settings.sessionsBeforeLong === 0 ? "long" : "short"
    );
    if (settings.autoStartBreaks) startTimer();
    else startBtn.textContent = "Start";
  } else {
    setMode("focus");
    if (settings.autoStartFocus) startTimer();
    else startBtn.textContent = "Start";
  }
}

/* ---------- Stats ---------- */
function recordFocusSession() {
  // Handle the app staying open across midnight.
  if (stats.date !== todayKey()) {
    stats.date = todayKey();
    stats.sessions = 0;
    stats.focusMinutes = 0;
  }
  stats.sessions += 1;
  stats.focusMinutes += settings.focusMin;

  const today = todayKey();
  if (stats.lastFocusDay !== today) {
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    stats.streak = stats.lastFocusDay === yesterday ? stats.streak + 1 : 1;
    stats.lastFocusDay = today;
  }
  persistStats();
  renderStats();
}

function renderStats() {
  statSessions.textContent = stats.sessions;
  statMinutes.textContent = stats.focusMinutes;
  statStreak.textContent = stats.streak;
}

/* ---------- Rendering ---------- */
function render() {
  timeDisplay.textContent = formatTime(remaining);
  document.title = `${formatTime(remaining)} · ${
    mode === "focus" ? "FocusFlow" : "Break — FocusFlow"
  }`;

  // Use fractional seconds while running so the progress bar stays smooth.
  let secsLeft = remaining;
  if (timerId && endTime !== null) {
    secsLeft = (endTime - Date.now()) / 1000;
  }
  const progress = 1 - Math.max(0, secsLeft) / durationFor(mode);
  progressFill.style.width = `${Math.min(100, progress * 100).toFixed(1)}%`;
}

function renderActiveTask() {
  const task = tasks.find((t) => t.id === selectedTaskId);
  if (task && !task.done) {
    activeTaskEl.hidden = false;
    activeTaskEl.textContent = `Working on: ${task.text}`;
  } else {
    activeTaskEl.hidden = true;
    activeTaskEl.textContent = "";
  }
}

/* ---------- Tasks ---------- */
function addTask(text) {
  const task = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    done: false,
    createdAt: Date.now(),
  };
  tasks.unshift(task);
  if (!selectedTaskId) selectedTaskId = task.id;
  persistTasks();
  renderTasks();
  renderActiveTask();
}

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.done = !task.done;
  if (task.done && task.id === selectedTaskId) {
    selectedTaskId = tasks.find((t) => !t.done)?.id ?? null;
  }
  persistTasks();
  renderTasks();
  renderActiveTask();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  if (selectedTaskId === id) {
    selectedTaskId = tasks.find((t) => !t.done)?.id ?? null;
  }
  persistTasks();
  renderTasks();
  renderActiveTask();
}

function selectTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task || task.done) return;
  selectedTaskId = selectedTaskId === id ? null : id;
  persistTasks();
  renderTasks();
  renderActiveTask();
}

function renderTasks() {
  taskList.innerHTML = "";

  for (const task of tasks) {
    const li = document.createElement("li");
    li.className =
      "task-item" +
      (task.done ? " done" : "") +
      (task.id === selectedTaskId ? " selected" : "");
    li.title = "Click to focus on this task";

    const check = document.createElement("span");
    check.className = "task-check";
    check.textContent = "✓";
    check.title = "Toggle done";
    check.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleTask(task.id);
    });

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;

    const del = document.createElement("button");
    del.className = "task-delete";
    del.textContent = "✕";
    del.title = "Delete task";
    del.setAttribute("aria-label", `Delete task: ${task.text}`);
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    li.append(check, text, del);
    li.addEventListener("click", () => selectTask(task.id));
    taskList.appendChild(li);
  }

  const doneCount = tasks.filter((t) => t.done).length;
  taskCounter.textContent = `${doneCount}/${tasks.length} done`;
  taskEmpty.hidden = tasks.length > 0;
}

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("focusflow.theme", theme);
}

function toggleTheme() {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
}

/* ---------- Settings ---------- */
function openSettings() {
  $("set-focus").value = settings.focusMin;
  $("set-short").value = settings.shortMin;
  $("set-long").value = settings.longMin;
  $("set-cycle").value = settings.sessionsBeforeLong;
  $("set-autobreak").checked = settings.autoStartBreaks;
  $("set-autofocus").checked = settings.autoStartFocus;
  settingsModal.hidden = false;
}

function closeSettings() {
  settingsModal.hidden = true;
}

function saveSettings() {
  settings.focusMin = clampInt(
    $("set-focus").value, 1, 90, DEFAULT_SETTINGS.focusMin
  );
  settings.shortMin = clampInt(
    $("set-short").value, 1, 30, DEFAULT_SETTINGS.shortMin
  );
  settings.longMin = clampInt(
    $("set-long").value, 1, 60, DEFAULT_SETTINGS.longMin
  );
  settings.sessionsBeforeLong = clampInt(
    $("set-cycle").value, 2, 8, DEFAULT_SETTINGS.sessionsBeforeLong
  );
  settings.autoStartBreaks = $("set-autobreak").checked;
  settings.autoStartFocus = $("set-autofocus").checked;

  saveJSON("focusflow.settings", settings);
  closeSettings();

  // If the timer is idle, apply the new duration right away.
  if (!timerId) {
    remaining = durationFor(mode);
    phaseLabel.textContent = PHASE_LABELS[mode];
  }
  render();
}

/* ---------- Sound & notifications ---------- */
function playChime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(
        0.2, ctx.currentTime + i * 0.18 + 0.05
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001, ctx.currentTime + i * 0.18 + 0.5
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
  } catch {
    /* audio not available — ignore */
  }
}

function requestNotifications() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function notify(body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("FocusFlow", { body });
  }
}

/* ---------- Events ---------- */
startBtn.addEventListener("click", () => {
  if (timerId) pauseTimer();
  else startTimer();
});

skipBtn.addEventListener("click", () => {
  setMode(mode === "focus" ? "short" : "focus");
});

resetBtn.addEventListener("click", () => setMode(mode));

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  addTask(text);
  taskInput.value = "";
  taskInput.focus();
});

themeToggle.addEventListener("click", toggleTheme);

$("settings-btn").addEventListener("click", openSettings);
$("settings-close").addEventListener("click", closeSettings);
$("settings-cancel").addEventListener("click", closeSettings);
$("settings-save").addEventListener("click", saveSettings);
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettings();
});

document.addEventListener("keydown", (e) => {
  if (!settingsModal.hidden) {
    if (e.key === "Escape") closeSettings();
    return; // don't trigger shortcuts while the modal is open
  }
  if (e.target === taskInput) return; // don't hijack typing

  if (e.code === "Space") {
    e.preventDefault();
    startBtn.click();
  } else if (e.key.toLowerCase() === "r") {
    resetBtn.click();
  } else if (e.key.toLowerCase() === "s") {
    skipBtn.click();
  }
});

/* ---------- Boot ---------- */
function init() {
  loadState();
  applyTheme(localStorage.getItem("focusflow.theme") ?? "dark");
  remaining = durationFor(mode);
  document.body.dataset.mode = mode;
  phaseLabel.textContent = PHASE_LABELS[mode];
  render();
  renderTasks();
  renderActiveTask();
  renderStats();
}

init();
