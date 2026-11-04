/* ==========================================================================
   PLANOS — PRO APPLICATION ENGINE (v3.5 COMPLETE)
   Architecture:
   1. Multi-Entity Offline Local Database (Tugas, Planning Roadmaps, Pomodoro History)
   2. Theme Engine (Dark & Light Mode Switcher)
   3. Habit Consistency Streak Tracker
   4. Recurring Task Engine (Harian, Mingguan, Bulanan)
   5. CSV Export Engine (Buka di Microsoft Excel / Google Sheets)
   6. Real-time Web Audio Synthesizer (Zero-asset sound effects & alarms)
   7. Web Notification & Background Timer Reminder
   8. Pomodoro Productivity Engine (25/5/15m with auto stats)
   9. Calendar Grid & Timeline Agenda
   10. Robust JSON Backup Export/Import & Sample Project Generator
   ========================================================================== */

'use strict';

// ---- CONSTANTS & LOCAL DB KEYS ---------------------------
const DB_TUGAS_KEY  = 'planos_db_tugas_v3';
const DB_PLANS_KEY  = 'planos_db_plans_v3';
const DB_POMO_KEY   = 'planos_db_pomo_v3';
const DB_THEME_KEY  = 'planos_db_theme_v3';
const DB_STREAK_KEY = 'planos_db_streak_v3';

const CATEGORY_DEFINITIONS = {
  kerja: { label: '🏢 Kerja', color: '#388bfd' },
  pribadi: { label: '👤 Pribadi', color: '#a371f7' },
  belajar: { label: '📚 Belajar', color: '#2ea043' },
  keuangan: { label: '💰 Keuangan', color: '#d29922' },
  kesehatan: { label: '🏃 Kesehatan', color: '#f85149' },
  lainnya: { label: '📌 Lain-lain', color: '#8b949e' }
};

const HORIZON_DEFINITIONS = {
  mingguan: '📅 Mingguan',
  bulanan: '🗓️ Bulanan',
  q1: '🎯 Kuartal / Q',
  tahunan: '🌟 Tahunan'
};

const STATUS_DEFINITIONS = {
  progress: { label: 'Sedang Jalan', class: 'st-progress' },
  draft: { label: 'Draft', class: 'st-draft' },
  hold: { label: 'Ditunda', class: 'st-hold' },
  achieved: { label: 'Tercapai', class: 'st-achieved' }
};

// ---- GLOBAL APPLICATION STATE ----------------------------
const appState = {
  activeDomain: 'tugas', // 'tugas' | 'planning'
  activeSubFilter: 'all',
  activeView: 'view-tugas',
  searchQuery: '',
  soundEnabled: true,
  theme: 'dark', // 'dark' | 'light'

  // Entities
  tugas: [],
  plans: [],
  pomoCompletedToday: 0,
  streakCount: 1,
  lastStreakDate: '',

  // Calendar
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  calendarSelectedDate: null,

  // Pomodoro Timer State
  pomoTimeRemaining: 1500,
  pomoTotalTime: 1500,
  pomoCurrentMode: 'work',
  pomoIsRunning: false,
  pomoInterval: null
};

// ---- DOM HELPERS -----------------------------------------
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

function genUuid(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// ---- WEB AUDIO SYNTHESIZER -------------------------------
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playHapticSound(type = 'click') {
  if (!appState.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'click') {
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'done') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'alarm') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (e) {
    console.debug('Audio feedback error:', e);
  }
}

// ---- TOAST MESSAGES --------------------------------------
let toastTimeout = null;
function triggerToast(text) {
  const el = $('app-toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.classList.add('hidden');
  }, 2200);
}

// ---- THEME ENGINE (DARK / LIGHT) -------------------------
function applyTheme(themeName) {
  appState.theme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem(DB_THEME_KEY, themeName);
  
  const icon = $('icon-theme');
  if (themeName === 'light') {
    // Sun icon
    icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  } else {
    // Moon icon
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
}

function toggleTheme() {
  const next = appState.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  playHapticSound('click');
  triggerToast(next === 'light' ? 'Mode Terang Diaktifkan ☀️' : 'Mode Gelap Diaktifkan 🌙');
}

// ---- HABIT STREAK ENGINE ---------------------------------
function checkAndUpdateStreak() {
  const today = getTodayIsoDate();
  const raw = localStorage.getItem(DB_STREAK_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      appState.streakCount = data.count || 1;
      appState.lastStreakDate = data.lastDate || today;

      const diffDays = Math.round((new Date(today) - new Date(appState.lastStreakDate)) / 86400000);
      if (diffDays === 1) {
        // Berturut-turut
      } else if (diffDays > 1) {
        // Terputus
        appState.streakCount = 1;
      }
    } catch(e) {}
  } else {
    appState.streakCount = 1;
    appState.lastStreakDate = today;
  }
  $('streak-count').textContent = appState.streakCount;
}

function registerStreakActivity() {
  const today = getTodayIsoDate();
  if (appState.lastStreakDate !== today) {
    appState.streakCount++;
    appState.lastStreakDate = today;
    localStorage.setItem(DB_STREAK_KEY, JSON.stringify({
      count: appState.streakCount,
      lastDate: today
    }));
    $('streak-count').textContent = appState.streakCount;
  }
}

