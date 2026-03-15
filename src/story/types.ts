export type HeroineId = 'xiaoqian' | 'feili' | 'wange' | 'jianyue'

export type RouteId = HeroineId | 'common' | 'hidden'

export type StatId = 'courage' | 'wit' | 'mercy' | 'spirit'

export type EndingTone = 'radiant' | 'fracture' | 'secret'

export type MediaSource = {
  src: string
  type?: string
}

export type SubtitleTrack = {
  src: string
  label: string
  srclang: string
  default?: boolean
}

export type SoundCue = {
  title: string
  loop?: boolean
  sources: MediaSource[]
}

export type StagePreset = {
  label: string
  motif: string
  quote: string
  palette: string
  glow: string
  haze: string
  media: MediaSource[]
  subtitles: SubtitleTrack[]
}

export type ChoiceLock = {
  stats?: Partial<Record<StatId, number>>
  bonds?: Partial<Record<HeroineId, number>>
  radiantEndings?: number
  reason: string
}

export type StoryChoice = {
  id: string
  label: string
  caption: string
  to: string
  statShift?: Partial<Record<StatId, number>>
  bondShift?: Partial<Record<HeroineId, number>>
  lock?: ChoiceLock
}

export type EndingReward = {
  id: string
  name: string
  tone: EndingTone
  relic: string
  summary: string
}

export type StoryScene = {
  id: string
  route: RouteId
  act: string
  title: string
  subtitle: string
  speaker: string
  location: string
  time: string
  mood: string
  summary: string[]
  choices: StoryChoice[]
  stage: StagePreset
  isEnding: boolean
  ending?: EndingReward
}

export type Stats = Record<StatId, number>

export type Bonds = Record<HeroineId, number>

export type GameSnapshot = {
  sceneId: string
  stats: Stats
  bonds: Bonds
  history: string[]
  startedAt: string
  updatedAt: string
}

export type SaveSlot = {
  id: 1 | 2 | 3
  title: string
  sceneTitle: string
  snapshot: GameSnapshot | null
}

export type Settings = {
  volume: number
  musicVolume: number
  sfxVolume: number
  autoplay: boolean
  subtitles: boolean
  reduceMotion: boolean
  textScale: number
}

export type Profile = {
  unlockedEndingIds: string[]
  unlockedRelics: string[]
  totalRuns: number
  lastPlayedAt?: string
}

export type PersistedState = {
  active: GameSnapshot | null
  saves: SaveSlot[]
  settings: Settings
  profile: Profile
}
