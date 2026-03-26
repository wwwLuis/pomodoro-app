import { writable, derived, get } from "svelte/store";
import type {
  PomodoroSettings,
  Task,
  PomodoroSession,
  TimerState,
  SessionType,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

/* ═══════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════ */

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ═══════════════════════════════════════════
   Settings
   ═══════════════════════════════════════════ */

const SETTINGS_KEY = "pomo-settings";

function loadSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<PomodoroSettings>(loadSettings());

  subscribe((s) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {}
  });

  return {
    subscribe,
    update(partial: Partial<PomodoroSettings>) {
      update((s) => ({ ...s, ...partial }));
    },
    reset() {
      set({ ...DEFAULT_SETTINGS });
    },
  };
}

export const settings = createSettingsStore();

/* ═══════════════════════════════════════════
   Tasks
   ═══════════════════════════════════════════ */

const TASKS_KEY = "pomo-tasks";

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function createTaskStore() {
  const { subscribe, set, update } = writable<Task[]>(loadTasks());

  subscribe((ts) => {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(ts));
    } catch {}
  });

  return {
    subscribe,

    add(name: string, targetPomodoros: number) {
      update((ts) => [
        ...ts,
        {
          id: genId(),
          name,
          completedPomodoros: 0,
          targetPomodoros,
          createdAt: Date.now(),
          completed: false,
        },
      ]);
    },

    remove(id: string) {
      update((ts) => ts.filter((t) => t.id !== id));
    },

    incrementPomodoro(id: string) {
      update((ts) =>
        ts.map((t) =>
          t.id === id ? { ...t, completedPomodoros: t.completedPomodoros + 1 } : t
        )
      );
    },

    toggleComplete(id: string) {
      update((ts) =>
        ts.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
      );
    },

    updateTask(id: string, partial: Partial<Task>) {
      update((ts) =>
        ts.map((t) => (t.id === id ? { ...t, ...partial } : t))
      );
    },
  };
}

export const tasks = createTaskStore();

/* ═══════════════════════════════════════════
   Sessions (History)
   ═══════════════════════════════════════════ */

const SESSIONS_KEY = "pomo-sessions";
const SESSIONS_MAX = 500;

function loadSessions(): PomodoroSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function createSessionStore() {
  const { subscribe, set, update } = writable<PomodoroSession[]>(loadSessions());

  subscribe((ss) => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(ss));
    } catch {}
  });

  return {
    subscribe,

    record(session: Omit<PomodoroSession, "id">) {
      update((ss) =>
        [{ ...session, id: genId() }, ...ss].slice(0, SESSIONS_MAX)
      );
    },

    clear() {
      set([]);
    },
  };
}

export const sessions = createSessionStore();

