# Knowledge Suite

Knowledge Suite 是一个面向 Obsidian 桌面端的可视化知识工作台，将 Excalidraw 风格的二维/三维画布、知识地图、Markdown 标签与属性管理，以及画布语义单位整合到一个插件中。

当前准备发布的版本：**0.1.0**。

## 主要功能

- 二维画布：继承 Excalidraw 的绘图、文件拖入、链接、图片、文本与公式能力。
- 三维画布与知识地图：在文件夹和笔记之间进行持久化的空间导航。
- Markdown 标签与属性：集中管理文档属性，并将属性用于语义筛选。
- 画布语义单位：建立可同步的画布元素单位，支持 Markdown 依托、实例管理、重命名和批量控制。
- 语义筛选画布：按 Markdown 属性临时展示语义单位；筛选画布只读，仅允许整体移动布局。
- 默认路径/命名设置：为新建二维、三维画布设置可选的默认名称和保存位置。

## 安装

### 推荐：下载整合包

1. 打开 [Releases](https://github.com/Jack1445/obsidian-knowledge-suite/releases)，下载目标版本的 `knowledge-suite-vX.Y.Z.zip`。
2. 在 Obsidian 中打开 **设置 → 第三方插件**，点击“已安装插件”标题右侧的文件夹图标。此时文件管理器会打开 `Vault/.obsidian/plugins`。
3. 在文件管理器的路径栏中点击 Vault 文件夹名称，或按两次 `Alt+向上`：第一次进入 `.obsidian`，第二次回到 Vault 根目录。看到 `.obsidian` 文件夹后，确认当前位置就是 Vault 根目录。
4. 将 ZIP 解压到 Vault 根目录。解压后应存在：

   ```text
   你的Vault/.obsidian/plugins/knowledge-suite/main.js
   你的Vault/.obsidian/plugins/knowledge-suite/manifest.json
   你的Vault/.obsidian/plugins/knowledge-suite/styles.css
   ```

5. 重新打开 Obsidian，在 **设置 → 第三方插件** 中刷新插件列表并启用 **Knowledge Suite**。

Knowledge Suite 使用 `knowledge-suite` 作为插件 ID。首次启用前，请关闭旧的 Excalidraw/Knowledge Map 版本，避免两个插件同时注册相同功能。

### 手动安装

如果不使用整合包，也可以从同一 Release 的 Assets 下载 `main.js`、`manifest.json` 和 `styles.css`，放入 Vault 根目录下的：

```text
.obsidian/plugins/knowledge-suite/
```

## 文档

- [功能概览](docs/FEATURES.md)
- [安装和升级](docs/INSTALL.md)
- [架构说明](docs/ARCHITECTURE.md)
- [测试清单](docs/TESTING.md)
- [发布流程](docs/RELEASE.md)
- [常见问题](docs/TROUBLESHOOTING.md)

## 兼容性与隐私

- 这是一个 **桌面端插件**，需要 Obsidian 1.8.7 或更高版本。
- 画布、地图和属性数据默认保存在本地 Vault 中。
- 插件不会要求联网才能使用核心画布与知识管理功能；只有用户主动使用对应的外部服务或导入功能时，才会访问相关资源。
- 升级时只覆盖插件目录中的 `main.js`、`manifest.json` 和 `styles.css`，不要删除插件数据文件或 Vault 中的画布文件。

## 开发

```bash
npm run install:suite -- --confirm
npm run verify:suite
npm run test:suite
npm run build:suite
npm run package:suite
```

构建结果会写入 `release/`；该目录是本地生成目录，不提交到源码仓库。

## 许可证与致谢

本项目以 [AGPL-3.0](./LICENSE) 发布。整合包中包含 Excalidraw Core、Excalidraw Plugin 和 Knowledge Map 的组件；其许可证与归属信息见 [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) 以及插件目录中的许可证文件。

问题反馈和功能建议请提交到 [GitHub Issues](https://github.com/Jack1445/obsidian-knowledge-suite/issues)。
