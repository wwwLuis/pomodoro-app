<script lang="ts">
  import { fly } from "svelte/transition";
  import { sessionPlans, activePlan, startPlan, stopPlan, timer } from "./store";
  import type { SessionPlan, SessionPlanStep, SessionType } from "./types";

  export let onBack: () => void;

  const typeLabels: Record<SessionType, string> = {
    work: "Fokus",
    shortBreak: "Kurze Pause",
    longBreak: "Lange Pause",
  };

  const typeColors: Record<SessionType, string> = {
    work: "var(--accent)",
    shortBreak: "var(--success)",
    longBreak: "var(--favorite)",
  };

  let showCreateForm = false;
  let newPlanName = "";
  let newSteps: SessionPlanStep[] = [
    { type: "work", durationMinutes: 25 },
    { type: "shortBreak", durationMinutes: 5 },
  ];

  function addStep() {
    const lastStep = newSteps[newSteps.length - 1];
    // Alternate: if last was work add break, otherwise add work
    const nextType: SessionType = lastStep?.type === "work" ? "shortBreak" : "work";
    const nextDuration = nextType === "work" ? 25 : 5;
    newSteps = [...newSteps, { type: nextType, durationMinutes: nextDuration }];
  }

  function removeStep(index: number) {
    newSteps = newSteps.filter((_, i) => i !== index);
  }

  function updateStepType(index: number, type: SessionType) {
    newSteps = newSteps.map((s, i) => i === index ? { ...s, type } : s);
  }

  function updateStepDuration(index: number, minutes: number) {
    newSteps = newSteps.map((s, i) => i === index ? { ...s, durationMinutes: minutes } : s);
  }

  function savePlan() {
    if (!newPlanName.trim() || newSteps.length === 0) return;
    sessionPlans.add({ name: newPlanName.trim(), steps: [...newSteps] });
    newPlanName = "";
    newSteps = [
      { type: "work", durationMinutes: 25 },
      { type: "shortBreak", durationMinutes: 5 },
    ];
    showCreateForm = false;
  }

  function deletePlan(id: string) {
    if ($activePlan?.planId === id) {
      stopPlan();
    }
    sessionPlans.remove(id);
  }

  function handleStartPlan(plan: SessionPlan) {
    if ($timer.state !== "idle") return;
    startPlan(plan);
  }

  function handleStopPlan() {
    stopPlan();
    timer.reset();
  }

  $: totalMinutes = (steps: SessionPlanStep[]) =>
    steps.reduce((sum, s) => sum + s.durationMinutes, 0);
</script>

