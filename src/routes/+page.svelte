<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import Timer from "$lib/Timer.svelte";
  import TaskList from "$lib/TaskList.svelte";
  import Statistics from "$lib/Statistics.svelte";
  import ExtendedStatistics from "$lib/ExtendedStatistics.svelte";
  import Settings from "$lib/Settings.svelte";
  import SessionPlanner from "$lib/SessionPlanner.svelte";
  import YouTubePlayer from "$lib/YouTubePlayer.svelte";
  import { settings } from "$lib/store";

  type View = "timer" | "tasks" | "stats" | "extendedStats" | "settings" | "planner";
  let view: View = "timer";
</script>

<!-- YouTube Player lives outside the view switch so it persists -->
{#if $settings.musicEnabled}
  <YouTubePlayer />
{/if}

{#key view}
  <div in:fly={{ y: 14, duration: 220, delay: 80 }} out:fade={{ duration: 80 }}>
    {#if view === "timer"}
      <Timer
        onGoTasks={() => (view = "tasks")}
        onGoSettings={() => (view = "settings")}
        onGoStats={() => (view = "stats")}
        onGoPlanner={() => (view = "planner")}
      />
    {:else if view === "tasks"}
      <TaskList onBack={() => (view = "timer")} />
    {:else if view === "stats"}
      <Statistics onBack={() => (view = "timer")} onGoExtended={() => (view = "extendedStats")} />
    {:else if view === "extendedStats"}
      <ExtendedStatistics onBack={() => (view = "stats")} />
    {:else if view === "settings"}
      <Settings onBack={() => (view = "timer")} />
    {:else if view === "planner"}
      <SessionPlanner onBack={() => (view = "timer")} />
    {/if}
  </div>
{/key}