// ---- LOCAL DATABASE STORAGE ------------------------------
function loadAllDatabase() {
  try {
    const rawTugas = localStorage.getItem(DB_TUGAS_KEY);
    const rawPlans = localStorage.getItem(DB_PLANS_KEY);
    const rawPomo = localStorage.getItem(DB_POMO_KEY);
    const savedTheme = localStorage.getItem(DB_THEME_KEY) || 'dark';

    appState.tugas = rawTugas ? JSON.parse(rawTugas) : [];
    appState.plans = rawPlans ? JSON.parse(rawPlans) : [];
    appState.pomoCompletedToday = rawPomo ? parseInt(rawPomo, 10) : 0;
    applyTheme(savedTheme);
    checkAndUpdateStreak();
  } catch (e) {
    console.error('Failed reading database:', e);
    appState.tugas = [];
    appState.plans = [];
  }
}

function commitTugas() {
  localStorage.setItem(DB_TUGAS_KEY, JSON.stringify(appState.tugas));
  refreshBadgesAndMetrics();
  rebuildRemindersQueue();
}

function commitPlans() {
  localStorage.setItem(DB_PLANS_KEY, JSON.stringify(appState.plans));
  refreshBadgesAndMetrics();
}

function commitPomodoroStats() {
  localStorage.setItem(DB_POMO_KEY, appState.pomoCompletedToday.toString());
  $('pomo-completed-count').textContent = appState.pomoCompletedToday;
}

// ---- DATE FORMATTERS -------------------------------------
function getTodayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatReadableDate(dateString) {
  if (!dateString) return '';
  const segs = dateString.split('-');
  if (segs.length < 3) return dateString;
  const d = parseInt(segs[2], 10);
  const mIndex = parseInt(segs[1], 10) - 1;
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d} ${months[mIndex] || ''}`;
}

function formatDayHeaderBanner() {
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const now = new Date();
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`.toUpperCase();
}

// ---- ALARM REMINDER ENGINE -------------------------------
let scheduledAlarms = {};

function rebuildRemindersQueue() {
  Object.values(scheduledAlarms).forEach(clearTimeout);
  scheduledAlarms = {};

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const currentMs = Date.now();
  appState.tugas.forEach(task => {
    if (task.done || !task.hasAlarm || !task.date || !task.time) return;
    const taskMs = new Date(`${task.date}T${task.time}:00`).getTime();
    const delay = taskMs - currentMs;

    if (delay > 0 && delay < 86400000 * 3) {
      scheduledAlarms[task.id] = setTimeout(() => {
        playHapticSound('alarm');
        new Notification(`⏰ PlanOS Reminder: ${task.title}`, {
          body: task.notes || 'Waktunya menuntaskan tugas ini!',
          icon: 'icons/icon-192.png',
          tag: task.id
        });
      }, delay);
    }
  });
}

function promptNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission().then(res => {
      if (res === 'granted') {
        triggerToast('Reminder Notifikasi Aktif ✓');
        rebuildRemindersQueue();
      }
    });
  }
}

// ---- SUBTASK & PROGRESS CALCULATOR -----------------------
function calculatePlanCompletion(plan) {
  if (!plan.subtasks || plan.subtasks.length === 0) {
    return plan.status === 'achieved' ? 100 : 0;
  }
  const doneCount = plan.subtasks.filter(st => st.done).length;
  return Math.round((doneCount / plan.subtasks.length) * 100);
}

// ---- METRICS & BADGES REFRESHER --------------------------
function refreshBadgesAndMetrics() {
  const activeTugasCount = appState.tugas.filter(t => !t.done).length;
  $('badge-tugas-count').textContent = activeTugasCount;
  $('badge-plan-count').textContent = appState.plans.length;

  const urgentCount = appState.tugas.filter(t => !t.done && t.priority === 'p1').length;
  const doneCount = appState.tugas.filter(t => t.done).length;
  const totalCount = appState.tugas.length;
  const completionRate = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  $('metric-pending').textContent = activeTugasCount;
  $('metric-urgent').textContent = urgentCount;
  $('metric-done').textContent = doneCount;
  $('metric-rate').textContent = `${completionRate}%`;

  if (appState.plans.length === 0) {
    $('plan-global-percent').textContent = '0%';
  } else {
    const totalProg = appState.plans.reduce((acc, p) => acc + calculatePlanCompletion(p), 0);
    const avg = Math.round(totalProg / appState.plans.length);
    $('plan-global-percent').textContent = `${avg}%`;
  }

  $('storage-total-entities').textContent = `${totalCount + appState.plans.length} Records`;
}

