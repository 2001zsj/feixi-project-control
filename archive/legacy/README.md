# 历史离线版归档

此处保留原根目录离线页面及其四个历史测试，只用于追溯和旧数据恢复。历史测试中的 75 站等断言不是正式系统基线。

当前页面源码为 `cloudbase-dist/index.html`，由 `tools/build-cloudflare-pages.cjs` 构建到 Cloudflare Pages；当前回归测试位于 `tests/`。请勿将本目录作为部署入口。

已知历史测试问题：`preset-safety.cjs` 的固定 75 站断言与归档页面中的 76 条种子不一致（13/14 通过），其 localStorage mock 也缺少 removeItem。保留原始断言用于追溯，不代表当前版本测试失败或通过。
