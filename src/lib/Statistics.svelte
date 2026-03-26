<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { sessions, todayStats, weekStats, tasks } from "./store";

  export let onBack: () => void;

  const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  $: maxDayCount = Math.max(1, ...$weekStats.days.map((d) => d.count));

  // Task breakdown for the week
  $: taskBreakdown = (() => {
    const weekStart = getWeekStart();
    const weekSessions = $sessions.filter(
      (s) => s.type === "work" && s.completedAt >= weekStart
    );
    const map = new Map<string | null, { name: string; count: number; minutes: number }>();
    for (const s of weekSessions) {
      const existing = map.get(s.taskId);
      const taskName = s.taskId
        ? $tasks.find((t) => t.id === s.taskId)?.name ?? "Gelöschter Task"
        : "Ohne Task";
      if (existing) {
        existing.count++;
        existing.minutes += Math.round(s.duration / 60);
      } else {
        map.set(s.taskId, { name: taskName, count: 1, minutes: Math.round(s.duration / 60) });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  })();

  $: maxTaskCount = Math.max(1, ...taskBreakdown.map((t) => t.count));

  function getWeekStart(): number {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
</script>

<div class="stats-view" in:fly={{ y: 14, duration: 220, delay: 80 }}>
  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <button class="icon-btn back-btn" on:click={onBack} title="Zurück">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
      </button>
      <h1 class="title">Statistiken</h1>
    </div>
  </header>

  <!-- Summary Cards -->
  <div class="summary-row">
    <div class="summary-card">
      <span class="summary-value">{$todayStats.count}</span>
      <span class="summary-label">Pomodoros heute</span>
      <span class="summary-detail">{$todayStats.totalMinutes} Min. Fokus</span>
    </div>
    <div class="summary-card">
      <span class="summary-value">{$weekStats.totalCount}</span>
      <span class="summary-label">Diese Woche</span>
      <span class="summary-detail">{Math.round($weekStats.totalMinutes / 60 * 10) / 10} Std.</span>
    </div>
  </div>

  <!-- Weekly Bar Chart -->
  <div class="chart-section">
    <span class="label">Diese Woche</span>
    <div class="chart-card">
      <div class="bar-chart">
        {#each $weekStats.days as day, i}
          <div class="bar-col">
            <div class="bar-wrapper">
              <div
                class="bar"
                style:height="{(day.count / maxDayCount) * 100}%"
                class:empty={day.count === 0}
              >
                {#if day.count > 0}
                  <span class="bar-value">{day.count}</span>
                {/if}
              </div>
            </div>
            <span class="bar-label">{dayLabels[i]}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Task Breakdown -->
  {#if taskBreakdown.length > 0}
    <div class="chart-section">
      <span class="label">Tasks</span>
      <div class="task-breakdown">
        {#each taskBreakdown as item}
          <div class="breakdown-row">
            <div class="breakdown-info">
              <span class="breakdown-name">{item.name}</span>
              <span class="breakdown-detail">{item.count} Pomodoros &middot; {item.minutes} Min.</span>
            </div>
            <div class="breakdown-bar-wrapper">
              <div
                class="breakdown-bar"
                style:width="{(item.count / maxTaskCount) * 100}%"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Clear History -->
  {#if $sessions.length > 0}
    <div class="clear-section">
      <button class="btn-secondary btn-danger" on:click={() => sessions.clear()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Verlauf löschen
      </button>
    </div>
  {/if}
</div>

<style>
  .stats-view {
    width: 100%;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .back-btn {
    width: 36px;
    height: 36px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
  }

  .title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  /* Summary Cards */
  .summary-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 28px;
  }

  .summary-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 20px 16px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .summary-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: -0.02em;
  }

  .summary-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .summary-detail {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Chart Section */
  .chart-section {
    margin-bottom: 24px;
  }

  .chart-card {
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px;
  }

  .bar-chart {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 140px;
    gap: 8px;
  }

  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    gap: 8px;
  }

  .bar-wrapper {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .bar {
    width: 100%;
    max-width: 40px;
    background: var(--accent);
    border-radius: 6px 6px 0 0;
    min-height: 4px;
    position: relative;
    transition: height var(--transition);
  }

  .bar.empty {
    background: var(--border-light);
    min-height: 4px;
    height: 4px !important;
  }

  .bar-value {
    position: absolute;
    top: -22px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .bar-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
  }

  /* Task Breakdown */
  .task-breakdown {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .breakdown-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .breakdown-info {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .breakdown-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }

  .breakdown-detail {
    font-size: 12px;
    color: var(--text-muted);
  }

  .breakdown-bar-wrapper {
    height: 6px;
    background: var(--border-light);
    border-radius: 3px;
    overflow: hidden;
  }

  .breakdown-bar {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width var(--transition);
    min-width: 4px;
  }

  /* Clear */
  .clear-section {
    display: flex;
    justify-content: center;
    margin-top: 12px;
  }

  .btn-danger {
    color: var(--danger);
    border-color: var(--danger);
  }

  .btn-danger:hover {
    background: var(--danger-bg);
    color: var(--danger);
  }
</style>
