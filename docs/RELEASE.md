# 发布流程

## 版本原则

- Suite 使用 `suite-version.json` 中的 `suiteVersion`。
- Knowledge Suite 的 `manifest.json` 使用同一 Suite 版本。
- Core 版本记录在 `suite-version.json`，不作为用户安装项发布。

## 本地发布候选

```bash
npm run verify:suite
npm run test:suite
npm run release:suite
```

输出包括：

```text
release/artifacts/knowledge-suite/
release/knowledge-suite-vX.Y.Z.zip
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

- 一个 Knowledge Suite ZIP。
- 一个 Knowledge Suite 标准插件产物及许可证目录。
- SHA-256 校验文件。

旧插件仓库保留为只读上游历史，不再作为发布渠道。

