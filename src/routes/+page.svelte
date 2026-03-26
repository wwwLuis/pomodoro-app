<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import Timer from "$lib/Timer.svelte";
  import TaskList from "$lib/TaskList.svelte";
  import Statistics from "$lib/Statistics.svelte";
  import Settings from "$lib/Settings.svelte";

  type View = "timer" | "tasks" | "stats" | "settings";
  let view: View = "timer";
</script>

{#key view}
  <div in:fly={{ y: 14, duration: 220, delay: 80 }} out:fade={{ duration: 80 }}>
    {#if view === "timer"}
      <Timer
        onGoTasks={() => (view = "tasks")}
        onGoSettings={() => (view = "settings")}
        onGoStats={() => (view = "stats")}
      />
    {:else if view === "tasks"}
      <TaskList onBack={() => (view = "timer")} />
    {:else if view === "stats"}
      <Statistics onBack={() => (view = "timer")} />
    {:else if view === "settings"}
      <Settings onBack={() => (view = "timer")} />
    {/if}
  </div>
{/key}
