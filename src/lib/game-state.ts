import {
  heroineShowcase,
  radiantEndingIds,
  routeEntryScene,
  statLabels,
  storyScenes,
} from '../story/content'
import type {
  GameSnapshot,
  PersistedState,
  Profile,
  SaveSlot,
  Settings,
  StoryChoice,
} from '../story/types'

const STORAGE_KEY = 'qiannv-requiem/state'

const defaultSettings: Settings = {
  volume: 0.65,
  autoplay: true,
  reduceMotion: false,
  textScale: 1,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createEmptySaves(): SaveSlot[] {
  return [
    { id: 1, title: '签匣一', sceneTitle: '空白', snapshot: null },
    { id: 2, title: '签匣二', sceneTitle: '空白', snapshot: null },
    { id: 3, title: '签匣三', sceneTitle: '空白', snapshot: null },
  ]
}

function createProfile(): Profile {
  return {
    unlockedEndingIds: [],
    unlockedRelics: [],
    totalRuns: 0,
  }
}

export function createPersistedState(): PersistedState {
  return {
    active: null,
    saves: createEmptySaves(),
    settings: defaultSettings,
    profile: createProfile(),
  }
}

export function createNewSnapshot(sceneId = routeEntryScene.common): GameSnapshot {
  const now = new Date().toISOString()

  return {
    sceneId,
    stats: {
      courage: 1,
      wit: 1,
      mercy: 1,
      spirit: 1,
    },
    bonds: {
      xiaoqian: 0,
      feili: 0,
      wange: 0,
      jianyue: 0,
    },
    history: [sceneId],
    startedAt: now,
    updatedAt: now,
  }
}

export function cloneSnapshot(snapshot: GameSnapshot): GameSnapshot {
  return {
    sceneId: snapshot.sceneId,
    stats: { ...snapshot.stats },
    bonds: { ...snapshot.bonds },
    history: [...snapshot.history],
    startedAt: snapshot.startedAt,
    updatedAt: snapshot.updatedAt,
  }
}

function normalizeSnapshot(candidate: unknown): GameSnapshot | null {
  if (!candidate || typeof candidate !== 'object') {
    return null
  }

  const snapshot = candidate as Partial<GameSnapshot>

  if (typeof snapshot.sceneId !== 'string' || !storyScenes[snapshot.sceneId]) {
    return null
  }

  return {
    sceneId: snapshot.sceneId,
    stats: {
      courage: clamp(Number(snapshot.stats?.courage ?? 1), 0, 4),
      wit: clamp(Number(snapshot.stats?.wit ?? 1), 0, 4),
      mercy: clamp(Number(snapshot.stats?.mercy ?? 1), 0, 4),
      spirit: clamp(Number(snapshot.stats?.spirit ?? 1), 0, 4),
    },
    bonds: {
      xiaoqian: clamp(Number(snapshot.bonds?.xiaoqian ?? 0), 0, 4),
      feili: clamp(Number(snapshot.bonds?.feili ?? 0), 0, 4),
      wange: clamp(Number(snapshot.bonds?.wange ?? 0), 0, 4),
      jianyue: clamp(Number(snapshot.bonds?.jianyue ?? 0), 0, 4),
    },
    history: Array.isArray(snapshot.history)
      ? snapshot.history.filter(
          (item): item is string =>
            typeof item === 'string' && Boolean(storyScenes[item]),
        )
      : [snapshot.sceneId],
    startedAt:
      typeof snapshot.startedAt === 'string'
        ? snapshot.startedAt
        : new Date().toISOString(),
    updatedAt:
      typeof snapshot.updatedAt === 'string'
        ? snapshot.updatedAt
        : new Date().toISOString(),
  }
}

function normalizeSaves(value: unknown): SaveSlot[] {
  const fallback = createEmptySaves()

  if (!Array.isArray(value)) {
    return fallback
  }

  return fallback.map((slot) => {
    const match = value.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        Number((item as SaveSlot).id) === slot.id,
    ) as Partial<SaveSlot> | undefined

    return {
      id: slot.id,
      title:
        typeof match?.title === 'string' && match.title.trim()
          ? match.title
          : slot.title,
      sceneTitle:
        typeof match?.sceneTitle === 'string' && match.sceneTitle.trim()
          ? match.sceneTitle
          : slot.sceneTitle,
      snapshot: normalizeSnapshot(match?.snapshot),
    }
  })
}

