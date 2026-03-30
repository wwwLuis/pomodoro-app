<script lang="ts">
  import { onMount, onDestroy, getContext } from "svelte";
  import { get } from "svelte/store";
  import type { Writable } from "svelte/store";
  import { timer, settings, tasks, playCompletionSound, todayStats, musicPlayerState, musicStatusMessage, skipSong } from "./store";
  import type { SessionType } from "./types";

  export let onGoTasks: () => void;
  export let onGoSettings: () => void;
  export let onGoStats: () => void;

  const theme = getContext<Writable<"light" | "dark">>("theme");
  const toggleTheme = getContext<() => void>("toggleTheme");

  const CIRCUMFERENCE = 2 * Math.PI * 100;

  // Session type labels
  const typeLabels: Record<SessionType, string> = {
    work: "Fokus",
    shortBreak: "Kurze Pause",
    longBreak: "Lange Pause",
  };

  // Session type colors
  const typeColors: Record<SessionType, string> = {
    work: "var(--accent)",
    shortBreak: "var(--success)",
    longBreak: "var(--favorite)",
  };

  $: progress = 1 - $timer.remainingSeconds / $timer.totalSeconds;
  $: dashOffset = CIRCUMFERENCE * (1 - progress);
  $: minutes = Math.floor($timer.remainingSeconds / 60);
  $: seconds = $timer.remainingSeconds % 60;
  $: timeDisplay = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  $: strokeColor = typeColors[$timer.sessionType];
  $: activeTask = $tasks.find((t) => t.id === $timer.activeTaskId);
  $: sessionsBeforeLong = get(settings).sessionsBeforeLongBreak;
  $: sessionCounter = Math.ceil($timer.currentSession / 1);
  $: musicActive = $musicPlayerState === "playing";
  $: musicLoading = $musicPlayerState === "loading";
  $: musicError = $musicPlayerState === "error";

  // Notifications
  async function notifyComplete(sessionType: SessionType) {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } =
        await import("@tauri-apps/plugin-notification");
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (granted) {
        sendNotification({
          title: sessionType === "work" ? "Fokus-Session beendet!" : "Pause vorbei!",
          body:
            sessionType === "work"
              ? "Zeit für eine Pause."
              : "Bereit für die nächste Fokus-Session?",
        });
      }
    } catch {}
  }

  onMount(() => {
    timer.setOnComplete((sessionType: SessionType) => {
      const s = get(settings);
      if (s.soundEnabled) playCompletionSound();
      notifyComplete(sessionType);
    });

    // Listen for global shortcut
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("toggle-timer", () => {
        const t = get(timer);
        if (t.state === "running") timer.pause();
        else if (t.state === "paused") timer.resume();
        else timer.start();
      }).then((fn) => {
        unlisten = fn;
      });
    }).catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  });

  function handleMainAction() {
    if ($timer.state === "running") timer.pause();
    else if ($timer.state === "paused") timer.resume();
    else timer.start();
  }

  function handleSessionTypeClick(type: SessionType) {
    if ($timer.state !== "idle") return;
    timer.setSessionType(type);
  }
</script>

