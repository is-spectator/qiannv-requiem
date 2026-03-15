export type JimengServiceResponse = {
  code?: number
  data?: {
    aigc_meta_tagged?: boolean
    status?: string
    task_id?: string
    video_url?: string
  } | null
  message?: string
  request_id?: string
  time_elapsed?: string
}

export type JimengNormalizedResponse = {
  aigcMetaTagged: boolean | null
  code: number | null
  message: string
  requestId: string | null
  status: string | null
  taskId: string | null
  timeElapsed: string | null
  videoUrl: string | null
}

export type JimengProxyResponse = {
  action: 'submit' | 'result'
  normalized: JimengNormalizedResponse
  ok: boolean
  raw: string | null
  request: {
    aspectRatio?: string
    frames?: number
    reqKey?: string
    taskId?: string
  }
  response: JimengServiceResponse
}

export type JimengConfig = {
  actions: {
    result: string
    submit: string
  }
  configured: boolean
  endpoint: string
  region: string
  reqKey: string
  service: string
  version: string
}

export type JimengSubmitPayload = {
  aspectRatio: string
  frames: 121 | 241
  imageUrl?: string
  prompt?: string
  reqJson?: string
  seed: number
}

export type JimengResultPayload = {
  reqJson?: string
  taskId: string
}

const apiBase = '/api/jimeng'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, init)
  const text = await response.text()
  let payload: unknown = null

  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : '请求失败'

    throw new Error(message)
  }

  return payload as T
}

export function fetchJimengConfig() {
  return requestJson<JimengConfig>('/config')
}

export function submitJimengTask(payload: JimengSubmitPayload) {
  return requestJson<JimengProxyResponse>('/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function queryJimengTask(payload: JimengResultPayload) {
  return requestJson<JimengProxyResponse>('/result', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}
