# 当前版本测试

正式源码：`cloudbase-dist/index.html`。构建：`node tools/build-cloudflare-pages.cjs`。自动回归以 `.github/workflows/verify-cloudbase-ui.yml` 为准。

`*-local.cjs` 中的业务写入测试仅用于本地 D1；`fxtt-online-readonly.cjs` 只读核验线上。旧离线版测试已移至 `archive/legacy/tests/`，不属于正式版本验收。
