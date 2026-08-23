# 开发说明

## 环境要求

- Windows、macOS 或 Linux
- Node.js 22 或更高版本
- npm 10 或更高版本
- Yarn 1.22.x（用于 Excalidraw Core）
- Git

## 首次安装

依赖安装可能访问网络，因此脚本要求显式确认：

```bash
npm run install:suite -- --confirm
```

它按顺序执行：

1. Core：`yarn install --frozen-lockfile`
2. Excalidraw Custom：`npm ci`
3. Knowledge Map：`npm ci`

不要执行 `npm audit fix --force` 或任意自动依赖升级，这可能改变 Excalidraw、React、图片和字体加载行为。

## 常用命令

```bash
npm run verify:suite   # 核对版本、许可证和关键定制源码
npm run test:suite     # 测试三个组件
npm run build:suite    # 构建 Core 和两个插件
npm run package:suite  # 从已构建目录生成发行包
npm run release:suite  # 构建后立即打包
```

## 部署到测试 Vault

先进行只读预演：

```bash
npm run deploy:test -- --vault "D:\path\to\vault" --dry-run
```

确认路径后执行：

```bash
npm run deploy:test -- --vault "D:\path\to\vault"
```

部署前，脚本会把目标插件原有的三个程序文件备份到：

```text
.obsidian/plugins/.knowledge-suite-backups/<时间戳>/
```

脚本不会复制或删除 `data.json`。

## 开发原则

- 通用文本、公式和渲染能力优先修改 Core。
- Obsidian 画布生命周期和文件交互修改 Excalidraw Custom。
- 文件夹语义、知识节点和地图管理修改 Knowledge Map。
- 每轮修改先在测试 Vault 验收，再提交和发布。
- 不直接修改构建产物；构建产物必须由源码生成。