<div class="planner-view" in:fly={{ y: 14, duration: 220, delay: 80 }}>
  <!-- Header -->
  <header class="header sticky-header">
    <div class="header-left">
      <button class="icon-btn back-btn" on:click={onBack} title="Zurück">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
      </button>
      <h1 class="title">Session Planer</h1>
    </div>
    {#if !showCreateForm}
      <button class="btn-primary" on:click={() => (showCreateForm = true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Neuer Plan
      </button>
    {/if}
  </header>

  <!-- Active Plan Indicator -->
  {#if $activePlan}
    <div class="active-plan-card">
      <div class="active-plan-header">
        <span class="active-plan-badge">Aktiver Plan</span>
        <button class="btn-secondary btn-sm" on:click={handleStopPlan}>Abbrechen</button>
      </div>
      <span class="active-plan-name">{$activePlan.planName}</span>
      <div class="active-plan-steps">
        {#each $activePlan.steps as step, i}
          <span
            class="mini-step"
            class:mini-step-done={i < $activePlan.currentStepIndex}
            class:mini-step-active={i === $activePlan.currentStepIndex}
            style:--step-color={typeColors[step.type]}
          >
            {step.durationMinutes}m
          </span>
          {#if i < $activePlan.steps.length - 1}
            <span class="mini-arrow">→</span>
          {/if}
        {/each}
      </div>
      <span class="active-plan-progress">
        Schritt {$activePlan.currentStepIndex + 1} von {$activePlan.steps.length}
      </span>
    </div>
  {/if}

  <!-- Create Form -->
  {#if showCreateForm}
    <div class="create-form" in:fly={{ y: 10, duration: 180 }}>
      <div class="form-card">
        <input
          type="text"
          bind:value={newPlanName}
          placeholder="Name des Plans..."
          class="plan-name-input"
        />

        <div class="steps-list">
          {#each newSteps as step, i}
            <div class="step-row">
              <span class="step-number">{i + 1}</span>
              <select
                value={step.type}
                on:change={(e) => updateStepType(i, e.currentTarget.value as SessionType)}
                class="step-type-select"
              >
                <option value="work">Fokus</option>
                <option value="shortBreak">Kurze Pause</option>
                <option value="longBreak">Lange Pause</option>
              </select>
              <div class="step-duration">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={step.durationMinutes}
                  on:change={(e) => updateStepDuration(i, parseInt(e.currentTarget.value) || 5)}
                  class="number-input"
                />
                <span class="unit">Min.</span>
              </div>
              {#if newSteps.length > 1}
                <button class="icon-btn danger" on:click={() => removeStep(i)} title="Entfernen">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              {/if}
            </div>
          {/each}
        </div>

        <button class="btn-add-step" on:click={addStep}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Schritt hinzufügen
        </button>

        <div class="form-summary">
          Gesamt: {totalMinutes(newSteps)} Minuten ({newSteps.length} Schritte)
        </div>

        <div class="form-actions">
          <button class="btn-secondary" on:click={() => (showCreateForm = false)}>Abbrechen</button>
          <button class="btn-primary" on:click={savePlan} disabled={!newPlanName.trim() || newSteps.length === 0}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Saved Plans -->
  {#if $sessionPlans.length > 0}
    <div class="section">
      <span class="label">Gespeicherte Pläne</span>
      <div class="plans-list">
        {#each $sessionPlans as plan}
          <div class="plan-card" class:plan-card-active={$activePlan?.planId === plan.id}>
            <div class="plan-header">
              <span class="plan-name">{plan.name}</span>
              <span class="plan-meta">{totalMinutes(plan.steps)} Min. &middot; {plan.steps.length} Schritte</span>
            </div>
            <div class="plan-steps-preview">
              {#each plan.steps as step, i}
                <span class="preview-step" style:--step-color={typeColors[step.type]}>
                  {typeLabels[step.type].substring(0, 1)}{step.durationMinutes}
                </span>
                {#if i < plan.steps.length - 1}
                  <span class="preview-arrow">→</span>
                {/if}
              {/each}
            </div>
            <div class="plan-actions">
              {#if $activePlan?.planId === plan.id}
                <button class="btn-secondary btn-sm" on:click={handleStopPlan}>Stopp</button>
              {:else}
                <button
                  class="btn-primary btn-sm"
                  on:click={() => handleStartPlan(plan)}
                  disabled={$timer.state !== "idle"}
                  title={$timer.state !== "idle" ? "Timer muss gestoppt sein" : "Plan starten"}
                >
                  Starten
                </button>
              {/if}
              <button class="icon-btn danger" on:click={() => deletePlan(plan.id)} title="Löschen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if !showCreateForm}
    <div class="empty-state">
      <p>Noch keine Pläne erstellt.</p>
      <p class="empty-hint">Erstelle einen Session-Plan um deine Arbeitsblöcke und Pausen individuell zu planen.</p>
    </div>
  {/if}
</div>

<style>
  .planner-view {
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

  /* Active Plan */
  .active-plan-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    background: var(--accent-bg);
    border: 1.5px solid var(--accent-border);
    border-radius: var(--radius-lg);
    margin-bottom: 24px;
  }

  .active-plan-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .active-plan-badge {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
  }

  .active-plan-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }

  .active-plan-steps {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .mini-step {
    display: inline-flex;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 10px;
    background: var(--bg-card);
    color: var(--text-muted);
    border: 1.5px solid var(--border);
  }

  .mini-step-done {
    background: var(--step-color);
    color: #fff;
    border-color: transparent;
    opacity: 0.5;
  }

  .mini-step-active {
    background: var(--step-color);
    color: #fff;
    border-color: transparent;
  }

  .mini-arrow {
    font-size: 10px;
    color: var(--text-muted);
  }

  .active-plan-progress {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Create Form */
  .create-form {
    margin-bottom: 24px;
  }

  .form-card {
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .plan-name-input {
    font-size: 15px !important;
    font-weight: 600;
  }

  .steps-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .step-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--bg);
    border-radius: var(--radius);
  }

  .step-number {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  .step-type-select {
    flex: 1;
    font-size: 13px !important;
    padding: 6px 8px !important;
    min-width: 0;
  }

  .step-duration {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .step-duration .number-input {
    width: 56px !important;
    text-align: center;
    padding: 6px 6px !important;
    font-size: 13px !important;
  }

  .unit {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .btn-add-step {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    background: var(--bg);
    border: 1.5px dashed var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-add-step:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-bg);
  }

  .form-summary {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
    text-align: center;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  /* Saved Plans */
  .section {
    margin-bottom: 24px;
  }

  .plans-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .plan-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    transition: all var(--transition);
  }

  .plan-card-active {
    border-color: var(--accent-border);
    background: var(--accent-bg);
  }

  .plan-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .plan-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .plan-meta {
    font-size: 12px;
    color: var(--text-muted);
  }

  .plan-steps-preview {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .preview-step {
    display: inline-flex;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 10px;
    background: var(--step-color);
    color: #fff;
    opacity: 0.85;
  }

  .preview-arrow {
    font-size: 10px;
    color: var(--text-muted);
  }

  .plan-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-sm {
    padding: 6px 14px;
    font-size: 12px;
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
  }

  .empty-state p {
    font-size: 14px;
    font-weight: 500;
  }

  .empty-hint {
    font-size: 13px !important;
    margin-top: 8px;
    opacity: 0.7;
  }
</style>
