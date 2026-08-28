# 常见问题

## 提示 Excalidraw 版本不匹配

原因通常是只更新了 `manifest.json`，但 `main.js` 仍是旧版本，或反过来。运行完整的：

```bash
npm run build:suite
```

不要单独复制 manifest。

## 图片显示为灰色占位符

首先回退到上一稳定 Excalidraw 插件文件。随后检查：

- Core 与插件版本是否匹配。
- Core 构建资源是否完整。
- 是否意外使用了不同版本的 Excalidraw npm 包。
- 原始图片文件是否仍在 Vault 中。

不要通过重新保存画布来掩盖问题，以免把缺失状态写回文件。

## 加粗只在双击编辑时可见

局部加粗数据已经保存，但正式画布仍在复用旧渲染缓存。当前 Core 已在修改局部样式后清理对应元素的 Canvas 缓存。如果再次出现，应先确认插件 `main.js` 中嵌入的是本仓库刚构建的 Core。

## 公式编辑框为空

确认公式记录仍存在于元素 `customData`，并检查公式编辑器是否读取了已有 LaTeX，而不是只读取当前文本选区。

## 构建提示缺少依赖

统一脚本不会偷偷下载依赖。明确允许联网后运行：

```bash
npm run install:suite -- --confirm
```

## Excalidraw 全仓 ESLint 报告大量错误

导入的上游插件在当前 ESLint 类型规则下存在既有技术债，主要集中在旧的 `any` 类型和无法解析的 Core 类型。首次整合不批量重写这些成熟代码，以免引入功能回归。发布门槛采用生产构建、嵌入 Core 签名校验以及画布功能回归；后续可以单独建立渐进式 Lint 清理计划。

## 部署到了错误的 Vault

部署必须提供绝对路径，并建议先使用：

```bash
npm run deploy:test -- --vault "D:\path\to\vault" --dry-run
```

正式部署前会输出所有目标文件。
