import http from 'node:http'
import { URL } from 'node:url'
import { Signer } from '@volcengine/openapi'

if (process.env.JIMENG_ALLOW_INSECURE_TLS === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

const HOST = process.env.JIMENG_API_HOST || '127.0.0.1'
const PORT = Number(process.env.JIMENG_API_PORT || 8787)
const VISUAL_ENDPOINT =
  process.env.JIMENG_VISUAL_ENDPOINT || 'https://visual.volcengineapi.com'
const REGION = process.env.JIMENG_REGION || 'cn-north-1'
const SERVICE = 'cv'
const VERSION = '2022-08-31'
const SUBMIT_ACTION = 'CVSync2AsyncSubmitTask'
const RESULT_ACTION = 'CVSync2AsyncGetResult'
const DEFAULT_REQ_KEY = process.env.JIMENG_REQ_KEY || 'jimeng_ti2v_v30_pro'

const accessKeyId =
  process.env.VOLC_ACCESSKEY || process.env.JIMENG_ACCESS_KEY_ID || ''
const secretKey =
  process.env.VOLC_SECRETKEY || process.env.JIMENG_SECRET_ACCESS_KEY || ''
const sessionToken =
  process.env.VOLC_SESSIONTOKEN || process.env.JIMENG_SESSION_TOKEN || ''

const visualUrl = new URL(VISUAL_ENDPOINT)
const visualHost = visualUrl.host
const allowedAspectRatios = new Set(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'])

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function isConfigured() {
  return Boolean(accessKeyId && secretKey)
}

function coerceReqJson(value) {
  if (!value) {
    return undefined
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }

  return JSON.stringify(value)
}

function normalizeList(value) {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  const item = String(value).trim()
  return item ? [item] : []
}

function normalizeFrames(value) {
  return Number(value) === 241 ? 241 : 121
}

function normalizeSeed(value) {
  const seed = Number(value ?? -1)

  if (!Number.isFinite(seed)) {
    return -1
  }

  return Math.trunc(seed)
}

function normalizeAspectRatio(value) {
  if (typeof value !== 'string') {
    return '16:9'
  }

  return allowedAspectRatios.has(value) ? value : '16:9'
}

function createSubmitBody(payload) {
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : ''
  const imageUrls = normalizeList(payload.imageUrls ?? payload.imageUrl)
  const binaryDataBase64 = normalizeList(
    payload.binaryDataBase64 ?? payload.binary_data_base64,
  )

  if (!prompt && imageUrls.length === 0 && binaryDataBase64.length === 0) {
    throw new Error('请至少提供 prompt、首帧图片 URL 或 base64 图片之一。')
  }

  const body = {
    req_key: DEFAULT_REQ_KEY,
    frames: normalizeFrames(payload.frames),
    seed: normalizeSeed(payload.seed),
    aspect_ratio: normalizeAspectRatio(payload.aspectRatio),
  }

  if (prompt) {
    body.prompt = prompt
  }

  if (imageUrls.length > 0) {
    body.image_urls = imageUrls
  }

  if (binaryDataBase64.length > 0) {
    body.binary_data_base64 = binaryDataBase64
  }

  const reqJson = coerceReqJson(payload.reqJson)

  if (reqJson) {
    body.req_json = reqJson
  }

  return body
}

function createResultBody(payload) {
  const taskId = typeof payload.taskId === 'string' ? payload.taskId.trim() : ''

  if (!taskId) {
    throw new Error('查询任务时需要提供 task_id。')
  }

  const body = {
    req_key: DEFAULT_REQ_KEY,
    task_id: taskId,
  }

  const reqJson = coerceReqJson(payload.reqJson)

  if (reqJson) {
    body.req_json = reqJson
  }

  return body
}

async function readJson(request) {
  const chunks = []
  let size = 0
  const limit = 8 * 1024 * 1024

  for await (const chunk of request) {
    size += chunk.length

    if (size > limit) {
      throw new Error('请求体过大，请改用图片 URL 或缩小 base64 图片。')
    }

    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(raw)
}

async function callVisual(action, payload) {
  const requestData = {
    region: REGION,
    method: 'POST',
    params: {
      Action: action,
      Version: VERSION,
    },
    headers: {
      Host: visualHost,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }

  const signer = new Signer(requestData, SERVICE)
  signer.addAuthorization({
    accessKeyId,
    secretKey,
    sessionToken,
  })

  const requestUrl = new URL(VISUAL_ENDPOINT)
  requestUrl.search = new URLSearchParams(requestData.params).toString()

  const response = await fetch(requestUrl, {
    method: requestData.method,
    headers: requestData.headers,
    body: requestData.body,
  })

  const text = await response.text()
  let json = null

  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }

  return {
    httpStatus: response.status,
    ok: response.ok,
    payload: json,
    raw: text,
  }
}

function normalizeUpstream(action, upstream, requestBody) {
  const payload =
    upstream.payload && typeof upstream.payload === 'object' ? upstream.payload : {}
  const data =
    payload.data && typeof payload.data === 'object' ? payload.data : {}

  return {
    ok: upstream.ok && payload.code === 10000,
    action,
    request: {
      reqKey: requestBody.req_key,
      taskId: requestBody.task_id,
      frames: requestBody.frames,
      aspectRatio: requestBody.aspect_ratio,
    },
    response: payload,
    normalized: {
      code: payload.code ?? null,
      message: payload.message || '请求已完成',
      taskId: data.task_id || requestBody.task_id || null,
      status: data.status || (action === 'submit' ? 'submitted' : null),
      videoUrl: data.video_url || null,
      requestId: payload.request_id || null,
      timeElapsed: payload.time_elapsed || null,
      aigcMetaTagged:
        typeof data.aigc_meta_tagged === 'boolean' ? data.aigc_meta_tagged : null,
    },
    raw: upstream.payload ? null : upstream.raw,
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(
    request.url || '/',
    `http://${request.headers.host || `${HOST}:${PORT}`}`,
  )

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders())
    response.end()
    return
  }

  if (requestUrl.pathname === '/api/jimeng/config' && request.method === 'GET') {
    sendJson(response, 200, {
      configured: isConfigured(),
      endpoint: VISUAL_ENDPOINT,
      region: REGION,
      service: SERVICE,
      version: VERSION,
      reqKey: DEFAULT_REQ_KEY,
      actions: {
        submit: SUBMIT_ACTION,
        result: RESULT_ACTION,
      },
    })
    return
  }

  if (!isConfigured()) {
    sendJson(response, 503, {
      error: 'jimeng_credentials_missing',
      message: '未检测到 VOLC_ACCESSKEY / VOLC_SECRETKEY，请先配置 .env.local。',
    })
    return
  }

  try {
    if (requestUrl.pathname === '/api/jimeng/submit' && request.method === 'POST') {
      const payload = await readJson(request)
      const body = createSubmitBody(payload)
      const upstream = await callVisual(SUBMIT_ACTION, body)
      sendJson(response, 200, normalizeUpstream('submit', upstream, body))
      return
    }

    if (requestUrl.pathname === '/api/jimeng/result' && request.method === 'POST') {
      const payload = await readJson(request)
      const body = createResultBody(payload)
      const upstream = await callVisual(RESULT_ACTION, body)
      sendJson(response, 200, normalizeUpstream('result', upstream, body))
      return
    }

    sendJson(response, 404, {
      error: 'not_found',
      message: '未找到对应的即梦代理接口。',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务内部错误'
    sendJson(response, 500, {
      error: 'jimeng_proxy_failed',
      message,
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log(
    `[jimeng] proxy ready on http://${HOST}:${PORT} -> ${VISUAL_ENDPOINT}`,
  )
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0)
    })
  })
}
