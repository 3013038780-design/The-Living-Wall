# Lint 基线

本仓库用 `oxlint`（`npm run lint`）做静态检查。

## 刻意豁免

- `components/ui/**`：shadcn/ui 生成组件。上游模板含 role/a11y 与 template 写法，改动易在下次 `shadcn add` 时被覆盖，因此在 `.oxlintrc.json` 的 `ignorePatterns` 中豁免，不逐文件改写。
- 应用代码（`app/`、`lib/`、`hooks/`、`tests/` 等）仍须通过 lint；新增应用错误不因 UI 豁免而放过。

重新生成或升级 shadcn 组件后，无需为 UI 目录单独修 lint；若应用侧引入同类问题，应在应用代码中修复。
