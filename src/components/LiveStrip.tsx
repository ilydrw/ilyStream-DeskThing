import { useAppState } from '../state/AppState'
import { Emoji } from '../lib/emoji'

/**
 * Bottom strip on the GridScreen. Shows whichever live signal is most relevant
 * at the moment, in priority order:
 *   1. A sound that was just triggered (briefly, ~2.5s)
 *   2. TTS speaking indicator
 *   3. Now-playing track from Spotify (with playback controls)
 *   4. Live-stream status badge if SSE isn't connected
 *
 * The now-playing variant exposes inline play/pause/skip/like buttons that
 * dispatch the matching deck-action types — see ilyStream's
 * EventOrchestrator.handleDeckAction.
 */
export function LiveStrip() {
  const { recentSound, tts, nowPlaying, status, goals, recording, runAction } = useAppState()

  const recordingIndicator = recording.isRecording && (
    <div className="strip-recording" title={recording.path}>
      <span className="dot" /> REC
    </div>
  )

  if (recentSound) {
    return (
      <div className="strip strip-recent">
        <div className="strip-glyph"><Emoji text={recentSound.emoji || '🔊'} /></div>
        <div className="strip-text">
          <div className="strip-title">Played</div>
          <div className="strip-sub">{recentSound.name}</div>
        </div>
        {recordingIndicator}
      </div>
    )
  }

  if (tts.isSpeaking) {
    return (
      <div className="strip strip-tts">
        <div className="strip-glyph"><Emoji text={tts.isAI ? '🤖' : '🗣️'} /></div>
        <div className="strip-text">
          <div className="strip-title">{tts.isAI ? 'AI co-host speaking' : 'TTS speaking'}</div>
          <div className="strip-sub">Tap any tile to fire over the top</div>
        </div>
        {recordingIndicator}
      </div>
    )
  }

  if (nowPlaying && (nowPlaying.isPlaying || nowPlaying.trackName)) {
    const title = (nowPlaying.trackName as string) || 'Spotify'
    const artist = (nowPlaying.artistName as string) || ''
    const isPlaying = !!nowPlaying.isPlaying
    return (
      <div className="strip strip-now">
        <div className="strip-glyph"><Emoji text="🎵" /></div>
        <div className="strip-text">
          <div className="strip-title">{title}</div>
          <div className="strip-sub">{artist || 'Now playing'}</div>
        </div>
        <div className="strip-controls" aria-label="Playback controls">
          <button
            className="strip-control"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={() => runAction(isPlaying ? 'PAUSE_TRACK' : 'RESUME_TRACK')}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            className="strip-control"
            aria-label="Skip"
            onClick={() => runAction('SKIP_TRACK')}
          >
            ⏭
          </button>
          <button
            className="strip-control strip-control-like"
            aria-label="Like"
            onClick={() => runAction('LIKE_TRACK')}
          >
            ♥
          </button>
        </div>
        {recordingIndicator}
        {goals && goals.currentViewerCount > 0 && (
          <div className="strip-meta">{goals.currentViewerCount.toLocaleString()} 👀</div>
        )}
      </div>
    )
  }

  if (status.status === 'connected' && status.liveStream === false) {
    return (
      <div className="strip strip-warning">
        <div className="strip-glyph"><Emoji text="⚠️" /></div>
        <div className="strip-text">
          <div className="strip-title">Reconnecting live state…</div>
          <div className="strip-sub">Sounds will still play</div>
        </div>
        {recordingIndicator}
      </div>
    )
  }

  if (goals && goals.currentViewerCount > 0) {
    return (
      <div className="strip strip-now">
        <div className="strip-glyph"><Emoji text="📡" /></div>
        <div className="strip-text">
          <div className="strip-title">Live</div>
          <div className="strip-sub">{goals.currentViewerCount.toLocaleString()} viewers</div>
        </div>
        {recordingIndicator}
      </div>
    )
  }

  if (recording.isRecording) {
    return (
      <div className="strip strip-recording-only">
        <div className="strip-glyph"><Emoji text="🎥" /></div>
        <div className="strip-text">
          <div className="strip-title">Recording</div>
          <div className="strip-sub">Saving to PC</div>
        </div>
        {recordingIndicator}
      </div>
    )
  }

  return null
}
