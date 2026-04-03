import { writable, derived, get } from "svelte/store";
import type {
  PomodoroSettings,
  GoogleAuth,
  Task,
  PomodoroSession,
  TimerState,
  SessionType,
  SessionPlan,
  SessionPlanStep,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

// Google OAuth Client credentials — loaded from .env file
// See README for setup guide: https://console.cloud.google.com/
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "";

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
const SESSIONS_MAX = 10000;

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
  // Callback for plan-aware next-session logic (set after activePlan is defined)
  // Returns: next step info, or { planFinished: true } when a plan just ended, or null if no plan active
  let onPlanNext: (() => { type: SessionType; seconds: number; autoStart: boolean } | { planFinished: true } | null) | null = null;

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

        // Fire callback
        if (onComplete) onComplete(completedType);

        // Check if a session plan is active
        const planNext = onPlanNext ? onPlanNext() : null;
        if (planNext) {
          // Plan just finished — reset to fresh start (like opening the app)
          if ("planFinished" in planNext) {
            const freshSeconds = getDurationSeconds("work", get(settings));
            return {
              ...t,
              state: "idle" as TimerState,
              sessionType: "work" as SessionType,
              remainingSeconds: freshSeconds,
              totalSeconds: freshSeconds,
              currentSession: 1,
            };
          }

          const { type: nextType, seconds: nextSeconds, autoStart } = planNext;
          const nextSession = completedType === "work" ? t.currentSession + 1 : t.currentSession;

          if (autoStart) {
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

        // Default: determine next session from settings
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

    setOnPlanNext(cb: (() => { type: SessionType; seconds: number; autoStart: boolean } | { planFinished: true } | null) | null) {
      onPlanNext = cb;
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
      // If the totalSeconds was set by a plan, reset to that; otherwise use settings
      const seconds = current.totalSeconds;
      update((t) => ({
        ...t,
        state: "idle",
        remainingSeconds: seconds,
      }));
    },

    skipToNext() {
      clearTimer();

      // Check if a session plan is active — let the plan decide the next step
      const planNext = onPlanNext ? onPlanNext() : null;
      if (planNext) {
        // Plan just finished — reset to fresh start
        if ("planFinished" in planNext) {
          const freshSeconds = getDurationSeconds("work", get(settings));
          update((t) => ({
            ...t,
            state: "idle",
            sessionType: "work" as SessionType,
            remainingSeconds: freshSeconds,
            totalSeconds: freshSeconds,
            currentSession: 1,
          }));
          return;
        }

        const current = get({ subscribe });
        const nextSession = current.sessionType === "work" ? current.currentSession + 1 : current.currentSession;
        update((t) => ({
          ...t,
          state: "idle",
          sessionType: planNext.type,
          remainingSeconds: planNext.seconds,
          totalSeconds: planNext.seconds,
          currentSession: nextSession,
        }));
        return;
      }

      // Default: standard session sequence
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

    /** Set a custom duration in seconds (used by session planner) */
    setCustomDuration(seconds: number) {
      clearTimer();
      update((t) => ({
        ...t,
        state: "idle" as TimerState,
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
   Session Plans
   ═══════════════════════════════════════════ */

const PLANS_KEY = "pomo-session-plans";

function loadPlans(): SessionPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function createSessionPlanStore() {
  const { subscribe, set, update } = writable<SessionPlan[]>(loadPlans());

  subscribe((plans) => {
    try {
      localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    } catch {}
  });

  return {
    subscribe,

    add(plan: Omit<SessionPlan, "id">) {
      update((plans) => [
        ...plans,
        { ...plan, id: genId() },
      ]);
    },

    remove(id: string) {
      update((plans) => plans.filter((p) => p.id !== id));
    },

    update(id: string, partial: Partial<Omit<SessionPlan, "id">>) {
      update((plans) =>
        plans.map((p) => (p.id === id ? { ...p, ...partial } : p))
      );
    },
  };
}

export const sessionPlans = createSessionPlanStore();

/** Active plan execution state */
export interface ActivePlanState {
  planId: string;
  planName: string;
  steps: SessionPlanStep[];
  currentStepIndex: number;
}

export const activePlan = writable<ActivePlanState | null>(null);

/** Start executing a session plan */
export function startPlan(plan: SessionPlan) {
  if (plan.steps.length === 0) return;

  const firstStep = plan.steps[0];
  activePlan.set({
    planId: plan.id,
    planName: plan.name,
    steps: plan.steps,
    currentStepIndex: 0,
  });

  // Set the timer to the first step
  timer.setSessionType(firstStep.type);
  // Override the duration for this plan step
  timer.setCustomDuration(firstStep.durationMinutes * 60);
}

/** Advance to the next step in the active plan. Returns false if plan is complete. */
export function advancePlan(): boolean {
  const plan = get(activePlan);
  if (!plan) return false;

  const nextIndex = plan.currentStepIndex + 1;
  if (nextIndex >= plan.steps.length) {
    activePlan.set(null);
    return false;
  }

  const nextStep = plan.steps[nextIndex];
  activePlan.update((p) => p ? { ...p, currentStepIndex: nextIndex } : null);
  timer.setSessionType(nextStep.type);
  timer.setCustomDuration(nextStep.durationMinutes * 60);
  return true;
}

/** Stop the active plan */
export function stopPlan() {
  activePlan.set(null);
}

// Wire up plan-aware next-session logic into the timer
timer.setOnPlanNext(() => {
  const plan = get(activePlan);
  if (!plan) return null;

  const nextIndex = plan.currentStepIndex + 1;
  if (nextIndex >= plan.steps.length) {
    // Plan is complete — signal finished so timer resets to 0:00
    activePlan.set(null);
    return { planFinished: true };
  }

  const nextStep = plan.steps[nextIndex];
  activePlan.update((p) => p ? { ...p, currentStepIndex: nextIndex } : null);
  return {
    type: nextStep.type,
    seconds: nextStep.durationMinutes * 60,
    autoStart: get(settings).autoStartNext,
  };
});

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

/* ═══════════════════════════════════════════
   Google Auth
   ═══════════════════════════════════════════ */

const AUTH_KEY = "pomo-google-auth";

function loadAuth(): GoogleAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuth(auth: GoogleAuth | null) {
  try {
    if (auth) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  } catch {}
}

function createGoogleAuthStore() {
  const { subscribe, set, update } = writable<GoogleAuth | null>(loadAuth());

  subscribe((a) => saveAuth(a));

  async function refreshAccessToken(): Promise<string | null> {
    const current = get({ subscribe });
    if (!current?.refreshToken) return null;

    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: current.refreshToken,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          grant_type: "refresh_token",
        }),
      });

      if (!res.ok) throw new Error("Refresh failed");
      const data = await res.json();

      update((a) =>
        a
          ? {
              ...a,
              accessToken: data.access_token,
              expiresAt: Date.now() + data.expires_in * 1000,
            }
          : null
      );
      return data.access_token;
    } catch {
      set(null);
      return null;
    }
  }

  async function getValidToken(): Promise<string | null> {
    const current = get({ subscribe });
    if (!current) return null;
    if (Date.now() < current.expiresAt - 60000) return current.accessToken;
    return refreshAccessToken();
  }

  return {
    subscribe,

    async login() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const resultStr = await invoke<string>("start_oauth_flow", {
          clientId: GOOGLE_CLIENT_ID,
        });
        const { code, redirect_uri } = JSON.parse(resultStr);

        // Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri,
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          const errBody = await tokenRes.text();
          console.error("Token exchange error:", tokenRes.status, errBody);
          throw new Error("Token exchange failed");
        }
        const tokens = await tokenRes.json();

        // Get user info
        const userRes = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        const userInfo = userRes.ok ? await userRes.json() : { name: "User" };

        const auth: GoogleAuth = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          userName: userInfo.name || userInfo.email || "User",
        };
        set(auth);
        return auth;
      } catch (e) {
        console.error("OAuth login failed:", e);
        throw e;
      }
    },

    logout() {
      set(null);
    },

    refreshAccessToken,
    getValidToken,

    async fetchPlaylists(): Promise<
      { id: string; title: string; thumbnail: string; itemCount: number }[]
    > {
      const token = await getValidToken();
      if (!token) throw new Error("Nicht angemeldet");

      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const errBody = await res.text();
        console.error("Playlist API error:", res.status, errBody);
        // Try to extract a meaningful error message
        try {
          const errJson = JSON.parse(errBody);
          const msg = errJson?.error?.message || "API-Fehler";
          const code = errJson?.error?.code || res.status;
          throw new Error(`YouTube API Fehler (${code}): ${msg}`);
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message.startsWith("YouTube API"))
            throw parseErr;
          throw new Error(`YouTube API Fehler (${res.status})`);
        }
      }
      const data = await res.json();

      return (data.items || []).map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail:
          item.snippet.thumbnails?.default?.url ||
          item.snippet.thumbnails?.medium?.url ||
          "",
        itemCount: item.contentDetails?.itemCount || 0,
      }));
    },

    /** Fetch all video IDs for a playlist via YouTube Data API v3 */
    async fetchPlaylistVideoIds(playlistId: string): Promise<string[]> {
      const token = await getValidToken();
      if (!token) return [];

      const videoIds: string[] = [];
      let nextPageToken = "";

      // Step 1: Collect all video IDs from the playlist
      do {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return videoIds;

        const data = await res.json();
        for (const item of data.items || []) {
          const videoId = item.contentDetails?.videoId;
          if (videoId) videoIds.push(videoId);
        }
        nextPageToken = data.nextPageToken || "";
      } while (nextPageToken && videoIds.length < 300);

      if (videoIds.length === 0) return [];

      // Step 2: Batch-verify via Videos API which IDs are actually
      // playable (exist, public/unlisted, embeddable, fully processed).
      // Deleted/private/blocked videos simply won't appear in the response.
      const verified = new Set<string>();
      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50);
        const url = `https://www.googleapis.com/youtube/v3/videos?part=id%2Cstatus&id=${batch.join(",")}`;
        try {
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) continue;
          const data = await res.json();
          for (const item of data.items || []) {
            const s = item.status;
            if (
              s?.uploadStatus === "processed" &&
              s?.embeddable !== false &&
              (s?.privacyStatus === "public" || s?.privacyStatus === "unlisted")
            ) {
              verified.add(item.id);
            }
          }
        } catch {
          // If verification fails for a batch, include them unverified
          // rather than dropping potentially good videos
          for (const id of batch) verified.add(id);
        }
      }

      return videoIds.filter((id) => verified.has(id));
    },
  };
}

