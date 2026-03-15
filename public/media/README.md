将正式视频、BGM、SFX 和字幕轨按这里的路径放入即可，代码已经预留了所有场景入口。

推荐：

- 竖屏 1080x1920 或等比输出
- 视频同时提供 `mp4` 与 `webm`
- 音频优先提供 `mp3`，可附加 `ogg`
- 字幕轨使用 `WebVTT (.vtt)`
- 文件名与 `src/story/content.ts` 中保持一致
- 视频字幕轨与视频同目录同 stem，例如 `rain-pavilion.mp4` 对应 `rain-pavilion.zh-CN.vtt`

当前已预留目录：

- `public/media/common/`
- `public/media/xiaoqian/`
- `public/media/feili/`
- `public/media/wange/`
- `public/media/jianyue/`
- `public/media/hidden/`
- `public/media/audio/bgm/`
- `public/media/audio/sfx/`