// ---- SUB-FILTER PILLS CAROUSEL ---------------------------
function renderSubFilterPills() {
  const container = $('filter-carousel');
  container.innerHTML = '';

  let pills = [];
  if (appState.activeDomain === 'tugas') {
    pills = [
      { id: 'all', label: 'Semua Tugas' },
      { id: 'today', label: '🎯 Hari Ini' },
      { id: 'urgent', label: '🔥 Urgent (P1)' },
      { id: 'recurring', label: '🔄 Berulang' },
      { id: 'pending', label: 'Menunggu' },
      { id: 'done', label: 'Selesai' }
    ];
  } else {
    pills = [
      { id: 'all', label: 'Semua Roadmap' },
      { id: 'progress', label: '⚡ In Progress' },
      { id: 'mingguan', label: '📅 Mingguan' },
      { id: 'bulanan', label: '🗓️ Bulanan' },
      { id: 'achieved', label: '🏆 Tercapai' }
    ];
  }

  pills.forEach(p => {
    const chip = document.createElement('button');
    chip.className = `f-chip ${appState.activeSubFilter === p.id ? 'active' : ''}`;
    chip.textContent = p.label;
    chip.addEventListener('click', () => {
      playHapticSound('click');
      appState.activeSubFilter = p.id;
      renderSubFilterPills();
      if (appState.activeDomain === 'tugas') renderTugasStream();
      else renderPlanningStream();
    });
    container.appendChild(chip);
  });
}

// ---- RECURRING TASK AUTO-GENERATOR -----------------------
function handleRecurringTaskCompletion(task) {
  if (!task.recurring || task.recurring === 'none') return;

  let nextDate = task.date || getTodayIsoDate();
  if (task.recurring === 'daily') nextDate = addDaysToDate(nextDate, 1);
  else if (task.recurring === 'weekly') nextDate = addDaysToDate(nextDate, 7);
  else if (task.recurring === 'monthly') nextDate = addDaysToDate(nextDate, 30);

  // Auto spawn next cycle task
  const nextTask = {
    ...task,
    id: genUuid('task_rec'),
    date: nextDate,
    done: false,
    createdAt: new Date().toISOString()
  };
  appState.tugas.push(nextTask);
  triggerToast(`🔄 Tugas berulang baru dijadwalkan: ${nextDate}`);
}

// ---- RENDER DOMAIN 1: TUGAS STREAM -----------------------
function renderTugasStream() {
  const container = $('tugas-container');
  container.innerHTML = '';

  const todayIso = getTodayIsoDate();
  let items = [...appState.tugas];

  if (appState.searchQuery) {
    const q = appState.searchQuery.toLowerCase();
    items = items.filter(t => t.title.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q)));
  }

  if (appState.activeSubFilter === 'today') items = items.filter(t => t.date === todayIso);
  else if (appState.activeSubFilter === 'urgent') items = items.filter(t => t.priority === 'p1' && !t.done);
  else if (appState.activeSubFilter === 'recurring') items = items.filter(t => t.recurring && t.recurring !== 'none');
  else if (appState.activeSubFilter === 'pending') items = items.filter(t => !t.done);
  else if (appState.activeSubFilter === 'done') items = items.filter(t => t.done);

  items.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const priWeights = { p1: 1, p2: 2, p3: 3 };
    if (priWeights[a.priority] !== priWeights[b.priority]) return priWeights[a.priority] - priWeights[b.priority];
    return (a.date || '9999').localeCompare(b.date || '9999');
  });

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 48px 12px; color: var(--text-muted);">
        <p style="font-size:14px; font-weight:700;">Tidak ada tugas pada filter ini</p>
        <p style="font-size:12px; margin-top:4px;">Gunakan tombol + untuk menambahkan tugas baru.</p>
      </div>
    `;
    return;
  }

  items.forEach(task => {
    const card = document.createElement('div');
    card.className = `task-item-card pri-${task.priority || 'p2'} ${task.done ? 'done' : ''}`;

    const cat = CATEGORY_DEFINITIONS[task.category] || CATEGORY_DEFINITIONS.lainnya;
    const readableDate = task.date ? formatReadableDate(task.date) : '';
    const timeVal = task.time || '';

    const recLabel = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' }[task.recurring] || '';

    card.innerHTML = `
      <button class="task-checkbox-ring" aria-label="Selesaikan">
        ${task.done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </button>

      <div class="task-content-block">
        <div class="task-title">${escapeSafeHtml(task.title)}</div>
        ${task.notes ? `<div class="task-notes-preview">${escapeSafeHtml(task.notes)}</div>` : ''}
        <div class="task-meta-row">
          <span class="meta-chip" style="color: ${cat.color}; border-color: ${cat.color}35;">${cat.label}</span>
          ${readableDate ? `<span class="meta-chip">📅 ${readableDate} ${timeVal}</span>` : ''}
          ${task.hasAlarm ? `<span class="meta-chip meta-alarm">⏰ Alarm</span>` : ''}
          ${recLabel ? `<span class="meta-chip meta-recurring">🔄 ${recLabel}</span>` : ''}
        </div>
      </div>

      <button class="btn-card-del" aria-label="Hapus">&times;</button>
    `;

    card.querySelector('.task-checkbox-ring').addEventListener('click', (e) => {
      e.stopPropagation();
      task.done = !task.done;
      playHapticSound(task.done ? 'done' : 'click');
      if (task.done) {
        registerStreakActivity();
        handleRecurringTaskCompletion(task);
      }
      commitTugas();
      renderTugasStream();
      triggerToast(task.done ? 'Tugas ditandai selesai ✓' : 'Tugas dibuka kembali');
    });

    card.addEventListener('click', () => {
      playHapticSound('click');
      openModalDrawer('tugas', task.id);
    });

    card.querySelector('.btn-card-del').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Hapus tugas "${task.title}"?`)) {
        appState.tugas = appState.tugas.filter(item => item.id !== task.id);
        commitTugas();
        renderTugasStream();
        triggerToast('Tugas dihapus');
      }
    });

    container.appendChild(card);
  });
}

