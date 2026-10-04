<div align="center">
  <img src="public/icon/128.png" alt="无限历史记录（自用版）" width="120" />

  <h1>无限历史记录（自用版）</h1>

  <p>
    <b>不限量保存与管理你的 B 站观看历史、收藏夹与喜欢的音乐</b>
    <br/>
    支持 WebDAV 双向同步 · AI 语义搜索 · Chrome / Edge / Firefox 全平台
  </p>
</div>

---

> **声明**：本项目是一个**个人自用**的浏览器扩展分支，与原作者项目
> [`mundane799699/bilibili-history-wxt`](https://github.com/mundane799699/bilibili-history-wxt)
> 相互独立、各自维护。自用版在原项目基础上做了针对性的调整与修复，**不代表原项目，也不提供任何官方支持**。
> 原项目遵循 MIT 协议，本项目同样遵循 MIT 协议并保留原作者的版权声明。

## 简介

B 站官方网页端只保留**最近 3 个月**的观看历史，超出后无法再找回。

**无限历史记录（自用版）** 是一个浏览器扩展，通过本地 IndexedDB 永久保存你的全部 B 站观看历史、收藏夹与"喜欢的音乐"，并提供 WebDAV 双向同步与 AI 语义搜索，让"想再看一次的视频"永远不再丢失。

## 功能特性

- **永久保存** — 自动同步并永久保留全部 B 站观看历史，彻底告别 3 个月限制
- **收藏夹备份** — 支持收藏夹与"喜欢的音乐"全量 + 增量同步，本地随时可查
- **WebDAV 双向同步** — 与坚果云 / 自建 WebDAV 互通，多设备智能合并不丢数据
- **AI 语义搜索** — 支持配置 OpenAI 兼容接口，用自然语言找回模糊记忆中的视频
- **网页端联动** — 在 B 站网页上删除历史会同步删除插件本地记录
- **多浏览器支持** — Chrome / Edge / Firefox 全平台覆盖
- **隐私优先** — 数据默认仅存在本地，是否上传云端完全由你决定

## 使用方法

1. 登录 [B 站网页版](https://www.bilibili.com)
2. 安装扩展后，点击浏览器工具栏中的扩展图标
3. 首次点击「立即同步」会全量同步你的 Bilibili 观看历史
4. 同步完成后，点击「打开历史记录页面」即可查看全部记录
5. 使用搜索框检索特定记录，向下滚动加载更多

## 技术栈

- [WXT](https://wxt.dev) — 现代化跨浏览器扩展框架
- [React 19](https://react.dev) + [TailwindCSS 3](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)
- IndexedDB · `browser.alarms` · `declarativeNetRequest`

## 本地开发

```bash
# 1. 安装 pnpm
npm install -g pnpm

# 2. 安装依赖（postinstall 会自动跑 wxt prepare）
pnpm install

# 3. 启动开发模式
pnpm dev              # Chrome
pnpm dev:firefox      # Firefox
```

加载本地扩展：Chrome 打开 `chrome://extensions/` → 加载已解压扩展程序 → 选择 `.output/chrome-mv3-dev`。

| 命令           | 说明                |
| -------------- | ------------------- |
| `pnpm dev`     | Chrome 开发模式     |
| `pnpm build`   | 生产构建            |
| `pnpm zip`     | 打包上架 zip        |
| `pnpm compile` | TypeScript 类型检查 |
| `pnpm format`  | Prettier 格式化     |

## 开源与署名

本项目继承自开源项目
[`mundane799699/bilibili-history-wxt`](https://github.com/mundane799699/bilibili-history-wxt)，
遵循 [MIT License](LICENSE)。本仓库为个人自用分支。

问题与建议请通过 GitHub Issues 提交：
<https://github.com/LiM603/bilibili-history-wxt/issues>

## License

本项目基于 [MIT License](LICENSE) 开源。
