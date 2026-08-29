# Obsidian Knowledge Suite

当前开发版本：**0.1.0-beta.1**。

该版本完成了画布树、2维/3维父子画布、节点外观系统、3维画布交互、右键菜单重构，以及行内公式编辑修复，并通过统一源码校验、自动测试、生产构建与测试 Vault 部署。

一个面向 Obsidian 的可视化知识工作台。本仓库把两个既有插件合并为单一的 **Knowledge Suite** 插件（ID：`knowledge-suite`）：

- **Knowledge Map**：以文件夹和笔记为基础的持久知识地图、画布管理与地球视图。
- **Excalidraw Custom**：保留 Excalidraw 原有体验，并加入行内公式、局部加粗等定制能力。
- **标签与属性**：为 Markdown 文档建立自定义字段，在管理表格和正文内查看、编辑与筛选。

定制的 Excalidraw Core 作为内部构建依赖保存在 `packages/excalidraw-core-custom`，用户不需要单独安装它。

> 当前仓库正在进行首次单仓库整合。旧的三个仓库暂时保留，直到整合发行包完成回归验收。

## 目录

```text
plugins/knowledge-suite        Knowledge Suite 统一插件
packages/excalidraw-core-custom 定制 Excalidraw Core
scripts/                       统一构建、测试、打包和部署脚本
docs/                          面向开发者和新人的说明文档
release/                       本地生成的发行产物（不提交）
```

## 快速开始

首次克隆后：

```bash
npm run install:suite -- --confirm
npm run verify:suite
npm run test:suite
npm run build:suite
npm run package:suite
```

依赖安装命令必须显式附加 `--confirm`，防止脚本在不知情的情况下联网下载。

构建结果位于：

```text
release/staging/   可直接放入 Vault 的目录结构
release/artifacts/ Knowledge Suite 标准发布文件与许可证
release/*.zip      单插件安装包
```

## 文档

- [功能概览](docs/FEATURES.md)
- [安装和升级](docs/INSTALL.md)
- [架构说明](docs/ARCHITECTURE.md)
- [开发说明](docs/DEVELOPMENT.md)
- [测试清单](docs/TESTING.md)
- [发布流程](docs/RELEASE.md)
- [同步上游](docs/UPSTREAM-SYNC.md)
- [常见问题](docs/TROUBLESHOOTING.md)

## 当前迁移状态

旧的三个仓库暂时保留为回退来源。只有在整合发行包完成干净安装、覆盖升级和核心功能回归后，才考虑将旧 Core 仓库归档。
