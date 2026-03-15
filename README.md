# 倩女幽魂·回梦片单

一个从零搭建的网页互动影游 Demo，面向“正式原型”而不是普通脚手架演示。

## 已实现

- 4 位可攻略女主：聂小倩、燕绯璃、苏晚歌、沈见月
- 每条线路含明亮 / 破碎结局
- 1 条多周目隐藏回梦线
- 本地自动存档 + 3 格手动存档
- 片库收录：结局、旧物、隐藏线解锁
- 视频接入位：支持 `mp4` / `webm`
- BGM / SFX：支持 `mp3` / `ogg`
- 字幕轨：支持 `WebVTT (.vtt)`
- 无正式视频时自动切换为氛围化舞台
- 移动端优先竖屏体验，兼容桌面端
- GitHub Pages 工作流已内置

## 技术栈

- React 19
- Vite 8
- TypeScript
- 原生 CSS

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

代码检查：

```bash
npm run lint
```

## 目录结构

```text
src/
  components/StageFrame.tsx   # 影游舞台与视频容器
  lib/game-state.ts           # 存档、推进、结局奖励
  story/content.ts            # 剧情数据与线路配置
  story/types.ts              # 类型定义
```

## 替换正式视频

把正式媒体按约定路径放到 `public/media/...` 下即可，路径已经在 `src/story/content.ts` 和 `src/lib/media.ts` 中预留完成。

示例：

```text
public/media/common/crossroads.mp4
public/media/common/crossroads.zh-CN.vtt
public/media/xiaoqian/rain-pavilion.mp4
public/media/xiaoqian/rain-pavilion.zh-CN.vtt
public/media/feili/tower-fire.mp4
public/media/wange/lantern-market.mp4
public/media/jianyue/bridge-docket.mp4
public/media/hidden/rewind-room.mp4
public/media/audio/bgm/common-prologue.mp3
public/media/audio/bgm/xiaoqian-theme.mp3
public/media/audio/bgm/xiaoqian-radiant.mp3
public/media/audio/sfx/choice-confirm.mp3
public/media/audio/sfx/save-scroll.mp3
```

命名规则：

- 视频：与场景 stem 同名，支持 `.mp4` / `.webm`
- 字幕：和视频同目录同 stem，后缀固定为 `.zh-CN.vtt`
- BGM：`public/media/audio/bgm/<route-or-scene-key>.mp3`
- SFX：`public/media/audio/sfx/<effect-key>.mp3`

## GitHub Pages

仓库内已包含 `.github/workflows/deploy-pages.yml`，推到 GitHub 后：

1. 打开仓库 `Settings > Pages`
2. 将 Source 设为 `GitHub Actions`
3. 推送到 `main` 后会自动构建并发布

## 适合继续扩展的方向

- 接入正式 AI 视频、BGM、SFX 和字幕轨
- 把剧情数据改为 CMS / 表格驱动
- 增加立绘层、转场镜头和章节回顾
- 接微信 WebView 或小游戏容器