export const googleAuth = createGoogleAuthStore();
export const isLoggedIn = derived(googleAuth, ($a) => $a !== null);

/* ═══════════════════════════════════════════
   YouTube Music Player
   ═══════════════════════════════════════════ */

export function extractPlaylistId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const list = u.searchParams.get("list");
    if (list) return list;
  } catch {}
  // Try bare ID (no URL)
  if (/^PL[\w-]{16,}$/i.test(url)) return url;
  return null;
}

export type MusicPlayerState = "idle" | "loading" | "playing" | "paused" | "error";

export const musicPlayerState = writable<MusicPlayerState>("idle");

/** Detailed music status message for UI feedback */
export const musicStatusMessage = writable<string>("");

/** Derived: should music be playing right now? */
export const musicShouldPlay = derived(
  [timer, settings],
  ([$timer, $settings]) =>
    $settings.musicEnabled &&
    $timer.state === "running" &&
    $timer.sessionType === "work" &&
    ($settings.musicPlaylistId !== "" || $settings.musicPlaylistUrl !== "")
);

/** Callback for skip song — set by YouTubePlayer component */
let skipSongCallback: (() => void) | null = null;

export function registerSkipSong(cb: () => void) {
  skipSongCallback = cb;
}

export function unregisterSkipSong() {
  skipSongCallback = null;
}

