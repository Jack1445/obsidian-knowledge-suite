# 架构说明

## 总体结构

```text
Knowledge Suite plugin
├─ Excalidraw 主生命周期与通用画布
├─ Knowledge Map 内部控制器
│  ├─ 2维/3维画布、画布树和管理器
│  └─ Vault/Workspace 事件与持久布局
├─ 统一数据协调器
│  ├─ excalidraw 命名空间
│  └─ knowledgeMap 命名空间
└─ 定制 Excalidraw Core、KaTeX、Three.js 与纹理资源
```

## 构建依赖方向

```text
packages/excalidraw-core-custom
             ↓ UMD + CSS
plugins/knowledge-suite
```

构建必须严格按这个方向执行。不能先构建 Excalidraw 插件再替换 Core，否则最终 `main.js` 仍会包含旧 Core。

## 数据边界

- Knowledge Map 与 Excalidraw 数据由同一协调器分别保存，互不覆盖。
- Excalidraw 文件仍使用标准 Excalidraw/Markdown 文件格式。
- 行内公式和局部加粗记录在 Excalidraw 元素的 `customData` 中。
- 构建和部署脚本只处理 `main.js`、`manifest.json`、`styles.css`。
- `data.json` 属于用户设置，任何自动部署或升级流程都不得覆盖它。

构建只输出 `knowledge-suite`。Knowledge Map 不再继承 `Plugin`，而由统一主插件负责注册和清理。

## 版本来源

根目录 `suite-version.json` 记录统一版本及三个上游组件的来源版本和提交。每次发布前，脚本会验证统一 `manifest.json`。

