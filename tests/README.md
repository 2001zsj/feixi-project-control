# 审计回归

在仓库根目录使用 PowerShell：

```powershell
$env:TZ='Asia/Shanghai'
node tests/audit.cjs
node tests/preset-safety.cjs
node tests/browser.cjs
node tests/daily-tools.cjs
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" tests/export_audit.py
git diff --check
```

- audit.cjs：直接提取 index.html 实际脚本，语法编译完整脚本，在隔离 VM 内执行真实函数和事件处理器；日期固定为2026-09-20，测试输入不写入生产浏览器。
- browser.cjs：用独立 Chromium context、Asia/Shanghai 时区和本机8766端口临时HTTP服务验证界面与真实下载；结束关闭。默认使用 Codex bundled Playwright，可用 PLAYWRIGHT_PATH 指定已安装的模块。需要本机 Chrome。不得指向生产浏览器的用户数据目录。
- export_audit.py：只读解压下载文件并用 openpyxl 验证，不创建或改写工作簿。
- AUDIT_HTML 可指定原版 index.html 复现修复前问题，AUDIT_RESULT 可指定结果文件名。非当前版本可能缺少测试函数，不能把这些版本差异计为同一漏洞。
- 可将 TZ 设为 UTC / America/New_York 验证日期运算（日期固定，时区独立）。
- `pending-migration-observations.json` 保留第一轮历史失败证据；本次修复后的14项专项回归在 `preset-safety-results.json`，旧函数已隔离为私有候选生成器，测试通过真实 load 路径覆盖首次/部分/重复迁移和写入失败。
- `audit-evidence/*.xlsx` 是测试导出，截图和JSON是审计证据；不是新增业务底册。