export function skipSong() {
  if (skipSongCallback) skipSongCallback();
}

/** Callback for pause/resume music — set by YouTubePlayer component */
let toggleMusicCallback: (() => void) | null = null;

export function registerToggleMusic(cb: () => void) {
  toggleMusicCallback = cb;
}

export function unregisterToggleMusic() {
  toggleMusicCallback = null;
}

export function toggleMusic() {
  if (toggleMusicCallback) toggleMusicCallback();
}

/* ═══════════════════════════════════════════
   Backup
   ═══════════════════════════════════════════ */

export async function performBackup(): Promise<string | null> {
  const s = get(settings);
  if (!s.backupEnabled || !s.backupPath) return null;

  const data = {
    exportedAt: Date.now(),
    settings: s,
    sessions: get(sessions),
    tasks: get(tasks),
  };

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string>("export_backup", {
      data: JSON.stringify(data, null, 2),
      folderPath: s.backupPath,
    });
    return path;
  } catch (e) {
    console.error("Backup failed:", e);
    return null;
  }
}

/** Set the default backup path to <exe-dir>/backup if not already configured */
export async function initDefaultBackupPath(): Promise<void> {
  const s = get(settings);
  if (s.backupPath) return; // already configured

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const exeDir = await invoke<string>("get_exe_dir");
    const defaultPath = exeDir.replace(/\\/g, "/") + "/backup";
    settings.update({ backupPath: defaultPath });
  } catch (e) {
    console.error("Could not set default backup path:", e);
  }
}

