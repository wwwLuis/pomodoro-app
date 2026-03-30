<script lang="ts">
  import { fly } from "svelte/transition";
  import { settings, timer, musicPlayerState, musicStatusMessage } from "./store";
  import type { PomodoroSettings } from "./types";
  import PlaylistPicker from "./PlaylistPicker.svelte";

  export let onBack: () => void;

  // Always-on-top toggle
  async function setAlwaysOnTop(value: boolean) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setAlwaysOnTop(value);
    } catch {}
  }

  function updateSetting<K extends keyof PomodoroSettings>(
    key: K,
    value: PomodoroSettings[K]
  ) {
    settings.update({ [key]: value });
    // Refresh timer duration if idle
    timer.refreshDuration();
    // Sync always-on-top
    if (key === "alwaysOnTop") {
      setAlwaysOnTop(value as boolean);
    }
  }
</script>

<div class="settings-view" in:fly={{ y: 14, duration: 220, delay: 80 }}>
  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <button class="icon-btn back-btn" on:click={onBack} title="Zurück">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
      </button>
      <h1 class="title">Einstellungen</h1>
    </div>
  </header>

  <!-- Timer Durations -->
  <div class="settings-group">
    <span class="label">Timer</span>
    <div class="settings-card">
      <div class="setting-row">
        <span class="setting-label">Fokus-Dauer</span>
        <div class="setting-control">
          <input
            type="number"
            min="1"
            max="120"
            value={$settings.workDuration}
            on:change={(e) => updateSetting("workDuration", parseInt(e.currentTarget.value) || 25)}
            class="number-input"
          />
          <span class="unit">Min.</span>
        </div>
      </div>
      <div class="setting-row">
        <span class="setting-label">Kurze Pause</span>
        <div class="setting-control">
          <input
            type="number"
            min="1"
            max="60"
            value={$settings.shortBreakDuration}
            on:change={(e) => updateSetting("shortBreakDuration", parseInt(e.currentTarget.value) || 5)}
            class="number-input"
          />
          <span class="unit">Min.</span>
        </div>
      </div>
      <div class="setting-row">
        <span class="setting-label">Lange Pause</span>
        <div class="setting-control">
          <input
            type="number"
            min="1"
            max="60"
            value={$settings.longBreakDuration}
            on:change={(e) => updateSetting("longBreakDuration", parseInt(e.currentTarget.value) || 15)}
            class="number-input"
          />
          <span class="unit">Min.</span>
        </div>
      </div>
      <div class="setting-row">
        <span class="setting-label">Sessions bis lange Pause</span>
        <div class="setting-control">
          <input
            type="number"
            min="1"
            max="12"
            value={$settings.sessionsBeforeLongBreak}
            on:change={(e) => updateSetting("sessionsBeforeLongBreak", parseInt(e.currentTarget.value) || 4)}
            class="number-input"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Behavior -->
  <div class="settings-group">
    <span class="label">Verhalten</span>
    <div class="settings-card">
      <div class="setting-row">
        <span class="setting-label">Automatisch nächste Session starten</span>
        <button
          class="toggle"
          class:on={$settings.autoStartNext}
          on:click={() => updateSetting("autoStartNext", !$settings.autoStartNext)}
          aria-label="Automatisch nächste Session starten"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="setting-row">
        <span class="setting-label">Sound-Benachrichtigung</span>
        <button
          class="toggle"
          class:on={$settings.soundEnabled}
          on:click={() => updateSetting("soundEnabled", !$settings.soundEnabled)}
          aria-label="Sound-Benachrichtigung"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>
  </div>

  <!-- Window -->
  <div class="settings-group">
    <span class="label">Fenster</span>
    <div class="settings-card">
      <div class="setting-row">
        <span class="setting-label">Immer im Vordergrund</span>
        <button
          class="toggle"
          class:on={$settings.alwaysOnTop}
          on:click={() => updateSetting("alwaysOnTop", !$settings.alwaysOnTop)}
          aria-label="Immer im Vordergrund"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>
  </div>

  <!-- Musik -->
  <div class="settings-group">
    <span class="label">Musik</span>
    <div class="settings-card">
      <div class="setting-row">
        <span class="setting-label">Musik während Fokus</span>
        <button
          class="toggle"
          class:on={$settings.musicEnabled}
          on:click={() => updateSetting("musicEnabled", !$settings.musicEnabled)}
          aria-label="Musik während Fokus"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
      {#if $settings.musicEnabled}
        <div class="setting-row setting-row-col">
          <div class="volume-row">
            <span class="setting-label">Lautstärke</span>
            <div class="volume-control">
              <input
                type="range"
                min="0"
                max="100"
                value={$settings.musicVolume}
                on:input={(e) => updateSetting("musicVolume", parseInt(e.currentTarget.value))}
                class="volume-slider"
              />
              <span class="volume-value">{$settings.musicVolume}%</span>
            </div>
          </div>
        </div>
        <div class="setting-row setting-row-col">
          <PlaylistPicker />
        </div>
      {/if}
    </div>
    {#if $settings.musicEnabled && $musicStatusMessage}
      <div class="music-status" class:music-status-error={$musicPlayerState === "error"} class:music-status-playing={$musicPlayerState === "playing"}>
        <span class="music-status-text">{$musicStatusMessage}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .settings-view {
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

  .settings-group {
    margin-bottom: 24px;
  }

  .settings-card {
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-light);
  }

  .setting-row:last-child {
    border-bottom: none;
  }

  .setting-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
  }

  .setting-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .number-input {
    width: 64px !important;
    text-align: center;
    padding: 6px 8px !important;
    font-size: 14px !important;
  }

  .unit {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
  }

  /* Toggle Switch */
  .toggle {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--border);
    border-radius: 12px;
    border: none;
    cursor: pointer;
    transition: background var(--transition);
    padding: 0;
    flex-shrink: 0;
  }

  .toggle.on {
    background: var(--accent);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: transform var(--transition);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .toggle.on .toggle-knob {
    transform: translateX(20px);
  }

  .setting-row-col {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }

  .volume-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .volume-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 110px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    margin: 0;
    padding: 0;
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    cursor: pointer;
  }

  .volume-value {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    width: 40px;
    text-align: right;
    flex-shrink: 0;
  }

  .music-status {
    padding: 6px 12px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .music-status-error {
    color: var(--accent);
    white-space: normal;
    word-break: break-word;
  }

  .music-status-playing {
    color: var(--success);
  }

  .music-status-text {
    line-height: 1.4;
  }
</style>