/** Get start of today (midnight) */
function startOfDay(date: Date = new Date()): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Get start of the week (Monday) */
function startOfWeek(date: Date = new Date()): number {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const todayStats = derived(sessions, ($ss) => {
  const dayStart = startOfDay();
  const today = $ss.filter(
    (s) => s.type === "work" && s.completedAt >= dayStart
  );
  return {
    count: today.length,
    totalMinutes: Math.round(
      today.reduce((sum, s) => sum + s.duration, 0) / 60
    ),
  };
});

export const weekStats = derived(sessions, ($ss) => {
  const weekStart = startOfWeek();
  const week = $ss.filter(
    (s) => s.type === "work" && s.completedAt >= weekStart
  );

  // Build per-day breakdown (Mon=0 ... Sun=6)
  const days = Array.from({ length: 7 }, () => ({
    count: 0,
    minutes: 0,
  }));

  for (const s of week) {
    const d = new Date(s.completedAt);
    const dayIdx = (d.getDay() + 6) % 7; // Mon=0
    days[dayIdx].count++;
    days[dayIdx].minutes += Math.round(s.duration / 60);
  }

  const totalCount = week.length;
  const totalMinutes = Math.round(
    week.reduce((sum, s) => sum + s.duration, 0) / 60
  );

  return { days, totalCount, totalMinutes };
});

/* ═══════════════════════════════════════════
   Timer (State Machine)
   ═══════════════════════════════════════════ */

export interface TimerStoreValue {
  state: TimerState;
  sessionType: SessionType;
  remainingSeconds: number;
  totalSeconds: number;
  currentSession: number;
  activeTaskId: string | null;
}

function getDurationSeconds(type: SessionType, s: PomodoroSettings): number {
  switch (type) {
    case "work":
      return s.workDuration * 60;
    case "shortBreak":
      return s.shortBreakDuration * 60;
    case "longBreak":
      return s.longBreakDuration * 60;
  }
}

function createTimerStore() {
  const s = get(settings);
  const initialSeconds = getDurationSeconds("work", s);

  const { subscribe, set, update } = writable<TimerStoreValue>({
    state: "idle",
    sessionType: "work",
    remainingSeconds: initialSeconds,
    totalSeconds: initialSeconds,
    currentSession: 1,
    activeTaskId: null,
  });

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let targetEndTime: number = 0;

  // Callbacks set by Timer.svelte
  let onComplete: ((sessionType: SessionType) => void) | null = null;

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function tick() {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((targetEndTime - now) / 1000));

    update((t) => {
      if (remaining <= 0) {
        clearTimer();
        // Record the completed session
        const completedType = t.sessionType;
        const duration = t.totalSeconds;

        sessions.record({
          taskId: t.activeTaskId,
          type: completedType,
          startedAt: targetEndTime - duration * 1000,
          completedAt: Date.now(),
          duration,
        });

        // Increment task pomodoro count
        if (completedType === "work" && t.activeTaskId) {
          tasks.incrementPomodoro(t.activeTaskId);
        }

        // Determine next session
        let nextSession = t.currentSession;
        let nextType: SessionType;

        if (completedType === "work") {
          if (t.currentSession % get(settings).sessionsBeforeLongBreak === 0) {
            nextType = "longBreak";
          } else {
            nextType = "shortBreak";
          }
          nextSession = t.currentSession + 1;
        } else {
          nextType = "work";
        }

        const nextSettings = get(settings);
        const nextSeconds = getDurationSeconds(nextType, nextSettings);

        // Fire callback
        if (onComplete) onComplete(completedType);

        // Auto-start or idle
        if (nextSettings.autoStartNext) {
          targetEndTime = Date.now() + nextSeconds * 1000;
          intervalId = setInterval(tick, 250);
          return {
            ...t,
            state: "running" as TimerState,
            sessionType: nextType,
            remainingSeconds: nextSeconds,
            totalSeconds: nextSeconds,
            currentSession: nextSession,
          };
        }

        return {
          ...t,
          state: "idle" as TimerState,
          sessionType: nextType,
          remainingSeconds: nextSeconds,
          totalSeconds: nextSeconds,
          currentSession: nextSession,
        };
      }

      return { ...t, remainingSeconds: remaining };
    });
  }

  return {
    subscribe,

    setOnComplete(cb: (sessionType: SessionType) => void) {
      onComplete = cb;
    },

    start() {
      const current = get({ subscribe });
      targetEndTime = Date.now() + current.remainingSeconds * 1000;
      clearTimer();
      intervalId = setInterval(tick, 250);
      update((t) => ({ ...t, state: "running" }));
    },

    pause() {
      clearTimer();
      // Snapshot remaining time accurately
      const remaining = Math.max(
        0,
        Math.ceil((targetEndTime - Date.now()) / 1000)
      );
      update((t) => ({ ...t, state: "paused", remainingSeconds: remaining }));
    },

    resume() {
      const current = get({ subscribe });
      targetEndTime = Date.now() + current.remainingSeconds * 1000;
      clearTimer();
      intervalId = setInterval(tick, 250);
      update((t) => ({ ...t, state: "running" }));
    },

    reset() {
      clearTimer();
      const current = get({ subscribe });
      const s = get(settings);
      const seconds = getDurationSeconds(current.sessionType, s);
      update((t) => ({
        ...t,
        state: "idle",
        remainingSeconds: seconds,
        totalSeconds: seconds,
      }));
    },

    skipToNext() {
      clearTimer();
      const current = get({ subscribe });
      const s = get(settings);

      let nextType: SessionType;
      let nextSession = current.currentSession;

      if (current.sessionType === "work") {
        if (current.currentSession % s.sessionsBeforeLongBreak === 0) {
          nextType = "longBreak";
        } else {
          nextType = "shortBreak";
        }
        nextSession = current.currentSession + 1;
      } else {
        nextType = "work";
      }

      const seconds = getDurationSeconds(nextType, s);
      update((t) => ({
        ...t,
        state: "idle",
        sessionType: nextType,
        remainingSeconds: seconds,
        totalSeconds: seconds,
        currentSession: nextSession,
      }));
    },

    setActiveTask(id: string | null) {
      update((t) => ({ ...t, activeTaskId: id }));
    },

    setSessionType(type: SessionType) {
      clearTimer();
      const s = get(settings);
      const seconds = getDurationSeconds(type, s);
      update((t) => ({
        ...t,
        state: "idle",
        sessionType: type,
        remainingSeconds: seconds,
        totalSeconds: seconds,
      }));
    },

    /** Refresh durations when settings change (only if idle) */
    refreshDuration() {
      const current = get({ subscribe });
      if (current.state !== "idle") return;
      const s = get(settings);
      const seconds = getDurationSeconds(current.sessionType, s);
      update((t) => ({
        ...t,
        remainingSeconds: seconds,
        totalSeconds: seconds,
      }));
    },
  };
}

export const timer = createTimerStore();

/* ═══════════════════════════════════════════
   Sound
   ═══════════════════════════════════════════ */

export function playCompletionSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1000;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.65);
  } catch {}
}
