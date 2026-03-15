import { startTransition, useEffect, useEffectEvent, useState } from 'react'
import {
  buildJimengMediaProxyUrl,
  fetchJimengConfig,
  queryJimengTask,
  submitJimengTask,
  type JimengConfig,
  type JimengProxyResponse,
} from '../lib/jimeng-client'
import {
  aspectRatioOptions,
  buildScenePrompt,
  frameOptions,
  jobStatusLabel,
  jobTone,
  loadJimengJobs,
  persistJimengJobs,
  type JimengAspectRatio,
  type JimengJobPhase,
  type JimengJobRecord,
} from '../lib/jimeng-studio'
import type { StoryScene } from '../story/types'

type AiStudioPanelProps = {
  currentSceneId?: string
  onClearPreview: (sceneId: string) => void
  onUsePreview: (job: JimengJobRecord) => void
  previewVideoBySceneId: Record<string, string | undefined>
  scenes: StoryScene[]
}

function nowIso() {
  return new Date().toISOString()
}

function createJobId() {
  const cryptoObject = globalThis.crypto

  if (cryptoObject?.randomUUID) {
    return cryptoObject.randomUUID()
  }

  if (cryptoObject?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoObject.getRandomValues(bytes)
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-')
  }

  return `job-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function resolvePhase(response: JimengProxyResponse): JimengJobPhase {
  if (!response.ok && response.normalized.status === 'done') {
    return 'done'
  }

  switch (response.normalized.status) {
    case 'in_queue':
    case 'generating':
    case 'done':
    case 'not_found':
    case 'expired':
      return response.normalized.status
    default:
      return response.ok ? 'submitted' : 'error'
  }
}

function trimJobs(jobs: JimengJobRecord[]) {
  return jobs.slice(0, 12)
}

export function AiStudioPanel({
  currentSceneId,
  onClearPreview,
  onUsePreview,
  previewVideoBySceneId,
  scenes,
}: AiStudioPanelProps) {
  const [config, setConfig] = useState<JimengConfig | null>(null)
  const [configMessage, setConfigMessage] = useState('读取本地代理配置中...')
  const [selectedSceneId, setSelectedSceneId] = useState(currentSceneId ?? scenes[0]?.id ?? '')
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [aspectRatio, setAspectRatio] = useState<JimengAspectRatio>('16:9')
  const [frames, setFrames] = useState<121 | 241>(121)
  const [seed, setSeed] = useState('-1')
  const [reqJsonText, setReqJsonText] = useState('')
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JimengJobRecord[]>(() => loadJimengJobs())

  const selectedScene =
    scenes.find((candidate) => candidate.id === selectedSceneId) ?? scenes[0] ?? null

  useEffect(() => {
    if (!selectedSceneId && currentSceneId) {
      setSelectedSceneId(currentSceneId)
      return
    }

    if (!selectedSceneId && scenes[0]) {
      setSelectedSceneId(scenes[0].id)
    }
  }, [currentSceneId, scenes, selectedSceneId])

  useEffect(() => {
    if (!prompt && selectedScene) {
      setPrompt(buildScenePrompt(selectedScene))
    }
  }, [prompt, selectedScene])

  useEffect(() => {
    persistJimengJobs(jobs)
  }, [jobs])

  useEffect(() => {
    let cancelled = false

    void fetchJimengConfig()
      .then((nextConfig) => {
        if (cancelled) {
          return
        }

        setConfig(nextConfig)
        setConfigMessage(
          nextConfig.configured
            ? '本地代理可用，提交按钮会走服务端签名请求。'
            : '尚未检测到 AK/SK，请先配置 .env.local。',
        )
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        setConfigMessage(error instanceof Error ? error.message : '无法读取代理配置')
      })

    return () => {
      cancelled = true
    }
  }, [])

  function fillPromptFromScene() {
    if (!selectedScene) {
      return
    }

    setPrompt(buildScenePrompt(selectedScene))
  }

  function updateJobs(transform: (current: JimengJobRecord[]) => JimengJobRecord[]) {
    startTransition(() => {
      setJobs((current) => trimJobs(transform(current)))
    })
  }

  function syncPreview(job: JimengJobRecord) {
    if (job.videoUrl && job.sceneId === currentSceneId) {
      onUsePreview(job)
    }
  }

  function applyResponseToJob(job: JimengJobRecord, response: JimengProxyResponse) {
    return {
      ...job,
      code: response.normalized.code,
      message: response.normalized.message,
      requestId: response.normalized.requestId,
      status: resolvePhase(response),
      taskId: response.normalized.taskId ?? job.taskId,
      updatedAt: nowIso(),
      videoUrl: response.normalized.videoUrl ?? job.videoUrl,
    }
  }

  async function refreshJob(job: JimengJobRecord) {
    if (!job.taskId) {
      return
    }

    setBusyLabel(`刷新任务 ${job.taskId.slice(-8)} 中...`)

    try {
      const response = await queryJimengTask({
        taskId: job.taskId,
        reqJson: job.reqJsonText || undefined,
      })
      const nextJob = applyResponseToJob(job, response)

      updateJobs((current) =>
        current.map((candidate) =>
          candidate.id === job.id ? nextJob : candidate,
        ),
      )
      syncPreview(nextJob)

      const phase = resolvePhase(response)

      if (phase === 'submitted' || phase === 'in_queue' || phase === 'generating') {
        setActiveTaskId(job.taskId)
      } else {
        setActiveTaskId((current) => (current === job.taskId ? null : current))
      }
    } catch (error) {
      updateJobs((current) =>
        current.map((candidate) =>
          candidate.id === job.id
            ? {
                ...candidate,
                message: error instanceof Error ? error.message : '刷新失败',
                status: 'error',
                updatedAt: nowIso(),
              }
            : candidate,
        ),
      )
    } finally {
      setBusyLabel(null)
    }
  }

  const pollActiveJob = useEffectEvent(async () => {
    if (!activeTaskId) {
      return
    }

    const job = jobs.find((candidate) => candidate.taskId === activeTaskId)

    if (!job || !['submitted', 'in_queue', 'generating'].includes(job.status)) {
      return
    }

    await refreshJob(job)
  })

  useEffect(() => {
    if (!activeTaskId) {
      return
    }

    const job = jobs.find((candidate) => candidate.taskId === activeTaskId)

    if (
      !job ||
      !['submitted', 'in_queue', 'generating'].includes(job.status)
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void pollActiveJob()
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [activeTaskId, jobs])

  async function submit() {
    if (!selectedScene) {
      return
    }

    setBusyLabel('提交即梦视频任务中...')

    const draftJob: JimengJobRecord = {
      id: createJobId(),
      sceneId: selectedScene.id,
      sceneTitle: selectedScene.title,
      prompt: prompt.trim(),
      imageUrl: imageUrl.trim(),
      aspectRatio,
      frames,
      seed: Number(seed) || -1,
      reqJsonText: reqJsonText.trim(),
      status: 'draft',
      taskId: null,
      videoUrl: null,
      message: '等待提交',
      code: null,
      requestId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    updateJobs((current) => [draftJob, ...current])

    try {
      const response = await submitJimengTask({
        prompt,
        imageUrl,
        aspectRatio,
        frames,
        seed: Number(seed) || -1,
        reqJson: reqJsonText || undefined,
      })

      const nextJob = applyResponseToJob(draftJob, response)

      updateJobs((current) =>
        current.map((candidate) => (candidate.id === draftJob.id ? nextJob : candidate)),
      )
      syncPreview(nextJob)

      if (nextJob.taskId) {
        setActiveTaskId(nextJob.taskId)
      }
    } catch (error) {
      updateJobs((current) =>
        current.map((candidate) =>
          candidate.id === draftJob.id
            ? {
                ...candidate,
                message: error instanceof Error ? error.message : '提交失败',
                status: 'error',
                updatedAt: nowIso(),
              }
            : candidate,
        ),
      )
    } finally {
      setBusyLabel(null)
    }
  }

  return (
    <div className="studio-stack">
      <section className="studio-card">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">AI 工坊</p>
            <h3>即梦视频生成</h3>
          </div>
          <span>{config?.configured ? 'AK/SK 已接入' : '等待配置'}</span>
        </div>
        <p className="studio-note">{configMessage}</p>
        <div className="media-stack">
          <div className="media-row">
            <span>接口地址</span>
            <strong>{config?.endpoint ?? 'http://127.0.0.1:8787 /api/jimeng'}</strong>
          </div>
          <div className="media-row">
            <span>固定 Action</span>
            <strong>{config?.actions.submit ?? 'CVSync2AsyncSubmitTask'}</strong>
          </div>
          <div className="media-row">
            <span>固定 ReqKey</span>
            <strong>{config?.reqKey ?? 'jimeng_ti2v_v30_pro'}</strong>
          </div>
        </div>
      </section>

      <section className="studio-card">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">镜头参数</p>
            <h3>生成草案</h3>
          </div>
          <span>{busyLabel ?? '可直接提交到即梦'}</span>
        </div>

        <label className="studio-field">
          <span>目标场景</span>
          <select
            className="studio-select"
            value={selectedSceneId}
            onChange={(event) => setSelectedSceneId(event.target.value)}
          >
            {scenes.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.act} / {candidate.title}
              </option>
            ))}
          </select>
        </label>

        <div className="studio-inline">
          <button type="button" className="secondary-button" onClick={fillPromptFromScene}>
            填充场景 Prompt
          </button>
          {currentSceneId ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedSceneId(currentSceneId)}
            >
              选中当前镜头
            </button>
          ) : null}
        </div>

        {selectedScene ? (
          <div className="studio-scene-brief">
            <strong>{selectedScene.title}</strong>
            <span>{selectedScene.location}</span>
            <span>建议落盘到 {selectedScene.stage.media[0]?.src ?? '/public/media/...'}</span>
          </div>
        ) : null}

        <label className="studio-field">
          <span>视频 Prompt</span>
          <textarea
            className="studio-textarea"
            rows={8}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="描述镜头、人物动作、服装、光线和情绪。"
          />
        </label>

        <label className="studio-field">
          <span>首帧图片 URL，可留空</span>
          <input
            className="studio-input"
            type="url"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="图生视频时填写，文生视频可留空。"
          />
        </label>

        <div className="studio-grid">
          <label className="studio-field">
            <span>画幅比例</span>
            <select
              className="studio-select"
              value={aspectRatio}
              onChange={(event) => setAspectRatio(event.target.value as JimengAspectRatio)}
            >
              {aspectRatioOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="studio-field">
            <span>时长 / 帧数</span>
            <select
              className="studio-select"
              value={String(frames)}
              onChange={(event) => setFrames(Number(event.target.value) === 241 ? 241 : 121)}
            >
              {frameOptions.map((option) => (
                <option key={option.frames} value={option.frames}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="studio-field">
            <span>随机种子</span>
            <input
              className="studio-input"
              type="number"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
            />
          </label>
        </div>

        <label className="studio-field">
          <span>可选 req_json</span>
          <textarea
            className="studio-textarea studio-textarea-compact"
            rows={4}
            value={reqJsonText}
            onChange={(event) => setReqJsonText(event.target.value)}
            placeholder='例如 {"aigc_meta":{"content_producer":"...","producer_id":"scene-001"}}'
          />
        </label>

        <div className="studio-inline">
          <button
            type="button"
            className="primary-button"
            onClick={() => void submit()}
            disabled={Boolean(busyLabel) || !config?.configured}
          >
            提交到即梦
          </button>
          <span className="studio-note">
            提交后会自动轮询，成功时返回可下载的 `video_url`。
          </span>
        </div>
      </section>

      <section className="studio-card">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">任务履历</p>
            <h3>最近 12 条生成记录</h3>
          </div>
          <span>{jobs.length} 条</span>
        </div>

        {jobs.length === 0 ? (
          <p className="studio-note">还没有提交过任务，先用当前镜头跑一条试试。</p>
        ) : (
          <div className="studio-job-list">
            {jobs.map((job) => (
              <article key={job.id} className="studio-job-card">
                <div className="studio-job-head">
                  <div>
                    <strong>{job.sceneTitle}</strong>
                    <p>{job.taskId ?? '尚未拿到 task_id'}</p>
                  </div>
                  <span className={`studio-status ${jobTone(job)}`}>
                    {jobStatusLabel(job)}
                  </span>
                </div>
                {previewVideoBySceneId[job.sceneId] === job.videoUrl && job.videoUrl ? (
                  <p className="studio-job-preview">当前已挂到该镜头舞台预览</p>
                ) : null}
                <p className="studio-job-prompt">{job.prompt || '未填写 prompt'}</p>
                <div className="studio-job-meta">
                  <span>{job.aspectRatio}</span>
                  <span>{job.frames === 241 ? '10 秒' : '5 秒'}</span>
                  <span>seed {job.seed}</span>
                </div>
                <div className="studio-job-meta">
                  <span>{job.message}</span>
                  <span>{job.requestId ? `request_id ${job.requestId}` : '等待 request_id'}</span>
                </div>
                <div className="studio-inline">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void refreshJob(job)}
                    disabled={!job.taskId || Boolean(busyLabel)}
                  >
                    刷新状态
                  </button>
                  {job.videoUrl ? (
                    <button
                      type="button"
                      className={
                        previewVideoBySceneId[job.sceneId] === job.videoUrl
                          ? 'primary-button'
                          : 'secondary-button'
                      }
                      onClick={() =>
                        previewVideoBySceneId[job.sceneId] === job.videoUrl
                          ? onClearPreview(job.sceneId)
                          : onUsePreview(job)
                      }
                    >
                      {previewVideoBySceneId[job.sceneId] === job.videoUrl
                        ? '取消舞台预览'
                        : '设为舞台预览'}
                    </button>
                  ) : null}
                  {job.videoUrl ? (
                    <a
                      className="secondary-button studio-link-button"
                      href={
                        job.taskId
                          ? buildJimengMediaProxyUrl(job.taskId, job.reqJsonText, job.updatedAt)
                          : job.videoUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开视频
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