export async function checkAndPerformAutoBackup(): Promise<string | null> {
  const s = get(settings);
  if (!s.backupEnabled || !s.backupPath) return null;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const needed = await invoke<boolean>("check_backup_needed", {
      folderPath: s.backupPath,
    });
    if (needed) {
      return performBackup();
    }
  } catch (e) {
    console.error("Auto backup check failed:", e);
  }
  return null;
}

export async function importBackupFromFile(filePath: string): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const raw = await invoke<string>("import_backup", { filePath });
    const data = JSON.parse(raw);

    if (data.sessions && Array.isArray(data.sessions)) {
      // Merge sessions (avoid duplicates by id)
      const existing = get(sessions);
      const existingIds = new Set(existing.map((s) => s.id));
      const newSessions = data.sessions.filter((s: any) => !existingIds.has(s.id));
      const merged = [...newSessions, ...existing].slice(0, SESSIONS_MAX);
      sessions.clear();
      for (const s of merged.reverse()) {
        sessions.record(s);
      }
    }

    if (data.tasks && Array.isArray(data.tasks)) {
      // Merge tasks (avoid duplicates by id)
      const existing = get(tasks);
      const existingIds = new Set(existing.map((t) => t.id));
      for (const t of data.tasks) {
        if (!existingIds.has(t.id)) {
          tasks.add(t.name, t.targetPomodoros);
        }
      }
    }

    return true;
  } catch (e) {
    console.error("Import failed:", e);
    return false;
  }
}

/* ═══════════════════════════════════════════
   Extended Statistics (All-time, Filterable)
   ═══════════════════════════════════════════ */

export const allTimeStats = derived(sessions, ($ss) => {
  const work = $ss.filter((s) => s.type === "work");
  const totalMinutes = Math.round(work.reduce((sum, s) => sum + s.duration, 0) / 60);
  const totalCount = work.length;

  // Active days
  const daySet = new Set<string>();
  for (const s of work) {
    const d = new Date(s.completedAt);
    daySet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  const activeDays = daySet.size;
  const avgPerDay = activeDays > 0 ? Math.round((totalCount / activeDays) * 10) / 10 : 0;

  // Best day
  const dayCountMap = new Map<string, number>();
  for (const s of work) {
    const d = new Date(s.completedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dayCountMap.set(key, (dayCountMap.get(key) || 0) + 1);
  }
  let bestDayDate = "";
  let bestDayCount = 0;
  for (const [date, count] of dayCountMap) {
    if (count > bestDayCount) {
      bestDayCount = count;
      bestDayDate = date;
    }
  }

  // Available years for filtering
  const years = [...new Set(work.map((s) => new Date(s.completedAt).getFullYear()))].sort((a, b) => b - a);

  return {
    totalCount,
    totalMinutes,
    totalHours: Math.round(totalMinutes / 60 * 10) / 10,
    bestDayDate,
    bestDayCount,
    activeDays,
    avgPerDay,
    years,
  };
});

/** Compute filtered stats for a given time range */
export function computeFilteredStats(
  allSessions: PomodoroSession[],
  filter: { type: "day"; date: string } | { type: "month"; year: number; month: number } | { type: "year"; year: number } | { type: "all" }
): { count: number; minutes: number; hours: number; days: { date: string; count: number; minutes: number }[] } {
  const work = allSessions.filter((s) => s.type === "work");
  let filtered: PomodoroSession[];

  switch (filter.type) {
    case "day": {
      const start = new Date(filter.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filtered = work.filter((s) => s.completedAt >= start.getTime() && s.completedAt < end.getTime());
      break;
    }
    case "month": {
      const start = new Date(filter.year, filter.month, 1);
      const end = new Date(filter.year, filter.month + 1, 1);
      filtered = work.filter((s) => s.completedAt >= start.getTime() && s.completedAt < end.getTime());
      break;
    }
    case "year": {
      const start = new Date(filter.year, 0, 1);
      const end = new Date(filter.year + 1, 0, 1);
      filtered = work.filter((s) => s.completedAt >= start.getTime() && s.completedAt < end.getTime());
      break;
    }
    default:
      filtered = work;
  }

  const minutes = Math.round(filtered.reduce((sum, s) => sum + s.duration, 0) / 60);

  // Per-day breakdown within the filtered range
  const dayMap = new Map<string, { count: number; minutes: number }>();
  for (const s of filtered) {
    const d = new Date(s.completedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const existing = dayMap.get(key) || { count: 0, minutes: 0 };
    existing.count++;
    existing.minutes += Math.round(s.duration / 60);
    dayMap.set(key, existing);
  }
  const days = [...dayMap.entries()]
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    count: filtered.length,
    minutes,
    hours: Math.round(minutes / 60 * 10) / 10,
    days,
  };
}
