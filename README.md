# ⚡ FocusFlow

<p align="center">
  <img src="https://img.shields.io/badge/license-Brand%20Protected-red.svg" alt="License: FocusFlow Brand License — no rebranding" />
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen.svg" alt="Zero dependencies" />
  <img src="https://img.shields.io/badge/prs-welcome-orange.svg" alt="PRs welcome" />
</p>

**FocusFlow** is a beautiful, minimalist Pomodoro timer and task tracker that helps you stay in flow. No accounts, no tracking, no server — everything runs and stays in your browser.

**🔗 Live demo: [arj-codex.github.io/focusflow](https://arj-codex.github.io/focusflow)**

## ✨ Features

- 🍅 **Pomodoro timer** — focus sessions with automatic short and long breaks
- ⚙️ **Adjustable settings** — customize focus/break durations, sessions before a long break, and auto-start behavior
- ⏭ **Skip** — jump to the next phase anytime
- ✅ **Task tracker** — add tasks, mark them done, and pin one as your current focus
- 📊 **Daily stats** — sessions completed, focus minutes, and a day-streak to keep you motivated
- 🌗 **Dark & light themes** — follows your preference, saved between visits
- 🔔 **Alerts** — gentle chime + desktop notification when a session ends
- ⌨️ **Keyboard shortcuts** — `Space` to start/pause, `R` to reset
- 💾 **Private by design** — all data lives in `localStorage`; nothing ever leaves your device
- 📱 **Responsive** — works great on desktop, tablet, and phone

## 🚀 Getting Started

No build step, no dependencies. Just open it:

```bash
git clone https://github.com/ARJ-CODEX/focusflow.git
cd focusflow
# open index.html in your browser, or serve it:
npx serve .
```

Or simply use the [live demo](https://arj-codex.github.io/focusflow).

## ⌨️ Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Start / pause the timer |
| `S` | Skip to the next phase |
| `R` | Reset the current session |

## 🛠 Tech Stack

- **HTML5** + **CSS3** + **vanilla JavaScript (ES6+)**
- Zero frameworks, zero dependencies, zero build tools
- Web Audio API for the chime · SVG for the progress ring

## 📂 Project Structure

```
focusflow/
├── index.html   # Markup
├── style.css    # Styling (themes, responsive layout)
├── app.js       # Timer, tasks, stats, persistence
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request — small improvements are just as appreciated as big features.

## ™ Trademark & Branding

**FocusFlow™** and its logo are the exclusive brand of **ARJ-CODEX**.

You may use the FocusFlow name only to refer to this original project. You may **not**:

- Rebrand or redistribute this project under any other name
- Use the FocusFlow name or logo for your own products, domains, or marketing
- Present a modified version as an official FocusFlow release

Personal and internal use is free, and contributions to this repository are welcome — see the [License](LICENSE) for full terms.

## 📄 License

Released under the **[FocusFlow Brand License (FBL)](LICENSE)** — free to use, protected against rebranding.
