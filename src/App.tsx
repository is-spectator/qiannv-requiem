import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
  type CSSProperties,
} from 'react'
import './App.css'
import { StageFrame } from './components/StageFrame'
import {
  endingLibrary,
  heroineShowcase,
  radiantEndingIds,
  routeAccent,
  routeEntryScene,
  routeLabels,
  routeOrder,
  statLabels,
  storyScenes,
  totalEndingCount,
} from './story/content'
import {
  advanceSnapshot,
  applyEndingRewards,
  buildRequirementLines,
  cloneSnapshot,
  createNewSnapshot,
  createPersistedState,
  describeChoiceLock,
  getRadiantEndingCount,
  isChoiceUnlocked,
  loadState,
  persistState,
  saveIntoSlot,
} from './lib/game-state'
import type {
  HeroineId,
  PersistedState,
  RouteId,
  SaveSlot,
  StoryChoice,
} from './story/types'

const formatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function prettyTime(value?: string) {
  if (!value) {
    return '未游玩'
  }

  return formatter.format(new Date(value))
}

function App() {
  const [state, setState] = useState<PersistedState>(() => loadState())
  const [showTitle, setShowTitle] = useState(true)
  const [drawer, setDrawer] = useState<'archive' | 'saves' | 'settings' | null>(
    null,
  )
  const [previewRoute, setPreviewRoute] = useState<HeroineId>('xiaoqian')
  const [toast, setToast] = useState<string | null>(null)

  const snapshot = state.active
  const scene = snapshot ? storyScenes[snapshot.sceneId] : null
  const currentRoute = scene?.route ?? 'common'
  const accent = routeAccent[currentRoute]
  const history = useDeferredValue(snapshot?.history ?? [])
  const unlockedEndings = useDeferredValue(state.profile.unlockedEndingIds)
  const radiantCount = getRadiantEndingCount(state.profile)
  const hiddenUnlocked = radiantCount >= 2
  const previewHeroine = heroineShowcase[previewRoute]
  const previewRadiantUnlocked = state.profile.unlockedEndingIds.includes(
    radiantEndingIds[previewRoute],
  )

  useEffect(() => {
    persistState(state)
  }, [state])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  function startFresh(sceneId = routeEntryScene.common) {
    startTransition(() => {
      setState((current) => ({
        ...current,
        active: createNewSnapshot(sceneId),
        profile: {
          ...current.profile,
          totalRuns: current.profile.totalRuns + 1,
          lastPlayedAt: new Date().toISOString(),
        },
      }))
      setShowTitle(false)
      setDrawer(null)
    })
  }

  function continueRun() {
    if (!state.active) {
      setToast('当前没有自动存档，先从序章开始一轮吧。')
      return
    }

    startTransition(() => {
      setShowTitle(false)
      setDrawer(null)
    })
  }

  function returnToTitle() {
    startTransition(() => {
      setShowTitle(true)
      setDrawer(null)
    })
  }

  function quickStartRoute(route: HeroineId | 'hidden') {
    if (route === 'hidden' && !hiddenUnlocked) {
      setToast('至少拿到 2 个明亮结局后，回梦线才会开启。')
      return
    }

    startFresh(routeEntryScene[route])
  }

  function saveSlot(slotId: 1 | 2 | 3) {
    if (!snapshot || !scene) {
      setToast('当前没有可写入的进度。')
      return
    }

    setState((current) => ({
      ...current,
      saves: saveIntoSlot(current.saves, slotId, snapshot),
    }))
    setToast(`已写入签匣 ${slotId}。`)
  }

  function loadSlot(slot: SaveSlot) {
    if (!slot.snapshot) {
      setToast('这个签匣还是空的。')
      return
    }

    startTransition(() => {
      setState((current) => ({
        ...current,
        active: cloneSnapshot(slot.snapshot!),
        profile: {
          ...current.profile,
          lastPlayedAt: new Date().toISOString(),
        },
      }))
      setShowTitle(false)
      setDrawer(null)
    })
    setToast(`已载入 ${slot.sceneTitle}。`)
  }

  function resetProgress() {
    startTransition(() => {
      setState(createPersistedState())
      setShowTitle(true)
      setDrawer(null)
    })
    setToast('所有本地进度已清空。')
  }

  function choose(choice: StoryChoice) {
    if (!snapshot || !scene) {
      return
    }

    if (!isChoiceUnlocked(choice, snapshot, state.profile)) {
      setToast(describeChoiceLock(choice, snapshot, state.profile))
      return
    }

    const next = advanceSnapshot(snapshot, choice)
    const nextScene = storyScenes[next.sceneId]

    startTransition(() => {
      setState((current) => ({
        ...current,
        active: next,
        profile: {
          ...applyEndingRewards(current.profile, next.sceneId),
          lastPlayedAt: new Date().toISOString(),
        },
      }))
    })

    if (nextScene.isEnding && nextScene.ending) {
      setToast(`已收录结局：${nextScene.ending.name}`)
    }
  }

  const hotkeys = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setDrawer(null)

      if (!showTitle) {
        setShowTitle(true)
      }

      return
    }

    if (showTitle || !snapshot || !scene || scene.isEnding) {
      return
    }

    if (event.key.toLowerCase() === 's') {
      saveSlot(1)
      return
    }

    const choiceIndex = Number(event.key)

    if (
      Number.isInteger(choiceIndex) &&
      choiceIndex >= 1 &&
      choiceIndex <= scene.choices.length
    ) {
      event.preventDefault()
      choose(scene.choices[choiceIndex - 1])
    }
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => hotkeys(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const shellStyle = {
    '--route-accent': accent,
    '--story-scale': String(state.settings.textScale),
  } as CSSProperties

  return (
    <div
      className={`app-shell${state.settings.reduceMotion ? ' is-reduced-motion' : ''}`}
      style={shellStyle}
    >
      <div className="page-layers" aria-hidden="true">
        <div className="layer-blur layer-blur-a" />
        <div className="layer-blur layer-blur-b" />
        <div className="layer-grid" />
      </div>

      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Interactive Movie Game / H5 Demo</p>
          <h1>倩女幽魂·回梦片单</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" className="ghost-button" onClick={() => setDrawer('archive')}>
            片库
          </button>
          <button type="button" className="ghost-button" onClick={() => setDrawer('saves')}>
            存档
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setDrawer('settings')}
          >
            设置
          </button>
          {!showTitle ? (
            <button type="button" className="primary-button" onClick={returnToTitle}>
              返回戏匣
            </button>
          ) : null}
        </div>
      </header>

      {showTitle ? (
        <main className="title-layout">
          <section className="hero-panel">
            <div className="hero-copy">
              <p className="eyebrow">从零打造的独立 Demo</p>
              <h2>更像一部可以直接扩成正式项目的互动影游</h2>
              <p>
                这个版本不是脚手架演示，而是按正式原型来搭: 多女主分支、明亮/破碎结局、隐藏回梦线、片库收录、本地自动存档、三格手动存档、视频接入位和 GitHub Pages 部署准备都已经打通。
              </p>
            </div>

            <div className="hero-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => startFresh(routeEntryScene.common)}
              >
                从序章开始
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={continueRun}
                disabled={!state.active}
              >
                继续自动存档
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => quickStartRoute(previewRoute)}
              >
                直达「{previewHeroine.name}」
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => quickStartRoute('hidden')}
                disabled={!hiddenUnlocked}
              >
                开启回梦线
              </button>
            </div>

            <div className="metrics-grid">
              <article>
                <span>已收录结局</span>
                <strong>
                  {state.profile.unlockedEndingIds.length}/{totalEndingCount}
                </strong>
              </article>
              <article>
                <span>明亮结局</span>
                <strong>{radiantCount}/4</strong>
              </article>
              <article>
                <span>旧物片库</span>
                <strong>{state.profile.unlockedRelics.length}</strong>
              </article>
              <article>
                <span>最近游玩</span>
                <strong>{prettyTime(state.profile.lastPlayedAt)}</strong>
              </article>
            </div>
          </section>

          <section className="preview-panel">
            <div
              className="preview-stage"
              style={{ '--preview-accent': previewHeroine.accent } as CSSProperties}
            >
              <p className="eyebrow">线路预告</p>
              <h3>{previewHeroine.name}</h3>
              <p className="preview-title">{previewHeroine.title}</p>
              <p className="preview-tagline">{previewHeroine.tagline}</p>
              <p className="preview-blurb">{previewHeroine.blurb}</p>
              <span className={`preview-badge${previewRadiantUnlocked ? ' is-active' : ''}`}>
                {previewRadiantUnlocked ? '明亮结局已收录' : '明亮结局未收录'}
              </span>
            </div>

            <div className="route-list">
              {routeOrder.map((route) => (
                <button
                  type="button"
                  key={route}
                  className={`route-card${previewRoute === route ? ' is-active' : ''}`}
                  style={{ '--card-accent': heroineShowcase[route].accent } as CSSProperties}
                  onClick={() => setPreviewRoute(route)}
                >
                  <span>{heroineShowcase[route].title}</span>
                  <strong>{heroineShowcase[route].name}</strong>
                  <small>{heroineShowcase[route].tagline}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="feature-strip">
            <article>
              <h3>影游结构</h3>
              <p>4 位可攻略女主 + 1 条多周目隐藏回梦线，每条线路都能继续扩写剧情节点与视频片段。</p>
            </article>
            <article>
              <h3>产品形态</h3>
              <p>移动端优先竖屏体验、桌面自适配、剧情数据驱动、本地存档和片库收录。</p>
            </article>
            <article>
              <h3>交付状态</h3>
              <p>仓库结构、README、媒体目录和 GitHub Pages 工作流都已准备，适合继续接正式素材。</p>
            </article>
          </section>

          <section className="archive-overview">
            <div className="section-heading">
              <div>
                <p className="eyebrow">片库概览</p>
                <h3>已收录的旧物与片尾</h3>
              </div>
              <button type="button" className="ghost-button" onClick={() => setDrawer('archive')}>
                打开完整片库
              </button>
            </div>
            <div className="archive-grid">
              {endingLibrary.slice(0, 6).map((ending) => {
                const unlocked = unlockedEndings.includes(ending.id)

                return (
                  <article
                    key={ending.id}
                    className={`archive-card${unlocked ? ' is-unlocked' : ''}`}
                  >
                    <span>{ending.relic}</span>
                    <strong>{ending.name}</strong>
                    <small>{unlocked ? ending.summary : '尚未收录这段片尾。'}</small>
                  </article>
                )
              })}
            </div>
          </section>
        </main>
      ) : scene && snapshot ? (
        <main className="play-layout">
          <section className="stage-column">
            <div className="scene-head">
              <div>
                <p className="eyebrow">{routeLabels[currentRoute as RouteId]}</p>
                <h2>{scene.title}</h2>
              </div>
              <div className="scene-meta">
                <span>{scene.subtitle}</span>
                <span>{scene.mood}</span>
              </div>
            </div>

            <StageFrame key={scene.id} scene={scene} settings={state.settings} />

            <article className="dialogue-panel">
              <div className="dialogue-head">
                <span className="speaker-chip">{scene.speaker}</span>
                <span>{scene.location}</span>
              </div>
              <div className="dialogue-copy">
                {scene.summary.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          </section>

          <aside className="status-column">
            <section className="status-panel">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">命盘</p>
                  <h3>属性</h3>
                </div>
                <span>影响结局</span>
              </div>
              <div className="meter-stack">
                {(Object.keys(statLabels) as Array<keyof typeof statLabels>).map((statId) => (
                  <div key={statId} className="meter-row">
                    <div className="meter-top">
                      <span>{statLabels[statId]}</span>
                      <strong>{snapshot.stats[statId]}</strong>
                    </div>
                    <div className="meter-track">
                      <div
                        className="meter-fill"
                        style={{ width: `${(snapshot.stats[statId] / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="status-panel">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">羁绊</p>
                  <h3>角色心绪</h3>
                </div>
                <span>明亮线更看重这个</span>
              </div>
              <div className="bond-grid">
                {routeOrder.map((route) => (
                  <article key={route} className="bond-card">
                    <div className="meter-top">
                      <span>{heroineShowcase[route].name}</span>
                      <strong>{snapshot.bonds[route]}</strong>
                    </div>
                    <div className="meter-track">
                      <div
                        className="meter-fill"
                        style={{
                          width: `${(snapshot.bonds[route] / 4) * 100}%`,
                          background: heroineShowcase[route].accent,
                        }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="status-panel">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">放映履历</p>
                  <h3>已走过的片段</h3>
                </div>
                <span>{history.length} 段</span>
              </div>
              <div className="history-stack">
                {history.slice(-6).reverse().map((sceneId) => (
                  <div key={sceneId} className="history-item">
                    <strong>{storyScenes[sceneId].act}</strong>
                    <span>{storyScenes[sceneId].title}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="choice-panel">
            {scene.isEnding && scene.ending ? (
              <article className="ending-card">
                <span className={`ending-pill is-${scene.ending.tone}`}>{scene.ending.name}</span>
                <h3>{scene.ending.relic}</h3>
                <p>{scene.ending.summary}</p>
                <div className="ending-actions">
                  <button type="button" className="primary-button" onClick={returnToTitle}>
                    返回戏匣
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => startFresh(routeEntryScene.common)}
                  >
                    从序章重开
                  </button>
                  {currentRoute !== 'common' ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => startFresh(routeEntryScene[currentRoute as RouteId])}
                    >
                      重跑当前线路
                    </button>
                  ) : null}
                </div>
              </article>
            ) : (
              <>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">关键抉择</p>
                    <h3>下一镜</h3>
                  </div>
                  <div className="hint-list">
                    <span>数字键可直接选项</span>
                    <span>S 键快速写入签匣 1</span>
                  </div>
                </div>

                <div className="choice-grid">
                  {scene.choices.map((choice, index) => {
                    const unlocked = isChoiceUnlocked(choice, snapshot, state.profile)
                    const requirements = buildRequirementLines(choice)

                    return (
                      <button
                        type="button"
                        key={choice.id}
                        className={`choice-card${unlocked ? '' : ' is-locked'}`}
                        onClick={() => choose(choice)}
                      >
                        <span className="choice-index">{index + 1}</span>
                        <strong>{choice.label}</strong>
                        <p>{choice.caption}</p>
                        {requirements.length > 0 ? (
                          <div className="requirement-line">{requirements.join(' / ')}</div>
                        ) : null}
                        <small>{describeChoiceLock(choice, snapshot, state.profile)}</small>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </main>
      ) : null}

      {drawer ? (
        <>
          <button
            type="button"
            className="drawer-scrim"
            aria-label="关闭抽屉"
            onClick={() => setDrawer(null)}
          />
          <aside className="drawer-panel">
            {drawer === 'archive' ? (
              <>
                <div className="drawer-head">
                  <div>
                    <p className="eyebrow">片库</p>
                    <h2>结局与旧物收录</h2>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => setDrawer(null)}>
                    关闭
                  </button>
                </div>
                <div className="archive-grid full">
                  {endingLibrary.map((ending) => {
                    const unlocked = state.profile.unlockedEndingIds.includes(ending.id)

                    return (
                      <article
                        key={ending.id}
                        className={`archive-card${unlocked ? ' is-unlocked' : ''}`}
                      >
                        <span>{ending.relic}</span>
                        <strong>{ending.name}</strong>
                        <small>{unlocked ? ending.summary : '尚未收录这段片尾。'}</small>
                      </article>
                    )
                  })}
                </div>
              </>
            ) : null}

            {drawer === 'saves' ? (
              <>
                <div className="drawer-head">
                  <div>
                    <p className="eyebrow">签匣</p>
                    <h2>手动存档</h2>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => setDrawer(null)}>
                    关闭
                  </button>
                </div>
                <div className="save-stack">
                  {state.saves.map((slot) => (
                    <article key={slot.id} className="save-card">
                      <div>
                        <strong>{slot.title}</strong>
                        <p>{slot.sceneTitle}</p>
                        <small>
                          {slot.snapshot
                            ? `保存于 ${prettyTime(slot.snapshot.updatedAt)}`
                            : '当前为空'}
                        </small>
                      </div>
                      <div className="save-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => saveSlot(slot.id)}
                          disabled={!snapshot}
                        >
                          写入
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => loadSlot(slot)}
                          disabled={!slot.snapshot}
                        >
                          载入
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}

            {drawer === 'settings' ? (
              <>
                <div className="drawer-head">
                  <div>
                    <p className="eyebrow">卷轴参数</p>
                    <h2>体验设置</h2>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => setDrawer(null)}>
                    关闭
                  </button>
                </div>
                <div className="settings-stack">
                  <label className="setting-card">
                    <span>视频音量</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={state.settings.volume}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            volume: Number(event.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="setting-card toggle">
                    <span>自动播放</span>
                    <input
                      type="checkbox"
                      checked={state.settings.autoplay}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            autoplay: event.target.checked,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="setting-card toggle">
                    <span>减少动态</span>
                    <input
                      type="checkbox"
                      checked={state.settings.reduceMotion}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            reduceMotion: event.target.checked,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="setting-card">
                    <span>文本倍率</span>
                    <input
                      type="range"
                      min="0.95"
                      max="1.2"
                      step="0.05"
                      value={state.settings.textScale}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            textScale: Number(event.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                </div>
                <section className="danger-zone">
                  <h3>危险操作</h3>
                  <p>会清空本地自动存档、签匣和所有片库收录。</p>
                  <button type="button" className="danger-button" onClick={resetProgress}>
                    清空全部进度
                  </button>
                </section>
              </>
            ) : null}
          </aside>
        </>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}

export default App