<div class="timer-view">
  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <h1 class="title">Pomodoro</h1>
      <span class="subtitle">Session {sessionCounter}</span>
    </div>
    <div class="header-actions">
      <button class="icon-btn" on:click={toggleTheme} title="Theme wechseln">
        {#if $theme === "light"}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        {/if}
      </button>
      <button class="icon-btn" on:click={onGoStats} title="Statistiken">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      </button>
      <button class="icon-btn" on:click={onGoSettings} title="Einstellungen">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Session Type Pills -->
  <div class="pills">
    {#each (["work", "shortBreak", "longBreak"] as SessionType[]) as type}
      <button
        class="pill"
        class:active={$timer.sessionType === type}
        class:disabled={$timer.state !== "idle"}
        on:click={() => handleSessionTypeClick(type)}
        style:--pill-color={typeColors[type]}
      >
        {typeLabels[type]}
      </button>
    {/each}
  </div>

  <!-- SVG Timer Circle -->
  <div class="timer-circle-wrapper">
    <svg width="240" height="240" viewBox="0 0 240 240">
      <!-- Background circle -->
      <circle
        cx="120" cy="120" r="100"
        fill="none"
        stroke="var(--border-light)"
        stroke-width="8"
      />
      <!-- Progress circle -->
      <circle
        cx="120" cy="120" r="100"
        fill="none"
        stroke={strokeColor}
        stroke-width="8"
        stroke-linecap="round"
        stroke-dasharray={CIRCUMFERENCE}
        stroke-dashoffset={dashOffset}
        transform="rotate(-90 120 120)"
        class="progress-ring"
        class:animating={$timer.state === "running"}
      />
    </svg>
    <div class="timer-text">
      <span class="time-display">{timeDisplay}</span>
      <span class="session-label">
        {typeLabels[$timer.sessionType]}
        {#if musicActive}
          <svg class="music-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        {:else if musicLoading}
          <span class="music-loading-dot">⏳</span>
        {:else if musicError}
          <span class="music-error-dot" title={$musicStatusMessage}>⚠</span>
        {/if}
      </span>
    </div>
  </div>

  <!-- Controls -->
  <div class="controls">
    <button class="btn-secondary" on:click={() => timer.reset()} title="Zurücksetzen">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg>
    </button>

    <button class="btn-primary btn-main" on:click={handleMainAction}>
      {#if $timer.state === "running"}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
        Pause
      {:else if $timer.state === "paused"}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Weiter
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Start
      {/if}
    </button>

    <button class="btn-secondary" on:click={() => timer.skipToNext()} title="Überspringen">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
      </svg>
    </button>
  </div>

  <!-- Music Skip -->
  {#if musicActive}
    <button class="btn-skip-song" on:click={skipSong} title="Song überspringen">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
      </svg>
    </button>
  {/if}

  <!-- Active Task -->
  <button class="active-task-card" on:click={onGoTasks}>
    {#if activeTask}
      <div class="task-info">
        <span class="task-name">{activeTask.name}</span>
        <span class="task-progress">{activeTask.completedPomodoros}/{activeTask.targetPomodoros} Pomodoros</span>
      </div>
    {:else}
      <span class="task-placeholder">Task auswählen...</span>
    {/if}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  </button>

  <!-- Today Stats -->
  <div class="today-stats">
    <span class="today-label">Heute</span>
    <span class="today-value">{$todayStats.count} Pomodoros &middot; {$todayStats.totalMinutes} Min.</span>
  </div>
</div>

<style>
  .timer-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-bottom: 28px;
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .subtitle {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  /* Pills */
  .pills {
    display: flex;
    gap: 8px;
    margin-bottom: 36px;
  }

  .pill {
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 20px;
    color: var(--text-secondary);
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    transition: all var(--transition);
    cursor: pointer;
  }

  .pill:hover:not(.disabled) {
    border-color: var(--text-muted);
    transform: translateY(-1px);
  }

  .pill.active {
    background: var(--pill-color, var(--accent));
    color: #fff;
    border-color: transparent;
  }

  .pill.disabled {
    opacity: 0.6;
    cursor: default;
  }

  /* Timer Circle */
  .timer-circle-wrapper {
    position: relative;
    width: 240px;
    height: 240px;
    margin-bottom: 32px;
  }

  .timer-circle-wrapper svg {
    display: block;
  }

  .progress-ring {
    transition: stroke-dashoffset 0.3s linear;
  }

  .progress-ring.animating {
    transition: stroke-dashoffset 1s linear;
  }

  .timer-text {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .time-display {
    font-size: 44px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .session-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .music-icon {
    color: var(--accent);
    animation: pulse-music 1.5s ease-in-out infinite;
  }

  .music-loading-dot {
    font-size: 12px;
    animation: pulse-music 1s ease-in-out infinite;
  }

  .music-error-dot {
    font-size: 12px;
    color: var(--accent);
    cursor: help;
  }

  @keyframes pulse-music {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Controls */
  .controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
  }

  .btn-main {
    padding: 12px 32px;
    font-size: 15px;
    gap: 8px;
  }

  .btn-skip-song {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 14px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: 16px;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all var(--transition);
    margin-bottom: 12px;
  }

  .btn-skip-song:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--bg-hover);
  }

  /* Active Task Card */
  .active-task-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 14px 18px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    color: var(--text);
    cursor: pointer;
    transition: all var(--transition);
    margin-bottom: 20px;
  }

  .active-task-card:hover {
    border-color: var(--text-muted);
    background: var(--bg-hover);
  }

  .task-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .task-name {
    font-size: 14px;
    font-weight: 600;
  }

  .task-progress {
    font-size: 12px;
    color: var(--text-muted);
  }

  .task-placeholder {
    font-size: 13.5px;
    color: var(--text-muted);
  }

  /* Today Stats */
  .today-stats {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .today-label {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.06em;
  }

  .today-value {
    font-weight: 500;
  }
</style>
