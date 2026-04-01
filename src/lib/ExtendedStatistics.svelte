<script lang="ts">
  import { fly } from "svelte/transition";
  import { allTimeStats, sessions } from "./store";

  export let onBack: () => void;

  const monthLabels = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  $: maxMonthCount = Math.max(1, ...$allTimeStats.months.map((m) => m.count));
  $: bestDayFormatted = $allTimeStats.bestDayDate
    ? (() => {
        const d = new Date($allTimeStats.bestDayDate);
        return `${d.getDate()}. ${monthLabels[d.getMonth()]} ${d.getFullYear()}`;
      })()
    : "—";
</script>

<div class="ext-stats-view" in:fly={{ y: 14, duration: 220, delay: 80 }}>
  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <button class="icon-btn back-btn" on:click={onBack} title="Zurück">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
      </button>
      <h1 class="title">Erweiterte Statistiken</h1>
    </div>
  </header>

  <!-- All-Time Summary -->
  <div class="summary-grid">
    <div class="stat-card stat-card-accent">
      <span class="stat-value">{$allTimeStats.totalCount}</span>
      <span class="stat-label">Pomodoros gesamt</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{$allTimeStats.totalHours}</span>
      <span class="stat-label">Stunden Fokus</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{$allTimeStats.activeDays}</span>
      <span class="stat-label">Aktive Tage</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{$allTimeStats.avgPerDay}</span>
      <span class="stat-label">Schnitt pro Tag</span>
    </div>
  </div>

  <!-- Streaks -->
  <div class="section">
    <span class="label">Streaks</span>
    <div class="streak-cards">
      <div class="streak-card">
        <div class="streak-icon">🔥</div>
        <div class="streak-info">
          <span class="streak-value">{$allTimeStats.currentStreak} Tage</span>
          <span class="streak-label">Aktuelle Serie</span>
        </div>
      </div>
      <div class="streak-card">
        <div class="streak-icon">🏆</div>
        <div class="streak-info">
          <span class="streak-value">{$allTimeStats.longestStreak} Tage</span>
          <span class="streak-label">Längste Serie</span>
        </div>
      </div>
      <div class="streak-card">
        <div class="streak-icon">⭐</div>
        <div class="streak-info">
          <span class="streak-value">{$allTimeStats.bestDayCount} Pomodoros</span>
          <span class="streak-label">Bester Tag ({bestDayFormatted})</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Monthly Chart -->
  <div class="section">
    <span class="label">Letzte 6 Monate</span>
    <div class="chart-card">
      <div class="bar-chart">
        {#each $allTimeStats.months as month}
          <div class="bar-col">
            <div class="bar-wrapper">
              <div
                class="bar"
                style:height="{(month.count / maxMonthCount) * 100}%"
                class:empty={month.count === 0}
              >
                {#if month.count > 0}
                  <span class="bar-value">{month.count}</span>
                {/if}
              </div>
            </div>
            <span class="bar-label">{month.label.split(" ")[0]}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Monthly Details -->
  <div class="section">
    <span class="label">Monatsdetails</span>
    <div class="month-list">
      {#each [...$allTimeStats.months].reverse() as month}
        <div class="month-row">
          <span class="month-name">{month.label}</span>
          <span class="month-detail">{month.count} Pomodoros &middot; {Math.round(month.minutes / 60 * 10) / 10} Std.</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Session History Info -->
  <div class="section">
    <div class="info-card">
      <span class="info-text">{$sessions.length} Sessions im Verlauf gespeichert (max. 500)</span>
    </div>
  </div>
</div>

<style>
  .ext-stats-view {
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
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  /* Summary Grid */
  .summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 28px;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 18px 14px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .stat-card-accent {
    border-color: var(--accent-border);
    background: var(--accent-bg);
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
  }

  /* Sections */
  .section {
    margin-bottom: 24px;
  }

  /* Streaks */
  .streak-cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .streak-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .streak-icon {
    font-size: 24px;
    line-height: 1;
  }

  .streak-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .streak-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
  }

  .streak-label {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  /* Chart */
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
    max-width: 48px;
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

  /* Monthly Details */
  .month-list {
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .month-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-light);
  }

  .month-row:last-child {
    border-bottom: none;
  }

  .month-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }

  .month-detail {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Info */
  .info-card {
    padding: 12px 16px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .info-text {
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
