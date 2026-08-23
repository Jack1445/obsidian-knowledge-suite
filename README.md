# Obsidian Knowledge Suite

当前稳定版本：**v1.0.0（2026-08-23，已通过测试 Vault 验收）**。

该版本已在三个旧源码仓库改名、不可被构建脚本访问的情况下，独立完成源码校验、29 项自动测试、两个插件的生产构建与测试 Vault 部署。

一个面向 Obsidian 的可视化知识工作台。本仓库统一维护两个可安装插件：

- **Knowledge Map**：以文件夹和笔记为基础的持久知识地图、画布管理与地球视图。
- **Excalidraw Custom**：保留 Excalidraw 原有体验，并加入行内公式、局部加粗等定制能力。

定制的 Excalidraw Core 作为内部构建依赖保存在 `packages/excalidraw-core-custom`，用户不需要单独安装它。

> 当前仓库正在进行首次单仓库整合。旧的三个仓库暂时保留，直到整合发行包完成回归验收。

## 目录

```text
plugins/knowledge-map          Knowledge Map 插件
plugins/excalidraw-custom      定制 Excalidraw 插件
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
release/artifacts/ 两个插件各自的标准发布文件
release/*.zip      一个整合安装包
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
