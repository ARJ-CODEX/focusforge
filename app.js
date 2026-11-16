/* ============================================================
   FocusFlow — Application logic
   Vanilla JavaScript. No dependencies. Data stays in localStorage.
   ============================================================ */

"use strict";

/* ---------- Configuration ---------- */
const DURATIONS = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const PHASE_LABELS = {
  focus: "Ready to focus",
  short: "Short break",
  long: "Long break",
};

const RING_LENGTH = 2 * Math.PI * 140; // circumference of r=140

/* ---------- State ---------- */
let mode = "focus";
let remaining = DURATIONS[mode];
let timerId = null;

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
const progressBar = $("progress-bar");
const timerCard = $("timer-card");
const startBtn = $("start-btn");
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

/* ---------- Utilities ---------- */
function todayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

/* ---------- Persistence ---------- */
function loadState() {
  tasks = loadJSON("focusflow.tasks", []);
  selectedTaskId = loadJSON("focusflow.selectedTask", null);
  stats = loadJSON("focusflow.stats", stats);
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
function setMode(newMode, { keepPaused = false } = {}) {
  mode = newMode;
  remaining = DURATIONS[mode];
  document.body.dataset.mode = mode;

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });

  if (!keepPaused) pauseTimer(false);
  render();
}

function startTimer() {
  if (timerId) return;
  timerId = setInterval(tick, 1000);
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
  if (phaseLabel.textContent.includes("…")) {
    phaseLabel.textContent = "Paused";
  }
}

function tick() {
  remaining -= 1;
  if (remaining <= 0) {
    remaining = 0;
    completeSession();
  }
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
    setMode(focusCycle.count % 4 === 0 ? "long" : "short");
  } else {
    setMode("focus");
  }
}

/* ---------- Stats ---------- */
function recordFocusSession() {
  stats.sessions += 1;
  stats.focusMinutes += DURATIONS.focus / 60;

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
  document.title = `${formatTime(remaining)} · ${mode === "focus" ? "FocusFlow" : "Break — FocusFlow"}`;

  const progress = 1 - remaining / DURATIONS[mode];
  progressBar.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
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
    li.className = "task-item" +
      (task.done ? " done" : "") +
      (task.id === selectedTaskId ? " selected" : "");
    li.title = "Click to focus on this task";

    const check = document.createElement("span");
    check.className = "task-check";
    check.textContent = "✓";

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

/* ---------- Sound & notifications ---------- */
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.18 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.5);
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
  if (timerId) {
    pauseTimer();
  } else {
    startTimer();
  }
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

document.addEventListener("keydown", (e) => {
  if (e.target === taskInput) return; // don't hijack typing
  if (e.code === "Space") {
    e.preventDefault();
    startBtn.click();
  } else if (e.key.toLowerCase() === "r") {
    resetBtn.click();
  }
});

/* ---------- Boot ---------- */
function init() {
  loadState();
  applyTheme(localStorage.getItem("focusflow.theme") ?? "dark");
  document.body.dataset.mode = mode;
  progressBar.style.strokeDasharray = String(RING_LENGTH);
  render();
  renderTasks();
  renderActiveTask();
  renderStats();
}

init();
