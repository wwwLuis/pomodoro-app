<script lang="ts">
  import { fly, fade, scale } from "svelte/transition";
  import { tasks, timer } from "./store";
  import type { Task } from "./types";

  export let onBack: () => void;

  let showAddForm = false;
  let newTaskName = "";
  let newTaskTarget = 4;
  let editingId: string | null = null;
  let editName = "";
  let editTarget = 4;

  $: activeTasks = $tasks.filter((t) => !t.completed);
  $: completedTasks = $tasks.filter((t) => t.completed);

  function addTask() {
    if (!newTaskName.trim()) return;
    tasks.add(newTaskName.trim(), newTaskTarget);
    newTaskName = "";
    newTaskTarget = 4;
    showAddForm = false;
  }

  function startEdit(task: Task) {
    editingId = task.id;
    editName = task.name;
    editTarget = task.targetPomodoros;
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    tasks.updateTask(editingId, { name: editName.trim(), targetPomodoros: editTarget });
    editingId = null;
  }

  function selectTask(id: string) {
    timer.setActiveTask(id);
    onBack();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      if (editingId) saveEdit();
      else if (showAddForm) addTask();
    }
    if (e.key === "Escape") {
      editingId = null;
      showAddForm = false;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="task-view" in:fly={{ y: 14, duration: 220, delay: 80 }}>
  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <button class="icon-btn back-btn" on:click={onBack} title="Zurück">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
      </button>
      <h1 class="title">Tasks</h1>
    </div>
    <button class="btn-primary" on:click={() => { showAddForm = !showAddForm; }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Neu
    </button>
  </header>

  <!-- Add Form -->
  {#if showAddForm}
    <div class="add-form" transition:fly={{ y: -8, duration: 150 }}>
      <input
        type="text"
        placeholder="Task-Name..."
        bind:value={newTaskName}
        autofocus
      />
      <div class="form-row">
        <label class="label">Ziel-Pomodoros</label>
        <input
          type="number"
          min="1"
          max="99"
          bind:value={newTaskTarget}
          class="number-input"
        />
      </div>
      <div class="form-actions">
        <button class="btn-secondary" on:click={() => { showAddForm = false; }}>Abbrechen</button>
        <button class="btn-primary" on:click={addTask} disabled={!newTaskName.trim()}>Hinzufügen</button>
      </div>
    </div>
  {/if}

  <!-- Active Tasks -->
  {#if activeTasks.length === 0 && completedTasks.length === 0}
    <div class="empty" in:fade={{ duration: 150 }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
      <p>Noch keine Tasks</p>
      <span class="empty-hint">Erstelle einen Task, um deine Pomodoros zu tracken</span>
    </div>
  {:else}
    <div class="task-list">
      {#each activeTasks as task (task.id)}
        <div
          class="task-card"
          class:selected={$timer.activeTaskId === task.id}
          transition:fly={{ y: 8, duration: 150 }}
        >
          {#if editingId === task.id}
            <div class="edit-form">
              <input type="text" bind:value={editName} autofocus />
              <div class="form-row">
                <label class="label">Ziel</label>
                <input type="number" min="1" max="99" bind:value={editTarget} class="number-input" />
              </div>
              <div class="form-actions">
                <button class="btn-secondary" on:click={() => { editingId = null; }}>Abbrechen</button>
                <button class="btn-primary" on:click={saveEdit}>Speichern</button>
              </div>
            </div>
          {:else}
            <button class="task-body" on:click={() => selectTask(task.id)}>
              <div class="task-main">
                <span class="task-name">{task.name}</span>
                <div class="task-meta">
                  <span class="pomodoro-count">{task.completedPomodoros}/{task.targetPomodoros}</span>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      style:width="{Math.min(100, (task.completedPomodoros / task.targetPomodoros) * 100)}%"
                    ></div>
                  </div>
                </div>
              </div>
              {#if $timer.activeTaskId === task.id}
                <span class="tag cat">Aktiv</span>
              {/if}
            </button>
            <div class="task-actions">
              <button class="icon-btn" on:click={() => startEdit(task)} title="Bearbeiten">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="icon-btn" on:click={() => tasks.toggleComplete(task.id)} title="Abschließen">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
              <button class="icon-btn danger" on:click={() => tasks.remove(task.id)} title="Löschen">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          {/if}
        </div>
      {/each}

      <!-- Completed Tasks -->
      {#if completedTasks.length > 0}
        <div class="section-divider">
          <span class="label">Abgeschlossen</span>
        </div>
        {#each completedTasks as task (task.id)}
          <div class="task-card completed" transition:fly={{ y: 8, duration: 150 }}>
            <div class="task-body">
              <div class="task-main">
                <span class="task-name">{task.name}</span>
                <span class="pomodoro-count">{task.completedPomodoros} Pomodoros</span>
              </div>
            </div>
            <div class="task-actions">
              <button class="icon-btn" on:click={() => tasks.toggleComplete(task.id)} title="Wiederherstellen">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
              </button>
              <button class="icon-btn danger" on:click={() => tasks.remove(task.id)} title="Löschen">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .task-view {
    width: 100%;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
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

  /* Add Form */
  .add-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    margin-bottom: 20px;
  }

  .form-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .number-input {
    width: 80px !important;
    text-align: center;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  /* Task List */
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    transition: all var(--transition);
  }

  .task-card:hover {
    border-color: var(--border);
    box-shadow: var(--shadow-sm);
  }

  .task-card.selected {
    border-color: var(--accent-border);
    background: var(--accent-bg);
  }

  .task-card.completed {
    opacity: 0.6;
  }

  .task-card.completed .task-name {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .task-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }

  .task-main {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .task-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }

  .task-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pomodoro-count {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
    white-space: nowrap;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: var(--border-light);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width var(--transition);
  }

  .task-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity var(--transition);
  }

  .task-card:hover .task-actions {
    opacity: 1;
  }

  .edit-form {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-divider {
    margin-top: 16px;
    margin-bottom: 4px;
  }

  /* Empty */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 0;
    color: var(--text-muted);
  }

  .empty p {
    font-size: 15px;
    font-weight: 600;
  }

  .empty-hint {
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