export function loadState(): PersistedState {
  if (typeof window === 'undefined') {
    return createPersistedState()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return createPersistedState()
    }

    const parsed = JSON.parse(raw) as Partial<PersistedState>

    return {
      active: normalizeSnapshot(parsed.active),
      saves: normalizeSaves(parsed.saves),
      settings: {
        volume: clamp(Number(parsed.settings?.volume ?? defaultSettings.volume), 0, 1),
        autoplay: Boolean(parsed.settings?.autoplay ?? defaultSettings.autoplay),
        reduceMotion: Boolean(
          parsed.settings?.reduceMotion ?? defaultSettings.reduceMotion,
        ),
        textScale: clamp(
          Number(parsed.settings?.textScale ?? defaultSettings.textScale),
          0.95,
          1.2,
        ),
      },
      profile: {
        unlockedEndingIds: Array.isArray(parsed.profile?.unlockedEndingIds)
          ? [...new Set(parsed.profile.unlockedEndingIds.filter(Boolean))]
          : [],
        unlockedRelics: Array.isArray(parsed.profile?.unlockedRelics)
          ? [...new Set(parsed.profile.unlockedRelics.filter(Boolean))]
          : [],
        totalRuns: Math.max(0, Number(parsed.profile?.totalRuns ?? 0)),
        lastPlayedAt:
          typeof parsed.profile?.lastPlayedAt === 'string'
            ? parsed.profile.lastPlayedAt
            : undefined,
      },
    }
  } catch {
    return createPersistedState()
  }
}

export function persistState(state: PersistedState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function advanceSnapshot(
  snapshot: GameSnapshot,
  choice: StoryChoice,
): GameSnapshot {
  const now = new Date().toISOString()
  const next = cloneSnapshot(snapshot)
  next.sceneId = choice.to
  next.updatedAt = now
  next.history = [...next.history, choice.to]

  for (const [statId, shift] of Object.entries(choice.statShift ?? {})) {
    next.stats[statId as keyof typeof next.stats] = clamp(
      next.stats[statId as keyof typeof next.stats] + Number(shift ?? 0),
      0,
      4,
    )
  }

  for (const [bondId, shift] of Object.entries(choice.bondShift ?? {})) {
    next.bonds[bondId as keyof typeof next.bonds] = clamp(
      next.bonds[bondId as keyof typeof next.bonds] + Number(shift ?? 0),
      0,
      4,
    )
  }

  return next
}

export function saveIntoSlot(
  saves: SaveSlot[],
  slotId: 1 | 2 | 3,
  snapshot: GameSnapshot,
): SaveSlot[] {
  const scene = storyScenes[snapshot.sceneId]

  return saves.map((slot) =>
    slot.id === slotId
      ? {
          id: slot.id,
          title: `签匣 ${slotId}`,
          sceneTitle: `${scene.act} · ${scene.title}`,
          snapshot: { ...cloneSnapshot(snapshot), updatedAt: new Date().toISOString() },
        }
      : slot,
  )
}

export function applyEndingRewards(profile: Profile, sceneId: string): Profile {
  const scene = storyScenes[sceneId]

  if (!scene.ending) {
    return profile
  }

  return {
    ...profile,
    unlockedEndingIds: profile.unlockedEndingIds.includes(scene.ending.id)
      ? profile.unlockedEndingIds
      : [...profile.unlockedEndingIds, scene.ending.id],
    unlockedRelics: profile.unlockedRelics.includes(scene.ending.relic)
      ? profile.unlockedRelics
      : [...profile.unlockedRelics, scene.ending.relic],
  }
}

export function getRadiantEndingCount(profile: Profile) {
  return Object.values(radiantEndingIds).filter((endingId) =>
    profile.unlockedEndingIds.includes(endingId),
  ).length
}

export function isChoiceUnlocked(
  choice: StoryChoice,
  snapshot: GameSnapshot,
  profile: Profile,
) {
  if (!choice.lock) {
    return true
  }

  for (const [statId, threshold] of Object.entries(choice.lock.stats ?? {})) {
    if (snapshot.stats[statId as keyof typeof snapshot.stats] < Number(threshold)) {
      return false
    }
  }

  for (const [bondId, threshold] of Object.entries(choice.lock.bonds ?? {})) {
    if (snapshot.bonds[bondId as keyof typeof snapshot.bonds] < Number(threshold)) {
      return false
    }
  }

  if (
    choice.lock.radiantEndings &&
    getRadiantEndingCount(profile) < choice.lock.radiantEndings
  ) {
    return false
  }

  return true
}

export function describeChoiceLock(
  choice: StoryChoice,
  snapshot: GameSnapshot,
  profile: Profile,
) {
  if (!choice.lock) {
    return '条件已满足。'
  }

  if (isChoiceUnlocked(choice, snapshot, profile)) {
    return '条件已满足。'
  }

  return choice.lock.reason
}

export function buildRequirementLines(choice: StoryChoice) {
  if (!choice.lock) {
    return []
  }

  const lines: string[] = []

  for (const [statId, threshold] of Object.entries(choice.lock.stats ?? {})) {
    lines.push(`${statLabels[statId as keyof typeof statLabels]} ${threshold}`)
  }

  for (const [bondId, threshold] of Object.entries(choice.lock.bonds ?? {})) {
    lines.push(
      `${heroineShowcase[bondId as keyof typeof heroineShowcase].name} 羁绊 ${threshold}`,
    )
  }

  if (choice.lock.radiantEndings) {
    lines.push(`明亮结局 ${choice.lock.radiantEndings}`)
  }

  return lines
}
