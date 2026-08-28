# 同步上游

## 上游来源

- Excalidraw Core：`zsviczian/excalidraw`
- Obsidian Excalidraw：`zsviczian/obsidian-excalidraw-plugin`

首次导入基线见根目录 `BASELINES.md`。

## 同步原则

1. 不直接在稳定整合分支上拉取上游。
2. 创建独立的 `codex/upstream-*` 分支。
3. 先比较上游版本对 React、字体、图片和存储格式的变化。
4. 重新应用本项目的行内公式、局部加粗和菜单修改。
5. 构建 Core，再注入 Excalidraw 插件。
6. 完成普通 Excalidraw 与 Knowledge Map 双重回归。
7. 用户验收后再合并。

## 需要重点保护的定制点

- `obsidianInlineTextStyles` 局部文字样式数据。
- 行内公式记录、排版和点击编辑。
- Canvas 与 SVG 的局部粗体渲染。
- 文本样式修改后的画布缓存失效。
- Excalidraw 三点菜单中的公式和知识布局入口。
- Knowledge Map 对 Excalidraw 原生 `Ctrl+B` 的事件让渡。

## 为什么不直接升级 npm 依赖

Excalidraw Custom 构建时会把 Core UMD 嵌入 `main.js`。仅修改 npm 版本或 `manifest.json` 可能造成代码、清单和资源版本不一致。所有上游升级都必须经过统一构建脚本和回归测试。

