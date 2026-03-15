import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Settings, StoryScene } from '../story/types'

type StageFrameProps = {
  scene: StoryScene
  settings: Settings
}

export function StageFrame({ scene, settings }: StageFrameProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(scene.stage.media.length === 0)
  const [manualPlayback, setManualPlayback] = useState<boolean | null>(null)
  const [captionText, setCaptionText] = useState('')
  const shouldPlay = manualPlayback ?? settings.autoplay

  useEffect(() => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.volume = settings.volume
  }, [settings.volume])

  useEffect(() => {
    const video = videoRef.current

    if (!video || !ready) {
      return
    }

    const textTrack = video.textTracks[0]

    if (!textTrack) {
      return
    }

    textTrack.mode = settings.subtitles ? 'hidden' : 'disabled'

    const syncCaption = () => {
      if (!settings.subtitles) {
        setCaptionText('')
        return
      }

      const cues = textTrack.activeCues

      if (!cues || cues.length === 0) {
        setCaptionText('')
        return
      }

      const lines = Array.from(cues)
        .map((cue) => ('text' in cue ? String(cue.text).trim() : ''))
        .filter(Boolean)

      setCaptionText(lines.join('\n'))
    }

    textTrack.addEventListener('cuechange', syncCaption)
    const frameId = window.requestAnimationFrame(syncCaption)

    return () => {
      window.cancelAnimationFrame(frameId)
      textTrack.removeEventListener('cuechange', syncCaption)
    }
  }, [ready, scene.id, settings.subtitles])

  useEffect(() => {
    if (!videoRef.current || !ready || failed) {
      return
    }

    if (shouldPlay) {
      void videoRef.current.play().catch(() => {
        setManualPlayback(false)
      })
      return
    }

    videoRef.current.pause()
  }, [ready, failed, shouldPlay])

  return (
    <section
      className="stage-frame"
      style={
        {
          '--stage-palette': scene.stage.palette,
          '--stage-glow': scene.stage.glow,
          '--stage-haze': scene.stage.haze,
        } as CSSProperties
      }
    >
      <div className={`stage-canvas${settings.reduceMotion ? ' is-reduced' : ''}`}>
        {scene.stage.media.length > 0 ? (
          <video
            ref={videoRef}
            className={`stage-video${ready && !failed ? ' is-visible' : ''}`}
            preload="auto"
            loop
            playsInline
          autoPlay={settings.autoplay}
          muted={false}
          onLoadedData={() => setReady(true)}
          onError={() => setFailed(true)}
        >
          {scene.stage.media.map((source) => (
            <source key={source.src} src={source.src} type={source.type} />
          ))}
          {scene.stage.subtitles.map((track) => (
            <track
              key={track.src}
              default={track.default}
              kind="subtitles"
              label={track.label}
              src={track.src}
              srcLang={track.srclang}
            />
          ))}
        </video>
      ) : null}

        <div className={`stage-fallback${failed ? ' is-visible' : ''}`}>
          <div className="stage-aura" />
          <div className="stage-ring" />
          <div className="stage-curtain stage-curtain-left" />
          <div className="stage-curtain stage-curtain-right" />
          <div className="stage-motif">{scene.stage.motif}</div>
          <div className="stage-quote">{scene.stage.quote}</div>
        </div>
      </div>

      <div className="stage-hud">
        <div className="stage-pill-row">
          <span>{scene.act}</span>
          <span>{scene.location}</span>
          <span>{scene.time}</span>
        </div>
        <div className="stage-footer-row">
          <div>
            <p className="stage-label">{scene.stage.label}</p>
            <strong>{scene.title}</strong>
          </div>
          <div className="stage-controls">
            {ready && !failed ? (
              <button
                type="button"
                className="hud-button"
                onClick={() =>
                  setManualPlayback((current) => !(current ?? settings.autoplay))
                }
              >
                {shouldPlay ? '静映' : '播放'}
              </button>
            ) : (
              <span className="media-note">等待正式视频素材</span>
            )}
          </div>
        </div>
      </div>

      {settings.subtitles ? (
        <div className={`stage-captions${captionText ? ' is-visible' : ''}`}>
          <p>{captionText}</p>
        </div>
      ) : null}
    </section>
  )
}
