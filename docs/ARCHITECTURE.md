# 架构说明

## 总体结构

```text
Obsidian Vault
├─ Knowledge Map plugin
│  ├─ 读取 Vault 文件夹与文件
│  ├─ 生成节点、层级边和引用边
│  ├─ 保存地图布局
│  └─ 调用 Excalidraw API 创建知识画布
│
└─ Excalidraw Custom plugin
   ├─ 提供通用画布界面
   ├─ 加载定制 Excalidraw Core
   ├─ 渲染知识节点与普通绘图元素
   └─ 提供公式和局部文字样式
```

## 构建依赖方向

```text
packages/excalidraw-core-custom
             ↓ UMD + CSS
plugins/excalidraw-custom
             ↓ Excalidraw API
plugins/knowledge-map
```

构建必须严格按这个方向执行。不能先构建 Excalidraw 插件再替换 Core，否则最终 `main.js` 仍会包含旧 Core。

## 数据边界

- Knowledge Map 的地图布局由 Knowledge Map 保存。
- Excalidraw 文件仍使用标准 Excalidraw/Markdown 文件格式。
- 行内公式和局部加粗记录在 Excalidraw 元素的 `customData` 中。
- 构建和部署脚本只处理 `main.js`、`manifest.json`、`styles.css`。
- `data.json` 属于用户设置，任何自动部署或升级流程都不得覆盖它。

## 为什么仍然输出两个插件

两个插件拥有不同的插件 ID、设置和职责。保留两个运行时插件可以降低升级 Excalidraw 上游时的冲突，并使 Knowledge Map 的业务逻辑保持独立。单仓库解决的是源码和发布维护问题，不强行混合两个插件生命周期。

## 版本来源

根目录 `suite-version.json` 是统一版本清单，记录 Suite 版本、两个插件版本、Core 版本以及首次导入的稳定提交。每次发布前，脚本会验证它与两个 `manifest.json` 是否一致。

