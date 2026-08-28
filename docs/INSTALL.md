# 安装与升级

## 首次安装整合包

1. 关闭 Obsidian，或至少关闭 Knowledge Map 与 Excalidraw 插件。
2. 下载 `obsidian-knowledge-suite-vX.Y.Z.zip`。
3. 将压缩包内容解压到 Vault 根目录。
4. 确认下面两个目录存在：

```text
.obsidian/plugins/knowledge-map/
.obsidian/plugins/obsidian-excalidraw-plugin/
```

5. 启动 Obsidian。
6. 在“设置 → 第三方插件”中启用 Excalidraw 和 Knowledge Map。

## 从旧版本升级

升级包只应覆盖以下文件：

```text
main.js
manifest.json
styles.css
```

不要删除或覆盖 `data.json`。它保存插件设置。

## 升级后检查

- 打开普通 Excalidraw 画布，确认图片和字体正常。
- 打开 Knowledge Map，确认文件夹可以下钻。
- 测试行内公式的插入和二次编辑。
- 测试选中文字后 `Ctrl+B`，退出编辑后粗体仍然存在。
- 检查原有知识地图布局是否保留。

## 回退

如果通过开发脚本部署，旧程序文件位于：

```text
.obsidian/plugins/.knowledge-suite-backups/
```

关闭两个插件后，将对应时间戳目录中的文件复制回插件目录即可。用户的 `data.json` 和画布文件无需回退。

