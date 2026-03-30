<script lang="ts">
  import { googleAuth, isLoggedIn, settings, extractPlaylistId } from "./store";

  let playlists: { id: string; title: string; thumbnail: string; itemCount: number }[] = [];
  let loading = false;
  let error = "";
  let urlInput = $settings.musicPlaylistUrl;
  let hasAttemptedLoad = false;

  // Auto-load playlists once when logged in (not on every re-render)
  $: if ($isLoggedIn && !hasAttemptedLoad && !loading) {
    loadPlaylists();
  }

  // Reset when logged out
  $: if (!$isLoggedIn) {
    hasAttemptedLoad = false;
    playlists = [];
  }

  async function loadPlaylists() {
    loading = true;
    hasAttemptedLoad = true;
    error = "";
    try {
      playlists = await googleAuth.fetchPlaylists();
    } catch (e: any) {
      error = e?.message || "Playlists konnten nicht geladen werden.";
      console.error("Playlist load error:", e);
    }
    loading = false;
  }

  async function handleLogin() {
    loading = true;
    error = "";
    try {
      await googleAuth.login();
      hasAttemptedLoad = true;
      playlists = await googleAuth.fetchPlaylists();
    } catch (e: any) {
      error = e?.message || "Anmeldung fehlgeschlagen.";
    }
    loading = false;
  }

  function handleLogout() {
    googleAuth.logout();
    playlists = [];
    hasAttemptedLoad = false;
  }

  function selectPlaylist(id: string, title: string) {
    settings.update({
      musicPlaylistId: id,
      musicPlaylistName: title,
      musicPlaylistUrl: "",
    });
  }

  function handleUrlSubmit() {
    const id = extractPlaylistId(urlInput);
    if (id) {
      settings.update({
        musicPlaylistUrl: urlInput,
        musicPlaylistId: "",
        musicPlaylistName: "",
      });
      error = "";
    } else {
      error = "Ungültige Playlist-URL.";
    }
  }

  function clearSelection() {
    settings.update({
      musicPlaylistId: "",
      musicPlaylistName: "",
      musicPlaylistUrl: "",
    });
    urlInput = "";
  }
</script>

<div class="playlist-picker">
  <!-- Current selection -->
  {#if $settings.musicPlaylistName || $settings.musicPlaylistUrl}
    <div class="current-selection">
      <div class="current-info">
        <span class="current-label">Aktive Playlist</span>
        <span class="current-name">
          {$settings.musicPlaylistName || $settings.musicPlaylistUrl}
        </span>
      </div>
      <button class="btn-clear" on:click={clearSelection} title="Auswahl entfernen">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Google Account -->
  <div class="auth-section">
    {#if $isLoggedIn}
      <div class="auth-status">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span class="auth-name">{$googleAuth?.userName}</span>
        <button class="btn-link" on:click={handleLogout}>Abmelden</button>
      </div>
    {:else}
      <button class="btn-google" on:click={handleLogin} disabled={loading}>
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {loading ? "Wird verbunden..." : "Mit Google anmelden"}
      </button>
    {/if}
  </div>

  <!-- Playlists list -->
  {#if $isLoggedIn}
    {#if loading}
      <div class="loading-state">Playlists werden geladen...</div>
    {:else if playlists.length > 0}
      <div class="playlist-list">
        {#each playlists as pl}
          <button
            class="playlist-item"
            class:selected={$settings.musicPlaylistId === pl.id}
            on:click={() => selectPlaylist(pl.id, pl.title)}
          >
            {#if pl.thumbnail}
              <img src={pl.thumbnail} alt="" class="playlist-thumb" />
            {:else}
              <div class="playlist-thumb placeholder">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
              </div>
            {/if}
            <div class="playlist-info">
              <span class="playlist-title">{pl.title}</span>
              <span class="playlist-count">{pl.itemCount} Videos</span>
            </div>
            {#if $settings.musicPlaylistId === pl.id}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
        {/each}
      </div>
    {:else if error}
      <div class="error-state">
        <span>{error}</span>
        <button class="btn-link" on:click={() => { hasAttemptedLoad = false; }}>Erneut versuchen</button>
      </div>
    {:else}
      <div class="empty-state">Keine Playlists gefunden.
        <button class="btn-link" on:click={() => { hasAttemptedLoad = false; }}>Erneut laden</button>
      </div>
    {/if}
  {/if}

  <!-- URL Fallback -->
  <div class="url-section">
    <span class="url-label">{$isLoggedIn ? "Oder" : ""} Playlist-URL einfügen</span>
    <div class="url-input-row">
      <input
        type="text"
        class="url-input"
        placeholder="https://www.youtube.com/playlist?list=..."
        bind:value={urlInput}
        on:keydown={(e) => e.key === "Enter" && handleUrlSubmit()}
      />
      <button class="btn-secondary btn-sm" on:click={handleUrlSubmit}>OK</button>
    </div>
  </div>

  {#if error}
    <div class="error-msg">{error}</div>
  {/if}
</div>

<style>
  .playlist-picker {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .current-selection {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg-hover);
    border-radius: var(--radius);
    gap: 10px;
  }

  .current-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .current-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .current-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-clear {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius);
  }

  .btn-clear:hover {
    background: var(--border-light);
    color: var(--text);
  }

  .auth-section {
    display: flex;
    align-items: center;
  }

  .auth-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text);
    width: 100%;
  }

  .auth-name {
    font-weight: 500;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius);
    flex-shrink: 0;
  }

  .btn-link:hover {
    color: var(--accent);
    background: var(--bg-hover);
  }

  .btn-google {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    width: 100%;
    justify-content: center;
    transition: all var(--transition);
  }

  .btn-google:hover:not(:disabled) {
    border-color: var(--text-muted);
    background: var(--bg-hover);
  }

  .btn-google:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .playlist-list {
    display: flex;
    flex-direction: column;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--border-light);
    border-radius: var(--radius);
  }

  .playlist-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border-light);
    color: var(--text);
    cursor: pointer;
    text-align: left;
    transition: background var(--transition);
  }

  .playlist-item:last-child {
    border-bottom: none;
  }

  .playlist-item:hover {
    background: var(--bg-hover);
  }

  .playlist-item.selected {
    background: var(--bg-hover);
  }

  .playlist-thumb {
    width: 40px;
    height: 30px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .playlist-thumb.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--border-light);
    color: var(--text-muted);
  }

  .playlist-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .playlist-title {
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .playlist-count {
    font-size: 11px;
    color: var(--text-muted);
  }

  .loading-state,
  .empty-state,
  .error-state {
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
    padding: 16px;
  }

  .error-state {
    color: var(--accent);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .url-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .url-label {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .url-input-row {
    display: flex;
    gap: 8px;
  }

  .url-input {
    flex: 1;
    padding: 8px 12px !important;
    font-size: 13px !important;
    min-width: 0;
  }

  .btn-sm {
    padding: 8px 14px !important;
    font-size: 13px !important;
  }

  .error-msg {
    font-size: 12px;
    color: var(--accent);
    padding: 4px 0;
  }
</style>
