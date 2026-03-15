import type {
  MediaSource,
  RouteId,
  SoundCue,
  StoryScene,
  SubtitleTrack,
} from '../story/types'

export type EffectName = 'choice' | 'save' | 'load' | 'unlock' | 'error'

const routeNames = {
  xiaoqian: '聂小倩',
  feili: '燕绯璃',
  wange: '苏晚歌',
  jianyue: '沈见月',
}

function inferType(src: string) {
  let pathname = src

  try {
    pathname = new URL(src, 'https://preview.local').pathname
  } catch {
    pathname = src
  }

  const normalized = pathname.toLowerCase()

  if (normalized.endsWith('.mp4')) {
    return 'video/mp4'
  }

  if (normalized.endsWith('.webm')) {
    return 'video/webm'
  }

  if (normalized.endsWith('.mp3')) {
    return 'audio/mpeg'
  }

  if (normalized.endsWith('.ogg')) {
    return 'audio/ogg'
  }

  if (normalized.endsWith('.wav')) {
    return 'audio/wav'
  }

  return undefined
}

export function mediaSource(src: string): MediaSource {
  return {
    src,
    type: inferType(src),
  }
}

export function inferSubtitleTracks(sources: MediaSource[]): SubtitleTrack[] {
  const primary = sources.find((source) => source.src.match(/\.(mp4|webm)$/i))

  if (!primary) {
    return []
  }

  const stem = primary.src.replace(/\.(mp4|webm)$/i, '')

  return [
    {
      src: `${stem}.zh-CN.vtt`,
      label: '简体中文',
      srclang: 'zh-CN',
      default: true,
    },
  ]
}

function audioCue(title: string, stem: string, loop = true): SoundCue {
  return {
    title,
    loop,
    sources: [mediaSource(`${stem}.mp3`), mediaSource(`${stem}.ogg`)],
  }
}

export const soundEffects: Record<EffectName, SoundCue> = {
  choice: audioCue('选项确认', '/media/audio/sfx/choice-confirm', false),
  save: audioCue('写入签匣', '/media/audio/sfx/save-scroll', false),
  load: audioCue('载入签匣', '/media/audio/sfx/load-scroll', false),
  unlock: audioCue('解锁片尾', '/media/audio/sfx/unlock-relic', false),
  error: audioCue('交互提醒', '/media/audio/sfx/soft-error', false),
}

function routeTheme(route: Exclude<RouteId, 'common' | 'hidden'>) {
  return audioCue(
    `${routeNames[route]}·线路主题`,
    `/media/audio/bgm/${route}-theme`,
  )
}

function routeEndingTheme(
  route: Exclude<RouteId, 'common' | 'hidden'>,
  tone: 'radiant' | 'fracture' | 'secret',
) {
  return audioCue(
    `${routeNames[route]}·${tone === 'radiant' ? '明亮片尾' : '破碎片尾'}`,
    `/media/audio/bgm/${route}-${tone}`,
  )
}

export function getSceneSoundtrack(scene: StoryScene): SoundCue | null {
  if (scene.route === 'common') {
    return audioCue('兰若序曲', '/media/audio/bgm/common-prologue')
  }

  if (scene.route === 'hidden') {
    if (scene.isEnding && scene.ending) {
      return audioCue(
        scene.ending.tone === 'secret' ? '众名归岸' : '空白片尾',
        `/media/audio/bgm/hidden-${scene.ending.tone === 'secret' ? 'secret' : 'fracture'}`,
      )
    }

    return audioCue('回梦片单', '/media/audio/bgm/hidden-theme')
  }

  if (scene.isEnding && scene.ending) {
    return routeEndingTheme(scene.route, scene.ending.tone)
  }

  return routeTheme(scene.route)
}

export function pickPlayableSource(
  sources: MediaSource[],
  mediaElement?: HTMLAudioElement | HTMLVideoElement | null,
) {
  if (sources.length === 0) {
    return null
  }

  const probe =
    mediaElement ??
    (typeof document !== 'undefined' ? document.createElement('audio') : null)

  if (!probe) {
    return sources[0]
  }

  return (
    sources.find((source) =>
      source.type ? probe.canPlayType(source.type).replace('no', '') : true,
    ) ?? sources[0]
  )
}
