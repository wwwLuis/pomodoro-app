<script lang="ts">
  import { fly } from "svelte/transition";
  import { allTimeStats, sessions, computeFilteredStats } from "./store";

  export let onBack: () => void;

  const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  type FilterType = "all" | "year" | "month" | "day";

  let filterType: FilterType = "all";
  let selectedYear: number = new Date().getFullYear();
  let selectedMonth: number = new Date().getMonth();
  let selectedDay: string = new Date().toISOString().split("T")[0];

  $: filter = (() => {
    switch (filterType) {
      case "year": return { type: "year" as const, year: selectedYear };
      case "month": return { type: "month" as const, year: selectedYear, month: selectedMonth };
      case "day": return { type: "day" as const, date: selectedDay };
      default: return { type: "all" as const };
    }
  })();

  $: filteredStats = computeFilteredStats($sessions, filter);
  $: maxDayCount = Math.max(1, ...filteredStats.days.map((d) => d.count));
  $: bestDayFormatted = $allTimeStats.bestDayDate
    ? (() => {
        const d = new Date($allTimeStats.bestDayDate);
        return `${d.getDate()}. ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      })()
    : "—";

  // Available months for the selected year
  $: availableMonths = Array.from({ length: 12 }, (_, i) => i);
</script>

<div class="ext-stats-view" in:fly={{ y: 14, duration: 220, delay: 80 }}>
  <!-- Header -->
  <header class="header sticky-header">
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

  <!-- Best Day -->
  <div class="section">
    <div class="best-day-card">
      <span class="best-day-label">Bester Tag</span>
      <span class="best-day-value">{$allTimeStats.bestDayCount} Pomodoros</span>
      <span class="best-day-date">{bestDayFormatted}</span>
    </div>
  </div>

  <!-- Filter Controls -->
  <div class="section">
    <span class="label">Zeitraum filtern</span>
    <div class="filter-controls">
      <div class="filter-tabs">
        {#each [["all", "Gesamt"], ["year", "Jahr"], ["month", "Monat"], ["day", "Tag"]] as [type, label]}
          <button
            class="filter-tab"
            class:active={filterType === type}
            on:click={() => (filterType = type as FilterType)}
          >
            {label}
          </button>
        {/each}
      </div>

      <div class="filter-selectors">
        {#if filterType === "year" || filterType === "month"}
          <select
            class="filter-select"
            bind:value={selectedYear}
          >
            {#each $allTimeStats.years as year}
              <option value={year}>{year}</option>
            {/each}
            {#if $allTimeStats.years.length === 0}
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            {/if}
          </select>
        {/if}

        {#if filterType === "month"}
          <select
            class="filter-select"
            bind:value={selectedMonth}
          >
            {#each availableMonths as m}
              <option value={m}>{monthNames[m]}</option>
            {/each}
          </select>
        {/if}

        {#if filterType === "day"}
          <input
            type="date"
            class="filter-date"
            bind:value={selectedDay}
          />
        {/if}
      </div>
    </div>
  </div>

  <!-- Filtered Results -->
  <div class="section">
    <div class="filtered-summary">
      <div class="filtered-stat">
        <span class="filtered-value">{filteredStats.count}</span>
        <span class="filtered-label">Pomodoros</span>
      </div>
      <div class="filtered-stat">
        <span class="filtered-value">{filteredStats.hours}</span>
        <span class="filtered-label">Stunden</span>
      </div>
      <div class="filtered-stat">
        <span class="filtered-value">{filteredStats.days.length}</span>
        <span class="filtered-label">Tage aktiv</span>
      </div>
    </div>
  </div>

  <!-- Filtered Day Breakdown Chart -->
  {#if filteredStats.days.length > 0}
    <div class="section">
      <span class="label">Tagesübersicht</span>
      {#if filteredStats.days.length <= 31}
        <div class="chart-card">
          <div class="bar-chart" class:bar-chart-wide={filteredStats.days.length > 14}>
            {#each filteredStats.days as day}
              <div class="bar-col">
                <div class="bar-wrapper">
                  <div
                    class="bar"
                    style:height="{(day.count / maxDayCount) * 100}%"
                    class:empty={day.count === 0}
                    title="{day.date}: {day.count} Pomodoros, {day.minutes} Min."
                  >
                    {#if day.count > 0 && filteredStats.days.length <= 14}
                      <span class="bar-value">{day.count}</span>
                    {/if}
                  </div>
                </div>
                {#if filteredStats.days.length <= 14}
                  <span class="bar-label">{day.date.split("-")[2]}.{day.date.split("-")[1]}.</span>
                {:else}
                  <span class="bar-label bar-label-small">{parseInt(day.date.split("-")[2])}</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <!-- For large ranges, show as list -->
        <div class="day-list">
          {#each [...filteredStats.days].reverse().slice(0, 50) as day}
            <div class="day-row">
              <span class="day-date">{day.date}</span>
              <div class="day-bar-wrapper">
                <div class="day-bar" style:width="{(day.count / maxDayCount) * 100}%"></div>
              </div>
              <span class="day-detail">{day.count} P &middot; {day.minutes} Min.</span>
            </div>
          {/each}
          {#if filteredStats.days.length > 50}
            <div class="day-row day-row-more">
              ... und {filteredStats.days.length - 50} weitere Tage
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="section">
      <div class="empty-state">Keine Sessions im gewählten Zeitraum.</div>
    </div>
  {/if}

  <!-- Session History Info -->
  <div class="section">
    <div class="info-card">
      <span class="info-text">{$sessions.length} Sessions im Verlauf gespeichert (max. 10.000)</span>
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

  /* Best Day */
  .best-day-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .best-day-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .best-day-value {
    font-size: 15px;
    font-weight: 700;
    color: var(--accent);
  }

  .best-day-date {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: auto;
  }

  /* Sections */
  .section {
    margin-bottom: 24px;
  }

  /* Filter Controls */
  .filter-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .filter-tabs {
    display: flex;
    gap: 0;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .filter-tab {
    flex: 1;
    padding: 10px 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-right: 1px solid var(--border-light);
    cursor: pointer;
    transition: all var(--transition);
  }

  .filter-tab:last-child {
    border-right: none;
  }

  .filter-tab.active {
    background: var(--accent);
    color: #fff;
    font-weight: 600;
  }

  .filter-tab:hover:not(.active) {
    background: var(--bg-hover);
    color: var(--text);
  }

  .filter-selectors {
    display: flex;
    gap: 8px;
  }

  .filter-select {
    flex: 1;
    padding: 8px 12px !important;
    font-size: 13px !important;
    border-radius: var(--radius) !important;
  }

  .filter-date {
    flex: 1;
    padding: 8px 12px !important;
    font-size: 13px !important;
    border-radius: var(--radius) !important;
  }

  /* Filtered Summary */
  .filtered-summary {
    display: flex;
    gap: 0;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .filtered-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 16px 8px;
    border-right: 1px solid var(--border-light);
  }

  .filtered-stat:last-child {
    border-right: none;
  }

  .filtered-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .filtered-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
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
    gap: 4px;
  }

  .bar-chart-wide {
    gap: 2px;
  }

  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    gap: 6px;
    min-width: 0;
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
    border-radius: 4px 4px 0 0;
    min-height: 3px;
    position: relative;
    transition: height var(--transition);
  }

  .bar.empty {
    background: var(--border-light);
    min-height: 3px;
    height: 3px !important;
  }

  .bar-value {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .bar-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .bar-label-small {
    font-size: 9px;
  }

  /* Day List (for large ranges) */
  .day-list {
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    max-height: 400px;
    overflow-y: auto;
  }

  .day-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-light);
  }

  .day-row:last-child {
    border-bottom: none;
  }

  .day-row-more {
    justify-content: center;
    font-size: 12px;
    color: var(--text-muted);
    padding: 12px 14px;
  }

  .day-date {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    width: 80px;
    flex-shrink: 0;
  }

  .day-bar-wrapper {
    flex: 1;
    height: 6px;
    background: var(--border-light);
    border-radius: 3px;
    overflow: hidden;
  }

  .day-bar {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    min-width: 3px;
    transition: width var(--transition);
  }

  .day-detail {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 24px;
    font-size: 13px;
    color: var(--text-muted);
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
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
