<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { settings, musicShouldPlay, musicPlayerState, musicStatusMessage, extractPlaylistId, registerSkipSong, unregisterSkipSong, googleAuth, isLoggedIn } from "./store";
  import { get } from "svelte/store";

  let playerElement: HTMLDivElement;
  let player: any = null;
  let apiReady = false;

  let loadedPlaylistId: string | null = null;
  let requestSeq = 0;
  let pendingPlaylistId: string | null = null;
  let pendingVideoIds: string[] = [];
  let playlistLoadStarted = false;
  let shuffleDone = false;
  let needsUnmute = false;
  let errorCount = 0;
  let totalVideos = 0;
  let hasEverPlayed = false;
  let cuedRetryCount = 0;
  let loadRetryCount = 0;
  let loadingTimeout: ReturnType<typeof setTimeout> | null = null;

  const ERROR_NAMES: Record<number, string> = {
    2: "Ungültiger Parameter",
    5: "HTML5-Player Fehler",
    100: "Video nicht gefunden",
    101: "Einbettung nicht erlaubt",
    150: "Einbettung nicht erlaubt",
  };

  function setStatus(msg: string) {
    musicStatusMessage.set(msg);
  }

  $: effectivePlaylistId =
    $settings.musicPlaylistId || extractPlaylistId($settings.musicPlaylistUrl);
  $: volume = $settings.musicVolume;

  $: if (player && apiReady) {
    syncPlayer($musicShouldPlay, effectivePlaylistId, volume);
  }

  function syncPlayer(shouldPlay: boolean, desiredId: string | null, vol: number) {
    if (!needsUnmute) {
      try {
        if (typeof player.setVolume === "function") {
          player.setVolume(vol);
        }
      } catch {}
    }

    if (!shouldPlay) {
      try {
        const state = player.getPlayerState();
        if (state === 1 || state === 3) {
          player.pauseVideo();
          setStatus("Pausiert");
        }
      } catch {}
      return;
    }

    if (!desiredId) return;

    if (desiredId !== loadedPlaylistId && desiredId !== pendingPlaylistId) {
      doLoadPlaylist(desiredId);
      return;
    }

    // Don't interfere while a load is in progress
    if (pendingPlaylistId) return;

    try {
      const state = player.getPlayerState();
      if (state === 2) {
        player.playVideo();
        setStatus("Fortsetzen...");
      } else if (state === -1 || state === 0 || state === 5) {
        doLoadPlaylist(desiredId);
      } else if (state !== 1 && state !== 3) {
        player.playVideo();
      }
    } catch {}
  }

  function clearLoadingTimeout() {
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
  }

  async function doLoadPlaylist(playlistId: string) {
    const seq = ++requestSeq;
    pendingPlaylistId = playlistId;
    loadedPlaylistId = null;
    shuffleDone = false;
    needsUnmute = true;
    errorCount = 0;
    totalVideos = 0;
    hasEverPlayed = false;
    cuedRetryCount = 0;
    loadRetryCount = 0;
    pendingVideoIds = [];
    playlistLoadStarted = false;
    clearLoadingTimeout();
    musicPlayerState.set("loading");

    // DON'T stop the old playlist yet — keep it playing during the async
    // fetch so the player can't resume it in a weird state. We stop + mute
    // right before loadPlaylist, making the switch atomic.

    if (get(isLoggedIn)) {
      setStatus("Lade Video-IDs...");
      try {
        const videoIds = await googleAuth.fetchPlaylistVideoIds(playlistId);

        // Check if a newer request was made while we were fetching
        if (requestSeq !== seq) return;

        if (videoIds.length > 0) {
          setStatus(`${videoIds.length} Videos gefunden — starte...`);
          totalVideos = videoIds.length;
          pendingVideoIds = videoIds;

          try {
            // Stop old playlist and load new one atomically (no async gap)
            try { player.stopVideo(); } catch {}
            try { player.mute(); } catch {}
            playlistLoadStarted = true;
            const startIndex = Math.floor(Math.random() * videoIds.length);
            player.loadPlaylist(videoIds, startIndex, 0);
          } catch {
            // Fall through to playlist ID approach
            startPlaylistIdLoad(playlistId, seq);
            return;
          }

          // Safety timeout
          loadingTimeout = setTimeout(() => {
            if (requestSeq === seq) {
              handleLoadTimeout(playlistId, seq);
            }
          }, 8000);
          return;
        }
      } catch (e) {
        if (requestSeq !== seq) return;
        // Data API failed — fall through to playlist ID approach
      }
    }

    // Fallback: load via playlist ID (for URL-input / not logged in)
    startPlaylistIdLoad(playlistId, seq);
  }

  function startPlaylistIdLoad(playlistId: string, seq: number) {
    setStatus(`Lade Playlist ${playlistId.substring(0, 12)}...`);
    try {
      try { player.stopVideo(); } catch {}
      try { player.mute(); } catch {}
      playlistLoadStarted = true;
      player.loadPlaylist({
        list: playlistId,
        listType: "playlist",
        index: 0,
        startSeconds: 0,
      });

      loadingTimeout = setTimeout(() => {
        if (requestSeq === seq) {
          handleLoadTimeout(playlistId, seq);
        }
      }, 8000);
    } catch (e) {
      if (requestSeq === seq) {
        doUnmute();
        musicPlayerState.set("error");
        setStatus(`Fehler beim Laden: ${e}`);
        pendingPlaylistId = null;
      }
    }
  }

  function handleLoadTimeout(playlistId: string, seq: number) {
    if (requestSeq !== seq) return;
    try {
      const state = player.getPlayerState();
      if (state === 5) {
        setStatus("Starte Wiedergabe...");
        player.playVideo();
      } else if (state === 1) {
        // Already playing — let onStateChange handle it
      } else {
        setStatus("Neuer Versuch...");
        if (totalVideos > 1) {
          try { player.playVideoAt(1); } catch {}
        } else {
          player.playVideo();
        }
      }
    } catch {}
  }

  function doUnmute() {
    if (!needsUnmute) return;
    needsUnmute = false;
    try {
      player.unMute();
      player.setVolume(volume);
    } catch {}
  }

  function onPlayerStateChange(event: any) {
    const state = event.data;

    // Ignore ALL state changes while we're still fetching video IDs.
    // During this phase the old playlist may fire events — we must not
    // act on them (especially not confirm pendingPlaylistId).
    if (pendingPlaylistId && !playlistLoadStarted) {
      return;
    }

    switch (state) {
      case 1: { // playing
        clearLoadingTimeout();
        errorCount = 0;
        cuedRetryCount = 0;

        // Get playlist info
        if (totalVideos === 0) {
          try {
            const playlist = player.getPlaylist();
            if (playlist) {
              totalVideos = playlist.length;
            }
          } catch {}
        }

        // Verify the playing video actually belongs to the new playlist.
        // When loadPlaylist fails on a broken video, the YT player silently
        // reverts to the old playlist — detect this and retry.
        if (pendingPlaylistId && pendingVideoIds.length > 0) {
          try {
            const videoData = player.getVideoData();
            const currentVideoId = videoData?.video_id;
            if (currentVideoId && !pendingVideoIds.includes(currentVideoId)) {
              // Wrong playlist is playing — stop immediately
              try { player.stopVideo(); } catch {}
              try { player.mute(); } catch {}
              loadRetryCount++;
              if (loadRetryCount <= 3) {
                setStatus(`Playlist-Wechsel fehlgeschlagen — Versuch ${loadRetryCount}...`);
                const newIndex = Math.floor(Math.random() * pendingVideoIds.length);
                player.loadPlaylist(pendingVideoIds, newIndex, 0);
              } else {
                // Video ID method keeps failing — fall back to playlist ID
                setStatus("Fallback auf Playlist-ID...");
                pendingVideoIds = [];
                startPlaylistIdLoad(pendingPlaylistId, requestSeq);
              }
              return;
            }
          } catch {}
        }

        // Confirm the pending playlist as loaded
        if (pendingPlaylistId) {
          loadedPlaylistId = pendingPlaylistId;
          pendingPlaylistId = null;
          pendingVideoIds = [];
        }

        hasEverPlayed = true;

        // Shuffle jump (still muted)
        if (!shuffleDone) {
          shuffleDone = true;
          if (totalVideos > 1) {
            try {
              player.setShuffle(true);
              const randomIndex = Math.floor(Math.random() * totalVideos);
              setStatus(`Shuffle → Video ${randomIndex + 1}/${totalVideos}`);
              player.playVideoAt(randomIndex);
              return;
            } catch {}
          }
          doUnmute();
        } else {
          doUnmute();
        }

        // Get current video title
        try {
          const videoData = player.getVideoData();
          if (videoData && videoData.title) {
            setStatus(`♫ ${videoData.title}`);
          } else {
            setStatus("♫ Spielt...");
          }
        } catch {
          setStatus("♫ Spielt...");
        }

        musicPlayerState.set("playing");

        if (effectivePlaylistId && effectivePlaylistId !== loadedPlaylistId) {
          doLoadPlaylist(effectivePlaylistId);
        }
        break;
      }
      case 2: // paused
        setStatus("Pausiert");
        musicPlayerState.set("paused");
        break;
      case 0: // ended
        setStatus("Playlist beendet");
        musicPlayerState.set("idle");
        break;
      case 3: // buffering
        setStatus("Puffern...");
        musicPlayerState.set("loading");
        break;
      case 5: { // cued
        cuedRetryCount++;

        if (totalVideos === 0) {
          try {
            const playlist = player.getPlaylist();
            if (playlist) totalVideos = playlist.length;
          } catch {}
        }

        const maxCuedRetries = Math.max(totalVideos, 5);

        if (cuedRetryCount === 1) {
          setStatus("Starte Wiedergabe...");
          try { player.playVideo(); } catch {}
        } else if (cuedRetryCount <= maxCuedRetries) {
          setStatus(`Video nicht abspielbar — nächstes... (${cuedRetryCount}/${maxCuedRetries})`);
          try {
            const idx = player.getPlaylistIndex();
            player.playVideoAt((idx + 1) % Math.max(totalVideos, 1));
          } catch { try { player.nextVideo(); } catch {} }
        } else {
          doUnmute();
          pendingPlaylistId = null;
          musicPlayerState.set("error");
          setStatus("✖ Kein Video dieser Playlist kann eingebettet werden.");
        }
        break;
      }
      case -1: // unstarted
        if (!pendingPlaylistId) {
          musicPlayerState.set("idle");
        }
        break;
    }
  }

  function onPlayerError(event: any) {
    // Ignore errors from old playlist during fetch
    if (pendingPlaylistId && !playlistLoadStarted) return;

    errorCount++;
    const code = event?.data;
    const errorName = ERROR_NAMES[code] || `Fehler ${code}`;

    let videoInfo = "";
    try {
      const videoData = player.getVideoData();
      if (videoData && videoData.title) {
        videoInfo = ` — "${videoData.title}"`;
      }
    } catch {}

    if (!hasEverPlayed) {
      if (errorCount <= 5) {
        setStatus(`⚠ ${errorName}${videoInfo} — nächstes... (${errorCount}/5)`);
        try {
          const idx = player.getPlaylistIndex();
          player.playVideoAt((idx + 1) % Math.max(totalVideos, 1));
        } catch { try { player.nextVideo(); } catch {} }
      } else {
        doUnmute();
        pendingPlaylistId = null;
        musicPlayerState.set("error");
        setStatus(`✖ Playlist nicht abspielbar: ${errorName}.`);
      }
      return;
    }

    const maxRetries = Math.max(10, Math.min(totalVideos, 50));
    setStatus(`⚠ ${errorName}${videoInfo} — Überspringe... (${errorCount}/${maxRetries})`);

    if (errorCount < maxRetries) {
      try { player.nextVideo(); } catch {}
    } else {
      doUnmute();
      musicPlayerState.set("error");
      setStatus(`✖ Zu viele Fehler (${errorCount}).`);
    }
  }

  function handleSkipSong() {
    if (!player || !apiReady) return;
    try {
      setStatus("Überspringe...");
      player.nextVideo();
    } catch {}
  }

  function loadYouTubeAPI(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).YT && (window as any).YT.Player) {
        resolve();
        return;
      }

      const existingCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (existingCallback) existingCallback();
        resolve();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    });
  }

  function initPlayer() {
    if (!playerElement) return;

    setStatus("Player wird initialisiert...");

    player = new (window as any).YT.Player(playerElement, {
      height: "200",
      width: "200",
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          apiReady = true;
          try { player.setVolume(volume); } catch {}
          setStatus("Player bereit");
        },
        onStateChange: onPlayerStateChange,
        onError: onPlayerError,
      },
    });
  }

  onMount(async () => {
    registerSkipSong(handleSkipSong);
    setStatus("YouTube API wird geladen...");
    try {
      await loadYouTubeAPI();
      initPlayer();
    } catch {
      musicPlayerState.set("error");
      setStatus("YouTube API konnte nicht geladen werden");
    }
  });

  onDestroy(() => {
    clearLoadingTimeout();
    unregisterSkipSong();
    try {
      if (player && typeof player.destroy === "function") {
        player.destroy();
      }
    } catch {}
    musicPlayerState.set("idle");
  });
</script>

<div class="yt-player-hidden">
  <div bind:this={playerElement}></div>
</div>

<style>
  .yt-player-hidden {
    position: fixed;
    left: -9999px;
    top: -9999px;
    width: 200px;
    height: 200px;
    pointer-events: none;
  }
</style>
