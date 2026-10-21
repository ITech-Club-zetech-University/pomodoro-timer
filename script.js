/**
 * ZenFocus - Mindful Pomodoro & Productivity Core
 * Features:
 * - Pomodoro / Short Break / Long Break timing
 * - Dynamic SVG progress circle
 * - Web Audio API procedural sound synthesis (Tibetan Singing Bowl, Zen Chimes, Rain, Ocean Waves, Pink noise)
 * - Task manager with estimation, active selection, completion tracking
 * - Stats persistence (daily sessions, focus minutes, streak)
 * - Theme switcher & customizable interval settings
 */

// --- Default Configuration ---
const DEFAULT_CONFIG = {
  durations: {
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15
  },
  cyclesBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  bellSound: 'singing-bowl',
  theme: 'zen-forest',
  layout: 'zen-minimal'
};

const QUOTES = [
  "“Breathe in calmness, focus with grace.”",
  "“Wherever you are, be there totally.” — Eckhart Tolle",
  "“Simplicity is the soul of efficiency.” — Austin Freeman",
  "“Do one thing at a time, and do it deeply.”",
  "“Calm mind brings inner strength and self-confidence.” — Dalai Lama",
  "“Action gives more ease than resting in anticipation.”"
];

// --- State Management ---
class PomodoroApp {
  constructor() {
    this.config = this.loadConfig();
    this.mode = 'pomodoro'; // 'pomodoro' | 'shortBreak' | 'longBreak'
    this.totalSeconds = this.config.durations[this.mode] * 60;
    this.remainingSeconds = this.totalSeconds;
    this.timerId = null;
    this.isRunning = false;
    this.currentCycle = 1;

    // Daily Stats
    this.stats = this.loadStats();

    // Tasks
    this.tasks = this.loadTasks();
    this.activeTaskId = null;

    // Audio Engine
    this.audioCtx = null;
    this.ambientNodes = null;
    this.isAmbientPlaying = false;

    // DOM Elements
    this.initDOMElements();
    this.bindEvents();

    // Setup Initial View
    this.applyTheme(this.config.theme);
    this.applyLayout(this.config.layout || 'zen-minimal');
    this.updateDisplay();
    this.renderTasks();
    this.updateStatsDisplay();
    this.displayRandomQuote();

    // Notification permission check
    if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
      // Gentle notification request on first click
    }
  }

  // --- LocalStorage Helpers ---
  loadConfig() {
    try {
      const saved = localStorage.getItem('zenfocus_config');
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  saveConfig() {
    localStorage.setItem('zenfocus_config', JSON.stringify(this.config));
  }

  loadStats() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const saved = localStorage.getItem('zenfocus_stats');
      const stats = saved ? JSON.parse(saved) : {};
      
      if (stats.date !== today) {
        // New day reset
        const streak = (stats.yesterdayActive || stats.date === this.getYesterdayDate()) ? (stats.streak || 1) : 1;
        return {
          date: today,
          pomodorosToday: 0,
          focusMinutesToday: 0,
          streak: streak
        };
      }
      return stats;
    } catch {
      return {
        date: new Date().toISOString().slice(0, 10),
        pomodorosToday: 0,
        focusMinutesToday: 0,
        streak: 1
      };
    }
  }

  getYesterdayDate() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  saveStats() {
    localStorage.setItem('zenfocus_stats', JSON.stringify(this.stats));
  }

  loadTasks() {
    try {
      const saved = localStorage.getItem('zenfocus_tasks');
      return saved ? JSON.parse(saved) : [
        { id: '1', title: 'Deep work & mindful focus', est: 2, completedPoms: 0, done: false },
        { id: '2', title: 'Reflect and review progress', est: 1, completedPoms: 0, done: false }
      ];
    } catch {
      return [];
    }
  }

  saveTasks() {
    localStorage.setItem('zenfocus_tasks', JSON.stringify(this.tasks));
  }

  // --- DOM Setup ---
  initDOMElements() {
    this.timeDisplay = document.getElementById('time-display');
    this.ringTrack = document.getElementById('ring-track');
    this.toggleBtn = document.getElementById('toggle-btn');
    this.resetBtn = document.getElementById('reset-btn');
    this.skipBtn = document.getElementById('skip-btn');
    this.playIcon = document.getElementById('play-icon');
    this.pauseIcon = document.getElementById('pause-icon');
    this.cycleCounter = document.getElementById('cycle-counter');
    this.currentTaskPill = document.getElementById('current-task-pill');
    this.tabButtons = document.querySelectorAll('.tab-btn');

    // Layout / Style Variations
    this.styleVarBtn = document.getElementById('style-var-btn');
    this.styleVarMenu = document.getElementById('style-var-menu');
    this.styleVarOptions = document.querySelectorAll('[data-layout-mode]');
    this.currentLayoutLabel = document.getElementById('current-layout-label');

    // Theme elements
    this.themeBtn = document.getElementById('theme-btn');
    this.themeMenu = document.getElementById('theme-menu');
    this.themeOptions = document.querySelectorAll('[data-set-theme]');

    // Ambient elements
    this.ambientBtn = document.getElementById('ambient-btn');
    this.soundSelect = document.getElementById('sound-type-select');
    this.volumeSlider = document.getElementById('sound-volume');
    this.ambientStatus = document.getElementById('ambient-status');

    // Stats elements
    this.statCompleted = document.getElementById('stat-completed-today');
    this.statFocusTime = document.getElementById('stat-focus-time');
    this.statStreak = document.getElementById('stat-streak');

    // Task elements
    this.taskForm = document.getElementById('task-form');
    this.taskInput = document.getElementById('task-input');
    this.taskEstSelect = document.getElementById('task-est-poms');
    this.tasksList = document.getElementById('tasks-list');
    this.taskBadge = document.getElementById('task-count-badge');
    this.clearCompletedBtn = document.getElementById('clear-completed-btn');

    // Settings Modal elements
    this.settingsBtn = document.getElementById('settings-open-btn');
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsClose = document.getElementById('settings-close-btn');
    this.settingsForm = document.getElementById('settings-form');
    this.resetDefaultsBtn = document.getElementById('reset-defaults-btn');

    // Settings Form Inputs
    this.setPomTime = document.getElementById('set-pom-time');
    this.setShortBreak = document.getElementById('set-short-break');
    this.setLongBreak = document.getElementById('set-long-break');
    this.setCyclesCount = document.getElementById('set-cycles-count');
    this.setAutoBreak = document.getElementById('set-auto-break');
    this.setAutoPom = document.getElementById('set-auto-pom');
    this.setBellSound = document.getElementById('set-bell-sound');

    // Bell tester
    this.bellTestBtn = document.getElementById('bell-test-btn');
  }

  bindEvents() {
    // Timer controls
    this.toggleBtn.addEventListener('click', () => this.toggleTimer());
    this.resetBtn.addEventListener('click', () => this.resetTimer());
    this.skipBtn.addEventListener('click', () => this.skipSession());

    // Tabs
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetMode = e.currentTarget.dataset.mode;
        this.switchMode(targetMode);
      });
    });

    // Style variation selector
    this.styleVarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.styleVarMenu.classList.toggle('show');
      this.themeMenu.classList.remove('show');
    });

    this.styleVarOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        const layout = e.currentTarget.dataset.layoutMode;
        this.applyLayout(layout);
        this.styleVarMenu.classList.remove('show');
      });
    });

    // Theme selector
    this.themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.themeMenu.classList.toggle('show');
      this.styleVarMenu.classList.remove('show');
    });

    document.addEventListener('click', () => {
      this.themeMenu.classList.remove('show');
      this.styleVarMenu.classList.remove('show');
    });

    this.themeOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        const theme = e.currentTarget.dataset.setTheme;
        this.applyTheme(theme);
        this.themeMenu.classList.remove('show');
      });
    });

    // Ambient Audio Controls
    this.ambientBtn.addEventListener('click', () => this.toggleAmbientSound());
    this.soundSelect.addEventListener('change', () => this.handleSoundChange());
    this.volumeSlider.addEventListener('input', () => this.handleVolumeChange());

    // Task Form
    this.taskForm.addEventListener('submit', (e) => this.handleAddTask(e));
    this.clearCompletedBtn.addEventListener('click', () => this.clearCompletedTasks());

    // Settings Modal
    this.settingsBtn.addEventListener('click', () => this.openSettings());
    this.settingsClose.addEventListener('click', () => this.closeSettings());
    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) this.closeSettings();
    });
    this.settingsForm.addEventListener('submit', (e) => this.saveSettings(e));
    this.resetDefaultsBtn.addEventListener('click', () => this.resetSettingsToDefault());

    // Bell test
    this.bellTestBtn.addEventListener('click', () => {
      this.playChime(this.config.bellSound);
    });

    // Keyboard shortcuts for convenience
    document.addEventListener('keydown', (e) => {
      // Space toggles timer if not typing in an input
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        this.toggleTimer();
      }
    });
  }

  // --- Timer Engine ---
  toggleTimer() {
    if (this.isRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer() {
    this.initAudioContext();
    this.isRunning = true;
    this.playIcon.classList.add('hidden');
    this.pauseIcon.classList.remove('hidden');

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    this.timerId = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        this.updateDisplay();
      } else {
        this.completeSession();
      }
    }, 1000);
  }

  pauseTimer() {
    this.isRunning = false;
    clearInterval(this.timerId);
    this.timerId = null;
    this.playIcon.classList.remove('hidden');
    this.pauseIcon.classList.add('hidden');
  }

  resetTimer() {
    this.pauseTimer();
    this.remainingSeconds = this.config.durations[this.mode] * 60;
    this.totalSeconds = this.remainingSeconds;
    this.updateDisplay();
  }

  skipSession() {
    this.pauseTimer();
    this.advanceModeFlow();
  }

  switchMode(newMode) {
    if (this.mode === newMode && !this.isRunning) return;
    this.pauseTimer();
    this.mode = newMode;
    this.totalSeconds = this.config.durations[this.mode] * 60;
    this.remainingSeconds = this.totalSeconds;

    // Update active tab UI
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === newMode);
      btn.setAttribute('aria-selected', btn.dataset.mode === newMode);
    });

    // Dynamic track color according to break or focus
    if (this.mode === 'pomodoro') {
      this.ringTrack.style.stroke = 'var(--ring-color)';
    } else {
      this.ringTrack.style.stroke = 'var(--ring-color-break)';
    }

    this.updateDisplay();
  }

  completeSession() {
    this.pauseTimer();
    this.playChime(this.config.bellSound);

    if (this.mode === 'pomodoro') {
      // Record completed Pomodoro
      this.stats.pomodorosToday++;
      this.stats.focusMinutesToday += this.config.durations.pomodoro;
      this.saveStats();
      this.updateStatsDisplay();

      // Update active task progress
      if (this.activeTaskId) {
        const task = this.tasks.find(t => t.id === this.activeTaskId);
        if (task) {
          task.completedPoms = (task.completedPoms || 0) + 1;
          this.saveTasks();
          this.renderTasks();
        }
      }

      this.sendNotification("Focus Session Complete", "Take a moment to relax your eyes and breathe.");

      // Advance cycle count
      if (this.currentCycle >= this.config.cyclesBeforeLongBreak) {
        this.currentCycle = 1;
        this.switchMode('longBreak');
      } else {
        this.currentCycle++;
        this.switchMode('shortBreak');
      }

      if (this.config.autoStartBreaks) {
        this.startTimer();
      }
    } else {
      // Break completed
      this.sendNotification("Break Complete", "Ready to return to mindful focus?");
      this.switchMode('pomodoro');

      if (this.config.autoStartPomodoros) {
        this.startTimer();
      }
    }
  }

  advanceModeFlow() {
    if (this.mode === 'pomodoro') {
      if (this.currentCycle >= this.config.cyclesBeforeLongBreak) {
        this.currentCycle = 1;
        this.switchMode('longBreak');
      } else {
        this.currentCycle++;
        this.switchMode('shortBreak');
      }
    } else {
      this.switchMode('pomodoro');
    }
  }

  // --- Display Updates ---
  updateDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.timeDisplay.textContent = formatted;

    // Update document title for background productivity
    const modeLabel = this.mode === 'pomodoro' ? 'Focus' : 'Rest';
    document.title = `${formatted} (${modeLabel}) • ZenFocus`;

    // SVG Ring progress
    // Circumference = 2 * PI * 140 ~= 879.64
    const circumference = 2 * Math.PI * 140;
    const progress = this.totalSeconds > 0 ? (this.totalSeconds - this.remainingSeconds) / this.totalSeconds : 0;
    const offset = circumference - (progress * circumference);
    this.ringTrack.style.strokeDashoffset = offset;

    // Cycle text
    this.cycleCounter.textContent = `Session ${this.currentCycle} of ${this.config.cyclesBeforeLongBreak}`;

    // Active Task pill
    if (this.activeTaskId) {
      const active = this.tasks.find(t => t.id === this.activeTaskId);
      if (active) {
        this.currentTaskPill.textContent = `🎯 ${active.title}`;
        return;
      }
    }
    this.currentTaskPill.textContent = this.mode === 'pomodoro' ? 'Ready to immerse' : 'Embrace stillness';
  }

  updateStatsDisplay() {
    this.statCompleted.textContent = this.stats.pomodorosToday;
    this.statFocusTime.textContent = `${this.stats.focusMinutesToday}m`;
    this.statStreak.textContent = `${this.stats.streak || 1} d`;
  }

  displayRandomQuote() {
    const quoteEl = document.getElementById('daily-quote');
    if (quoteEl) {
      const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      quoteEl.textContent = q;
    }
  }

  sendNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2378c298"><circle cx="12" cy="12" r="10"/></svg>'
      });
    }
  }

  // --- Task Manager ---
  handleAddTask(e) {
    e.preventDefault();
    const text = this.taskInput.value.trim();
    if (!text) return;

    const est = parseInt(this.taskEstSelect.value, 10) || 1;
    const newTask = {
      id: Date.now().toString(),
      title: text,
      est: est,
      completedPoms: 0,
      done: false
    };

    this.tasks.push(newTask);
    if (!this.activeTaskId) {
      this.activeTaskId = newTask.id;
    }

    this.saveTasks();
    this.renderTasks();
    this.taskInput.value = '';
    this.updateDisplay();
  }

  toggleTaskComplete(id, e) {
    e.stopPropagation();
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.done = !task.done;
      this.saveTasks();
      this.renderTasks();
    }
  }

  deleteTask(id, e) {
    e.stopPropagation();
    this.tasks = this.tasks.filter(t => t.id !== id);
    if (this.activeTaskId === id) {
      const remainingUnfinished = this.tasks.find(t => !t.done);
      this.activeTaskId = remainingUnfinished ? remainingUnfinished.id : null;
    }
    this.saveTasks();
    this.renderTasks();
    this.updateDisplay();
  }

  selectActiveTask(id) {
    this.activeTaskId = id;
    this.renderTasks();
    this.updateDisplay();
  }

  clearCompletedTasks() {
    this.tasks = this.tasks.filter(t => !t.done);
    if (this.activeTaskId && !this.tasks.find(t => t.id === this.activeTaskId)) {
      this.activeTaskId = this.tasks[0]?.id || null;
    }
    this.saveTasks();
    this.renderTasks();
    this.updateDisplay();
  }

  renderTasks() {
    this.tasksList.innerHTML = '';
    const pendingCount = this.tasks.filter(t => !t.done).length;
    this.taskBadge.textContent = `${pendingCount} remaining`;

    if (this.tasks.length === 0) {
      this.tasksList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🍃</div>
          <p>No tasks yet. Set an intention above to focus your mind.</p>
        </div>
      `;
      return;
    }

    this.tasks.forEach(task => {
      const item = document.createElement('div');
      item.className = `task-item ${task.done ? 'completed' : ''} ${this.activeTaskId === task.id ? 'active-focus' : ''}`;
      item.addEventListener('click', () => this.selectActiveTask(task.id));

      const left = document.createElement('div');
      left.className = 'task-left';

      const checkbox = document.createElement('div');
      checkbox.className = 'task-checkbox';
      checkbox.addEventListener('click', (e) => this.toggleTaskComplete(task.id, e));

      const title = document.createElement('span');
      title.className = 'task-text';
      title.textContent = task.title;

      left.appendChild(checkbox);
      left.appendChild(title);

      const right = document.createElement('div');
      right.className = 'task-right';

      const chips = document.createElement('span');
      chips.className = 'pom-chips';
      chips.textContent = `${task.completedPoms || 0}/${task.est} 🍅`;

      const delBtn = document.createElement('button');
      delBtn.className = 'task-del-btn';
      delBtn.innerHTML = '✕';
      delBtn.title = 'Delete Task';
      delBtn.addEventListener('click', (e) => this.deleteTask(task.id, e));

      right.appendChild(chips);
      right.appendChild(delBtn);

      item.appendChild(left);
      item.appendChild(right);
      this.tasksList.appendChild(item);
    });
  }

  // --- Themes & Atmosphere ---
  applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    this.config.theme = themeName;
    this.saveConfig();

    this.themeOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.setTheme === themeName);
    });
  }

  // --- Layout & Aesthetic Variations ---
  applyLayout(layoutMode) {
    document.body.setAttribute('data-layout', layoutMode);
    this.config.layout = layoutMode;
    this.saveConfig();

    this.styleVarOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.layoutMode === layoutMode);
    });

    const labelMap = {
      'zen-minimal': 'Style: Zen Minimal',
      'cozy-study': 'Style: Cozy Study',
      'botanical-art': 'Style: Botanical Hourglass',
      'cyberpunk-rain': 'Style: Cyberpunk Rain'
    };
    if (this.currentLayoutLabel) {
      this.currentLayoutLabel.textContent = labelMap[layoutMode] || 'Style: Variation';
    }
  }

  // --- Web Audio Synthesis (Calm Bell & Ambient Generators) ---
  initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playChime(type) {
    this.initAudioContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (type === 'singing-bowl') {
      // Tibetan Singing Bowl: fundamental + layered harmonic shimmer
      const freqs = [216, 432, 648, 864];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const decay = 3.5 - (idx * 0.4);
        const peakGain = 0.25 / (idx + 1);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + decay);
      });
    } else if (type === 'soft-bell') {
      // Gentle temple chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(528, now); // Solfeggio 528Hz love/transformation freq

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2.0);
    } else {
      // Woodland Marimba
      [440, 554.37, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 1.2);
      });
    }
  }

  toggleAmbientSound() {
    this.initAudioContext();
    if (this.isAmbientPlaying) {
      this.stopAmbientSound();
    } else {
      const selected = this.soundSelect.value;
      if (selected === 'off') {
        this.soundSelect.value = 'rain';
      }
      this.startAmbientSound(this.soundSelect.value);
    }
  }

  handleSoundChange() {
    const val = this.soundSelect.value;
    if (val === 'off') {
      this.stopAmbientSound();
    } else if (this.isAmbientPlaying) {
      this.stopAmbientSound();
      this.startAmbientSound(val);
    }
  }

  handleVolumeChange() {
    const vol = (this.volumeSlider.value / 100);
    if (this.ambientNodes && this.ambientNodes.masterGain) {
      this.ambientNodes.masterGain.gain.setValueAtTime(vol * 0.35, this.audioCtx.currentTime);
    }
    const streamAudio = document.getElementById('music-stream-audio');
    if (streamAudio) {
      streamAudio.volume = vol * 0.7;
    }
  }

  startAmbientSound(type) {
    if (type === 'off') return;
    const streamAudio = document.getElementById('music-stream-audio');

    // Check if it's a Lo-Fi internet radio stream
    const LOFI_STREAMS = {
      'lofi-chill': {
        url: 'https://play.streamafrica.net/lofiradio',
        label: 'Audio: Lofi Chill Stream'
      },
      'lofi-piano': {
        url: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
        label: 'Audio: Peaceful Piano'
      },
      'lofi-coffee': {
        url: 'https://stream.zeno.fm/0r0xa792kwzuv',
        label: 'Audio: Coffee Shop Lofi'
      }
    };

    if (LOFI_STREAMS[type]) {
      // Stop synthetic noise if playing
      this.stopAmbientNoise();

      if (streamAudio) {
        streamAudio.src = LOFI_STREAMS[type].url;
        streamAudio.volume = (this.volumeSlider.value / 100) * 0.7;
        streamAudio.play().then(() => {
          this.isAmbientPlaying = true;
          this.ambientBtn.classList.add('active');
          this.ambientStatus.textContent = LOFI_STREAMS[type].label;
        }).catch(() => {
          // Fallback if browser blocks stream
          this.ambientStatus.textContent = 'Audio: Click to resume stream';
        });
      }
      return;
    }

    // Otherwise, Web Audio Procedural Synthesis
    if (streamAudio) {
      streamAudio.pause();
      streamAudio.src = '';
    }

    this.initAudioContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Master gain for ambient
    const masterGain = ctx.createGain();
    const targetVol = (this.volumeSlider.value / 100) * 0.35;
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(targetVol, now + 1.0);
    masterGain.connect(ctx.destination);

    // Procedural sound generators via buffer & filters
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    let filter = ctx.createBiquadFilter();

    if (type === 'rain') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      whiteNoise.connect(filter);
      filter.connect(masterGain);
      this.ambientStatus.textContent = 'Audio: Rain';
    } else if (type === 'waves') {
      // Modulated ocean surf
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, now);
      filter.Q.setValueAtTime(1.2, now);

      // Low frequency oscillator for wave ebb & flow
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.12, now); // slow rhythmic wave cycle ~8 seconds
      lfoGain.gain.setValueAtTime(300, now);

      lfo.connect(filter.frequency);
      whiteNoise.connect(filter);
      filter.connect(masterGain);

      lfo.start();
      this.ambientNodes = { ...this.ambientNodes, lfo };
      this.ambientStatus.textContent = 'Audio: Ocean Waves';
    } else if (type === 'forest') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(2.0, now);
      whiteNoise.connect(filter);
      filter.connect(masterGain);
      this.ambientStatus.textContent = 'Audio: Woodland';
    } else {
      // Warm Pink Noise
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      whiteNoise.connect(filter);
      filter.connect(masterGain);
      this.ambientStatus.textContent = 'Audio: Warm Noise';
    }

    whiteNoise.start();

    this.ambientNodes = {
      masterGain,
      source: whiteNoise,
      filter,
      ...this.ambientNodes
    };
    this.isAmbientPlaying = true;
    this.ambientBtn.classList.add('active');
  }

  stopAmbientNoise() {
    if (!this.ambientNodes) return;
    const ctx = this.audioCtx;
    if (ctx && this.ambientNodes.masterGain) {
      const now = ctx.currentTime;
      try {
        this.ambientNodes.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
        setTimeout(() => {
          if (this.ambientNodes?.source) this.ambientNodes.source.stop();
          if (this.ambientNodes?.lfo) this.ambientNodes.lfo.stop();
          this.ambientNodes = null;
        }, 300);
      } catch {
        this.ambientNodes = null;
      }
    }
  }

  stopAmbientSound() {
    const streamAudio = document.getElementById('music-stream-audio');
    if (streamAudio) {
      streamAudio.pause();
      streamAudio.src = '';
    }

    this.stopAmbientNoise();

    this.isAmbientPlaying = false;
    this.ambientBtn.classList.remove('active');
    this.ambientStatus.textContent = 'Audio: Muted';
  }

  // --- Settings Modal Handling ---
  openSettings() {
    this.setPomTime.value = this.config.durations.pomodoro;
    this.setShortBreak.value = this.config.durations.shortBreak;
    this.setLongBreak.value = this.config.durations.longBreak;
    this.setCyclesCount.value = this.config.cyclesBeforeLongBreak;
    this.setAutoBreak.checked = this.config.autoStartBreaks;
    this.setAutoPom.checked = this.config.autoStartPomodoros;
    this.setBellSound.value = this.config.bellSound;

    this.settingsModal.classList.remove('hidden');
  }

  closeSettings() {
    this.settingsModal.classList.add('hidden');
  }

  saveSettings(e) {
    e.preventDefault();
    this.config.durations.pomodoro = parseInt(this.setPomTime.value, 10) || 25;
    this.config.durations.shortBreak = parseInt(this.setShortBreak.value, 10) || 5;
    this.config.durations.longBreak = parseInt(this.setLongBreak.value, 10) || 15;
    this.config.cyclesBeforeLongBreak = parseInt(this.setCyclesCount.value, 10) || 4;
    this.config.autoStartBreaks = this.setAutoBreak.checked;
    this.config.autoStartPomodoros = this.setAutoPom.checked;
    this.config.bellSound = this.setBellSound.value;

    this.saveConfig();
    this.closeSettings();

    // If timer is not running, update current total duration
    if (!this.isRunning) {
      this.totalSeconds = this.config.durations[this.mode] * 60;
      this.remainingSeconds = this.totalSeconds;
      this.updateDisplay();
    }
  }

  resetSettingsToDefault() {
    this.setPomTime.value = DEFAULT_CONFIG.durations.pomodoro;
    this.setShortBreak.value = DEFAULT_CONFIG.durations.shortBreak;
    this.setLongBreak.value = DEFAULT_CONFIG.durations.longBreak;
    this.setCyclesCount.value = DEFAULT_CONFIG.cyclesBeforeLongBreak;
    this.setAutoBreak.checked = DEFAULT_CONFIG.autoStartBreaks;
    this.setAutoPom.checked = DEFAULT_CONFIG.autoStartPomodoros;
    this.setBellSound.value = DEFAULT_CONFIG.bellSound;
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.zenFocusApp = new PomodoroApp();
});
