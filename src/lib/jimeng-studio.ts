import type { StoryScene } from '../story/types'

export type JimengAspectRatio = '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9'
export type JimengJobPhase =
  | 'draft'
  | 'submitted'
  | 'in_queue'
  | 'generating'
  | 'done'
  | 'not_found'
  | 'expired'
  | 'error'

export type JimengJobRecord = {
  aspectRatio: JimengAspectRatio
  code: number | null
  createdAt: string
  frames: 121 | 241
  id: string
  imageUrl: string
  message: string
  prompt: string
  reqJsonText: string
  requestId: string | null
  sceneId: string
  sceneTitle: string
  seed: number
  status: JimengJobPhase
  taskId: string | null
  updatedAt: string
  videoUrl: string | null
}

export const aspectRatioOptions: JimengAspectRatio[] = [
  '16:9',
  '4:3',
  '1:1',
  '3:4',
  '9:16',
  '21:9',
]

export const frameOptions = [
  { frames: 121 as const, label: '5 秒 / 121 帧' },
  { frames: 241 as const, label: '10 秒 / 241 帧' },
]

const STORAGE_KEY = 'qiannv-requiem/jimeng-jobs'

export function buildScenePrompt(scene: StoryScene) {
  const paragraphs = scene.summary.join(' ')

  return [
    '请生成一段适合互动影游竖屏剪辑的高质感中文剧情视频。',
    `镜头标题：${scene.title}。`,
    `副标题：${scene.subtitle}。`,
    `场景地点：${scene.location}，时间：${scene.time}。`,
    `情绪氛围：${scene.mood}。`,
    `核心舞台意象：${scene.stage.label}、${scene.stage.motif}。`,
    `剧情描述：${paragraphs}`,
    '画面要求：电影感运镜、人物动作自然、光影细腻、服装与美术统一、适合后续叠加字幕与 BGM。',
  ].join('\n')
}

export function loadJimengJobs() {
  if (typeof window === 'undefined') {
    return [] as JimengJobRecord[]
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return []
    }

    const jobs = JSON.parse(raw)

    if (!Array.isArray(jobs)) {
      return []
    }

    return jobs.filter((job): job is JimengJobRecord => {
      return Boolean(job && typeof job === 'object' && typeof job.id === 'string')
    })
  } catch {
    return []
  }
}

export function persistJimengJobs(jobs: JimengJobRecord[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, 12)))
}

export function jobStatusLabel(job: Pick<JimengJobRecord, 'status' | 'videoUrl' | 'code'>) {
  switch (job.status) {
    case 'submitted':
      return '已提交'
    case 'in_queue':
      return '排队中'
    case 'generating':
      return '生成中'
    case 'done':
      return job.videoUrl ? '已完成' : '已结束'
    case 'not_found':
      return '未找到'
    case 'expired':
      return '已过期'
    case 'error':
      return '请求失败'
    default:
      return '草稿'
  }
}

export function jobTone(job: Pick<JimengJobRecord, 'status' | 'videoUrl' | 'code'>) {
  if (job.status === 'done' && job.videoUrl) {
    return 'is-success'
  }

  if (job.status === 'error' || job.status === 'not_found' || job.status === 'expired') {
    return 'is-danger'
  }

  if (job.status === 'submitted' || job.status === 'in_queue' || job.status === 'generating') {
    return 'is-progress'
  }

  if (job.status === 'done' && job.code !== 10000) {
    return 'is-danger'
  }

  return 'is-idle'
}