// ---- RENDER DOMAIN 2: PLANNING STREAM --------------------
function renderPlanningStream() {
  const container = $('planning-container');
  container.innerHTML = '';

  let items = [...appState.plans];

  if (appState.searchQuery) {
    const q = appState.searchQuery.toLowerCase();
    items = items.filter(p => p.title.toLowerCase().includes(q) || (p.notes && p.notes.toLowerCase().includes(q)));
  }

  if (appState.activeSubFilter === 'progress') items = items.filter(p => p.status === 'progress');
  else if (appState.activeSubFilter === 'mingguan') items = items.filter(p => p.horizon === 'mingguan');
  else if (appState.activeSubFilter === 'bulanan') items = items.filter(p => p.horizon === 'bulanan');
  else if (appState.activeSubFilter === 'achieved') items = items.filter(p => p.status === 'achieved');

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 48px 12px; color: var(--text-muted);">
        <p style="font-size:14px; font-weight:700;">Belum ada planning / target terdaftar</p>
        <p style="font-size:12px; margin-top:4px;">Klik + lalu pilih '2. Planning' untuk target berstruktur.</p>
      </div>
    `;
    return;
  }

  items.forEach(plan => {
    const card = document.createElement('div');
    card.className = 'plan-item-card';

    const completion = calculatePlanCompletion(plan);
    const horizonText = HORIZON_DEFINITIONS[plan.horizon] || plan.horizon;
    const statusObj = STATUS_DEFINITIONS[plan.status] || STATUS_DEFINITIONS.draft;

    let subtasksMarkup = '';
    if (plan.subtasks && plan.subtasks.length > 0) {
      subtasksMarkup = `
        <div class="plan-subtasks-drawer">
          ${plan.subtasks.map((st, idx) => `
            <div class="subtask-interactive-row ${st.done ? 'checked' : ''}" data-idx="${idx}">
              <input type="checkbox" class="subtask-check-box" ${st.done ? 'checked' : ''} />
              <span>${escapeSafeHtml(st.title)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="plan-header-row">
        <span class="plan-horizon-badge">${horizonText}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="plan-status-pill ${statusObj.class}">${statusObj.label} (${completion}%)</span>
          <button class="btn-card-del" aria-label="Hapus">&times;</button>
        </div>
      </div>

      <div class="plan-title-head">${escapeSafeHtml(plan.title)}</div>
      ${plan.notes ? `<div class="task-notes-preview">${escapeSafeHtml(plan.notes)}</div>` : ''}

      <div class="plan-progress-track">
        <div class="plan-progress-bar" style="width: ${completion}%;"></div>
      </div>

      ${subtasksMarkup}
    `;

    card.querySelectorAll('.subtask-interactive-row').forEach(row => {
      row.querySelector('.subtask-check-box').addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(row.dataset.idx, 10);
        plan.subtasks[idx].done = !plan.subtasks[idx].done;
        if (calculatePlanCompletion(plan) === 100) plan.status = 'achieved';
        playHapticSound(plan.subtasks[idx].done ? 'done' : 'click');
        commitPlans();
        renderPlanningStream();
      });
    });

    card.querySelector('.btn-card-del').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Hapus planning "${plan.title}"?`)) {
        appState.plans = appState.plans.filter(p => p.id !== plan.id);
        commitPlans();
        renderPlanningStream();
        triggerToast('Planning dihapus');
      }
    });

    card.addEventListener('click', () => {
      playHapticSound('click');
      openModalDrawer('planning', plan.id);
    });

    container.appendChild(card);
  });
}

// ---- CALENDAR VIEW & TIMELINE ----------------------------
function renderCalendarView() {
  const grid = $('cal-grid');
  grid.innerHTML = '';

  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  $('cal-month-title').textContent = `${months[appState.calendarMonth]} ${appState.calendarYear}`;

  const firstDayIndex = new Date(appState.calendarYear, appState.calendarMonth, 1).getDay();
  const totalDaysInMonth = new Date(appState.calendarYear, appState.calendarMonth + 1, 0).getDate();
  const todayIso = getTodayIsoDate();

  for (let i = 0; i < firstDayIndex; i++) {
    const blank = document.createElement('div');
    grid.appendChild(blank);
  }

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateIso = `${appState.calendarYear}-${String(appState.calendarMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.textContent = d;

    if (dateIso === todayIso) cell.classList.add('today');
    if (dateIso === appState.calendarSelectedDate) cell.classList.add('selected');

    const hasTugas = appState.tugas.some(t => t.date === dateIso && !t.done);
    const hasPlans = appState.plans.some(p => p.date === dateIso);
    if (hasTugas || hasPlans) {
      const dot = document.createElement('div');
      dot.className = 'cal-dot';
      cell.appendChild(dot);
    }

    cell.addEventListener('click', () => {
      playHapticSound('click');
      appState.calendarSelectedDate = dateIso;
      renderCalendarView();
      renderSelectedCalendarEvents(dateIso);
    });

    grid.appendChild(cell);
  }

  renderSelectedCalendarEvents(appState.calendarSelectedDate || todayIso);
}

function renderSelectedCalendarEvents(targetDate) {
  $('cal-target-date-label').textContent = `Agenda: ${formatReadableDate(targetDate) || targetDate}`;
  const list = $('cal-event-list');
  list.innerHTML = '';

  const matchedTugas = appState.tugas.filter(t => t.date === targetDate);
  const matchedPlans = appState.plans.filter(p => p.date === targetDate);
  $('cal-target-count').textContent = `${matchedTugas.length + matchedPlans.length} Item`;

  if (matchedTugas.length === 0 && matchedPlans.length === 0) {
    list.innerHTML = '<p style="font-size:12px; color:var(--text-muted); padding:8px 0;">Tidak ada jadwal tugas di tanggal ini.</p>';
    return;
  }

  matchedTugas.forEach(t => {
    const div = document.createElement('div');
    div.className = 'task-item-card';
    div.innerHTML = `
      <div class="task-content-block">
        <div class="task-title">${escapeSafeHtml(t.title)} (Tugas)</div>
        <div class="task-meta-row"><span class="meta-chip">⏰ ${t.time || 'Tanpa Jam'}</span></div>
      </div>
    `;
    list.appendChild(div);
  });

  matchedPlans.forEach(p => {
    const div = document.createElement('div');
    div.className = 'plan-item-card';
    div.innerHTML = `
      <div class="plan-title-head">${escapeSafeHtml(p.title)} (Target Roadmap)</div>
    `;
    list.appendChild(div);
  });
}

// ---- POMODORO PRODUCTIVITY ENGINE -------------------------
function formatTimerDigits(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function setPomodoroMode(mode, seconds) {
  appState.pomoCurrentMode = mode;
  appState.pomoTotalTime = seconds;
  appState.pomoTimeRemaining = seconds;
  pausePomodoro();
  $('timer-display').textContent = formatTimerDigits(seconds);
  $('timer-status-text').textContent = mode === 'work' ? 'SIAP FOKUS' : 'WAKTU ISTIRAHAT';
}

function togglePomodoro() {
  if (appState.pomoIsRunning) {
    pausePomodoro();
  } else {
    startPomodoro();
  }
}

function startPomodoro() {
  appState.pomoIsRunning = true;
  $('btn-pomo-toggle').textContent = 'Jeda Sesi';
  $('timer-status-text').textContent = appState.pomoCurrentMode === 'work' ? 'SEDANG FOKUS...' : 'SEDANG ISTIRAHAT...';
  playHapticSound('click');

  appState.pomoInterval = setInterval(() => {
    appState.pomoTimeRemaining--;
    $('timer-display').textContent = formatTimerDigits(appState.pomoTimeRemaining);

    if (appState.pomoTimeRemaining <= 0) {
      pausePomodoro();
      playHapticSound('alarm');

      if (appState.pomoCurrentMode === 'work') {
        appState.pomoCompletedToday++;
        registerStreakActivity();
        commitPomodoroStats();
        triggerToast('🎉 Sesi Fokus Selesai! Saatnya istirahat.');
        setPomodoroMode('short', 300);
      } else {
        triggerToast('Istirahat selesai! Siap mulai sesi berikutnya?');
        setPomodoroMode('work', 1500);
      }
    }
  }, 1000);
}

function pausePomodoro() {
  appState.pomoIsRunning = false;
  $('btn-pomo-toggle').textContent = 'Mulai Sesi';
  clearInterval(appState.pomoInterval);
}

function resetPomodoro() {
  pausePomodoro();
  appState.pomoTimeRemaining = appState.pomoTotalTime;
  $('timer-display').textContent = formatTimerDigits(appState.pomoTimeRemaining);
  $('timer-status-text').textContent = 'SIAP FOKUS';
}

// ---- MODAL DRAWER FORM CONTROLLER ------------------------
let dynamicSubtasks = [];

function openModalDrawer(domain = 'tugas', editId = null) {
  const modal = $('modal-form-overlay');
  $('form-entity').reset();
  $('entry-id').value = editId || '';
  $('entry-domain').value = domain;
  dynamicSubtasks = [];

  function setDrawerDomain(d) {
    $('entry-domain').value = d;
    if (d === 'tugas') {
      $('type-opt-tugas').classList.add('active');
      $('type-opt-plan').classList.remove('active');
      $('domain-fields-tugas').classList.remove('hidden');
      $('domain-fields-planning').classList.add('hidden');
    } else {
      $('type-opt-plan').classList.add('active');
      $('type-opt-tugas').classList.remove('active');
      $('domain-fields-planning').classList.remove('hidden');
      $('domain-fields-tugas').classList.add('hidden');
    }
  }

  setDrawerDomain(domain);
  $('type-opt-tugas').onclick = () => setDrawerDomain('tugas');
  $('type-opt-plan').onclick = () => setDrawerDomain('planning');

  if (editId) {
    if (domain === 'tugas') {
      const item = appState.tugas.find(t => t.id === editId);
      if (item) {
        $('entry-title').value = item.title;
        $('entry-notes').value = item.notes || '';
        $('entry-date').value = item.date || '';
        $('entry-time').value = item.time || '';
        $('entry-has-alarm').checked = !!item.hasAlarm;
        $('entry-category').value = item.category || 'kerja';
        $('entry-recurring').value = item.recurring || 'none';
        const rad = document.querySelector(`input[name="form-pri"][value="${item.priority || 'p2'}"]`);
        if (rad) rad.checked = true;
      }
    } else {
      const plan = appState.plans.find(p => p.id === editId);
      if (plan) {
        $('entry-title').value = plan.title;
        $('entry-notes').value = plan.notes || '';
        $('entry-date').value = plan.date || '';
        $('entry-horizon').value = plan.horizon || 'mingguan';
        $('entry-status').value = plan.status || 'progress';
        dynamicSubtasks = plan.subtasks ? JSON.parse(JSON.stringify(plan.subtasks)) : [];
      }
    }
  } else {
    $('entry-date').value = getTodayIsoDate();
    $('entry-recurring').value = 'none';
  }

  renderSubtaskInputStack();
  modal.classList.remove('hidden');
}

function closeModalDrawer() {
  $('modal-form-overlay').classList.add('hidden');
}

function renderSubtaskInputStack() {
  const container = $('subtask-input-stack');
  container.innerHTML = '';
  dynamicSubtasks.forEach((st, idx) => {
    const row = document.createElement('div');
    row.className = 'subtask-entry-line';
    row.innerHTML = `
      <input type="text" placeholder="Langkah subtask aksi..." value="${escapeSafeHtml(st.title)}" data-idx="${idx}" />
      <button type="button" class="btn-remove-subtask">&times;</button>
    `;
    row.querySelector('input').addEventListener('input', (e) => {
      dynamicSubtasks[idx].title = e.target.value;
    });
    row.querySelector('.btn-remove-subtask').addEventListener('click', () => {
      dynamicSubtasks.splice(idx, 1);
      renderSubtaskInputStack();
    });
    container.appendChild(row);
  });
}

function submitDrawerForm(e) {
  e.preventDefault();
  const id = $('entry-id').value;
  const domain = $('entry-domain').value;
  const title = $('entry-title').value.trim();
  const notes = $('entry-notes').value.trim();
  const date = $('entry-date').value;
  const time = $('entry-time').value;
  const hasAlarm = $('entry-has-alarm').checked;

  if (!title) {
    triggerToast('Judul tidak boleh kosong!');
    return;
  }

  if (domain === 'tugas') {
    const priority = document.querySelector('input[name="form-pri"]:checked')?.value || 'p2';
    const category = $('entry-category').value;
    const recurring = $('entry-recurring').value;

    if (id) {
      const idx = appState.tugas.findIndex(t => t.id === id);
      if (idx !== -1) {
        appState.tugas[idx] = { ...appState.tugas[idx], title, notes, date, time, hasAlarm, priority, category, recurring };
      }
    } else {
      appState.tugas.unshift({
        id: genUuid('task'),
        title, notes, date, time, hasAlarm, priority, category, recurring,
        done: false,
        createdAt: new Date().toISOString()
      });
    }
    commitTugas();
    renderTugasStream();
    playHapticSound('done');
    triggerToast('Tugas tersimpan ✓');
  } else {
    const horizon = $('entry-horizon').value;
    const status = $('entry-status').value;
    const validSubs = dynamicSubtasks.filter(s => s.title && s.title.trim() !== '');

    if (id) {
      const idx = appState.plans.findIndex(p => p.id === id);
      if (idx !== -1) {
        appState.plans[idx] = { ...appState.plans[idx], title, notes, date, horizon, status, subtasks: validSubs };
      }
    } else {
      appState.plans.unshift({
        id: genUuid('plan'),
        title, notes, date, horizon, status,
        subtasks: validSubs,
        createdAt: new Date().toISOString()
      });
    }
    commitPlans();
    renderPlanningStream();
    playHapticSound('done');
    triggerToast('Planning tersimpan ✓');
  }

  closeModalDrawer();
}

// ---- CSV EXPORTER (EXCEL / SPREADSHEET READY) ------------
function exportTasksToCsv() {
  if (appState.tugas.length === 0) {
    triggerToast('Tidak ada data tugas untuk diekspor!');
    return;
  }

  let csvContent = 'ID,Judul,Deskripsi,Prioritas,Kategori,Tanggal,Jam,Alarm,Status,Perulangan\n';
  appState.tugas.forEach(t => {
    const row = [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      t.priority || 'p2',
      t.category || 'kerja',
      t.date || '',
      t.time || '',
      t.hasAlarm ? 'Ya' : 'Tidak',
      t.done ? 'Selesai' : 'Pending',
      t.recurring || 'none'
    ].join(',');
    csvContent += row + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan_tugas_${getTodayIsoDate()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  triggerToast('Laporan CSV berhasil diunduh (bisa dibuka di Excel) ✓');
}

// ---- BACKUP EXPORT & IMPORT ENGINE -----------------------
function exportDataToJson() {
  const backupObject = {
    app: 'PlanOS Productivity Suite',
    schemaVersion: '3.5',
    exportedAt: new Date().toISOString(),
    tugas: appState.tugas,
    plans: appState.plans,
    pomodoroCompleted: appState.pomoCompletedToday,
    streakCount: appState.streakCount
  };

  const blob = new Blob([JSON.stringify(backupObject, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planos_backup_${getTodayIsoDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  triggerToast('Backup JSON berhasil diunduh ✓');
}

function importDataFromJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.tugas) || Array.isArray(data.plans)) {
        appState.tugas = data.tugas || [];
        appState.plans = data.plans || [];
        appState.pomoCompletedToday = data.pomodoroCompleted || 0;
        appState.streakCount = data.streakCount || 1;
        commitTugas();
        commitPlans();
        commitPomodoroStats();
        $('streak-count').textContent = appState.streakCount;
        renderTugasStream();
        renderPlanningStream();
        triggerToast('Data berhasil dipulihkan dari backup!');
      } else {
        alert('Format file JSON tidak sesuai schema PlanOS.');
      }
    } catch (err) {
      alert('Gagal mengimpor file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function loadRealWorldSampleProject() {
  appState.tugas = [
    { id: genUuid('task'), title: 'Selesaikan dokumen spesifikasi arsitektur', notes: 'Detail integrasi PWA & Offline Engine', priority: 'p1', category: 'kerja', recurring: 'none', date: getTodayIsoDate(), time: '13:00', hasAlarm: true, done: false },
    { id: genUuid('task'), title: 'Lari santai sore 4 km', notes: 'Target pace 6:30 menit/km', priority: 'p2', category: 'kesehatan', recurring: 'daily', date: getTodayIsoDate(), time: '17:00', hasAlarm: false, done: false },
    { id: genUuid('task'), title: 'Bayar tagihan hosting & server cloud', notes: 'Gunakan virtual account corporate', priority: 'p1', category: 'keuangan', recurring: 'monthly', date: getTodayIsoDate(), time: '10:00', hasAlarm: true, done: true },
    { id: genUuid('task'), title: 'Review pull request & benchmark performa', notes: 'Periksa memory consumption IndexedDB', priority: 'p2', category: 'kerja', recurring: 'none', date: getTodayIsoDate(), time: '15:30', hasAlarm: false, done: false }
  ];

  appState.plans = [
    {
      id: genUuid('plan'),
      title: 'Peluncuran MVP Sistem Manajemen Tim Q4',
      notes: 'Roadmap implementasi produk dari desain hingga production',
      horizon: 'bulanan',
      status: 'progress',
      subtasks: [
        { title: 'Finalisasi UX Research & User Flow', done: true },
        { title: 'Implementasi PWA Offline Engine & IndexedDB', done: true },
        { title: 'Integrasi Web Audio & Alarm System', done: true },
        { title: 'Deploy ke Production Netlify Edge', done: false }
      ]
    },
    {
      id: genUuid('plan'),
      title: 'Portofolio Investasi & Dana Mandiri',
      notes: 'Alokasi aset rendah risiko untuk proteksi keuangan',
      horizon: 'q1',
      status: 'progress',
      subtasks: [
        { title: 'Audit pengeluaran bulanan personal', done: true },
        { title: 'Alokasikan 20% ke instrumen pasar uang', done: false }
      ]
    }
  ];

  appState.pomoCompletedToday = 3;
  commitTugas();
  commitPlans();
  commitPomodoroStats();
  renderTugasStream();
  renderPlanningStream();
  triggerToast('Data contoh proyek nyata berhasil dimuat!');
}

// ---- ESCAPE HTML UTILITY ---------------------------------
function escapeSafeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// ---- SYSTEM INITIALIZATION -------------------------------
function initializeApp() {
  loadAllDatabase();
  $('date-badge').textContent = formatDayHeaderBanner();
  $('pomo-completed-count').textContent = appState.pomoCompletedToday;

  // Theme Toggle
  $('btn-theme-toggle').addEventListener('click', toggleTheme);

  // Sound toggle
  $('btn-audio-toggle').addEventListener('click', () => {
    appState.soundEnabled = !appState.soundEnabled;
    triggerToast(appState.soundEnabled ? 'Suara Audio Aktif 🔔' : 'Suara Audio Dibisukan 🔕');
    playHapticSound('click');
  });

  // Quick Clean Done
  $('btn-quick-clean-done').addEventListener('click', () => {
    const doneTasks = appState.tugas.filter(t => t.done);
    if (doneTasks.length === 0) {
      triggerToast('Tidak ada tugas selesai untuk dibersihkan');
      return;
    }
    if (confirm(`Bersihkan ${doneTasks.length} tugas yang sudah selesai?`)) {
      appState.tugas = appState.tugas.filter(t => !t.done);
      commitTugas();
      renderTugasStream();
      triggerToast('Tugas selesai berhasil dibersihkan');
    }
  });

  // Top Domain Switch: Tugas vs Planning
  $('tab-tugas').addEventListener('click', () => {
    playHapticSound('click');
    appState.activeDomain = 'tugas';
    $('tab-tugas').classList.add('active');
    $('tab-planning').classList.remove('active');
    $('view-tugas').classList.remove('hidden');
    $('view-planning').classList.add('hidden');
    $('page-title').textContent = '1. Tugas Harian';
    renderSubFilterPills();
    renderTugasStream();
  });

  $('tab-planning').addEventListener('click', () => {
    playHapticSound('click');
    appState.activeDomain = 'planning';
    $('tab-planning').classList.add('active');
    $('tab-tugas').classList.remove('active');
    $('view-planning').classList.remove('hidden');
    $('view-tugas').classList.add('hidden');
    $('page-title').textContent = '2. Strategic Planning';
    renderSubFilterPills();
    renderPlanningStream();
  });

  // Bottom Nav Bar View Switching
  $$('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playHapticSound('click');
      $$('.nav-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetView = btn.dataset.view;
      $$('.view-panel').forEach(p => p.classList.add('hidden'));
      $(targetView).classList.remove('hidden');

      if (targetView === 'view-calendar') {
        $('page-title').textContent = 'Kalender & Jadwal';
        renderCalendarView();
      } else if (targetView === 'view-pomodoro') {
        $('page-title').textContent = 'Mode Fokus (Pomodoro)';
      } else if (targetView === 'view-storage') {
        $('page-title').textContent = 'Pusat Data Offline';
      } else if (btn.dataset.domain) {
        if (btn.dataset.domain === 'tugas') $('tab-tugas').click();
        else $('tab-planning').click();
      }
    });
  });

  // Search Toggle
  $('btn-search-toggle').addEventListener('click', () => {
    playHapticSound('click');
    const box = $('search-box');
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) $('search-input').focus();
  });

  $('search-input').addEventListener('input', (e) => {
    appState.searchQuery = e.target.value.trim();
    if (appState.activeDomain === 'tugas') renderTugasStream();
    else renderPlanningStream();
  });

  $('btn-search-clear').addEventListener('click', () => {
    $('search-input').value = '';
    appState.searchQuery = '';
    $('search-box').classList.add('hidden');
    if (appState.activeDomain === 'tugas') renderTugasStream();
    else renderPlanningStream();
  });

  // FAB
  $('fab-create').addEventListener('click', () => {
    playHapticSound('click');
    openModalDrawer(appState.activeDomain);
  });

  // Modal controls
  $('modal-btn-cancel').addEventListener('click', closeModalDrawer);
  $('modal-btn-save').addEventListener('click', submitDrawerForm);
  $('btn-add-subtask-row').addEventListener('click', () => {
    dynamicSubtasks.push({ title: '', done: false });
    renderSubtaskInputStack();
  });

  // Calendar Controls
  $('cal-prev').addEventListener('click', () => {
    playHapticSound('click');
    appState.calendarMonth--;
    if (appState.calendarMonth < 0) {
      appState.calendarMonth = 11;
      appState.calendarYear--;
    }
    renderCalendarView();
  });

  $('cal-next').addEventListener('click', () => {
    playHapticSound('click');
    appState.calendarMonth++;
    if (appState.calendarMonth > 11) {
      appState.calendarMonth = 0;
      appState.calendarYear++;
    }
    renderCalendarView();
  });

  // Pomodoro Controls
  $$('.pomo-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playHapticSound('click');
      $$('.pomo-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setPomodoroMode(btn.dataset.mode, parseInt(btn.dataset.time, 10));
    });
  });

  $('btn-pomo-toggle').addEventListener('click', togglePomodoro);
  $('btn-pomo-reset').addEventListener('click', resetPomodoro);

  // Storage / Backup Center
  $('btn-test-alarm').addEventListener('click', () => {
    playHapticSound('alarm');
    triggerToast('🔔 Uji Coba Audio Alarm Berhasil Berbunyi!');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🔔 Uji Coba Alarm PlanOS', {
        body: 'Notifikasi & suara alarm berfungsi normal!',
        icon: 'icons/icon-192.png'
      });
    }
  });

  $('btn-export-csv').addEventListener('click', exportTasksToCsv);
  $('btn-export-json').addEventListener('click', exportDataToJson);
  $('input-import-backup').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importDataFromJson(e.target.files[0]);
    }
  });
  $('btn-load-sample').addEventListener('click', () => {
    if (confirm('Muat contoh data proyek nyata?')) loadRealWorldSampleProject();
  });
  $('btn-clear-database').addEventListener('click', () => {
    if (confirm('PERINGATAN: Yakin ingin mereset seluruh data?')) {
      appState.tugas = [];
      appState.plans = [];
      appState.pomoCompletedToday = 0;
      commitTugas();
      commitPlans();
      commitPomodoroStats();
      renderTugasStream();
      renderPlanningStream();
      triggerToast('Seluruh data berhasil dibersihkan');
    }
  });

  // Render Init
  renderSubFilterPills();
  renderTugasStream();
  renderPlanningStream();
  refreshBadgesAndMetrics();
  promptNotificationPermission();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', initializeApp);
