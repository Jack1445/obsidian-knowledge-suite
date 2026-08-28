# 发布流程

## 版本原则

- Suite 使用 `suite-version.json` 中的 `suiteVersion`。
- 两个插件继续使用各自 `manifest.json` 的语义化版本。
- Core 版本记录在 `suite-version.json`，不作为用户安装项发布。

## 本地发布候选

```bash
npm run verify:suite
npm run test:suite
npm run release:suite
```

输出包括：

```text
release/artifacts/excalidraw-custom/
release/artifacts/knowledge-map/
release/obsidian-knowledge-suite-vX.Y.Z.zip
release/SHA256SUMS.txt
```

## 发布门槛

1. 自动测试通过。
2. 测试 Vault 部署通过。
3. 完成 `TESTING.md` 中的关键回归。
4. 用户确认验收。
5. 更新 `CHANGELOG.md`。
6. 才能提交、打标签和推送。

## 未来自动发布

GitHub Actions 将在整合版完成验收后加入。工作流应从同一源码提交生成：

- 一个 Suite ZIP。
- Excalidraw Custom 标准插件产物。
- Knowledge Map 标准插件产物。
- SHA-256 校验文件。

两个旧插件仓库届时只作为自动发布渠道，不再手动编辑源码。

