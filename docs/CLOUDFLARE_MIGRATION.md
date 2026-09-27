# Cloudflare 免费版迁移

## 2026-09-28 新增站点与手机端更新

发布版本 `2026-09-28-create-mobile-1`。工作台与各站点模块提供“新增站点”，运营商和需求站名必填，其他字段可后补；默认选址中，后续通过原有生命周期动作流转。创建时不补写任何实际施工节点，跟进时间从新增时开始。

新增接口 `/api/stations` 沿用团队会话和同源检查。稳定请求UUID与创建资料指纹支持超时重试；条件INSERT在数据库内检查同运营商精确站名、非空订单号、非空站址编码，站数与插入在同一D1批次更新。没有使用模糊站名合并。新增草稿保存在当前浏览器，收到服务端确认且刷新成功后才清除。

读取与修改已改为实际记录集合，adapter遍历游标分页，不再受76站或单页100站限制。其他设备在手动刷新或返回页面时可获取新站；仍无持续数据库轮询。现有站点版本、历史和未同步修改保留。完整备份恢复要求与当前实际站点ID集合相符，避免旧76站备份抹去后来新增的站点。

手机端触控按钮、输入字号、单/双列资料表单、粘性保存区、窄屏输入和卡片拖拽已优化；编辑中的表单不会被云端刷新重绘。保留卡片默认展开，工作台不增加拖拽。模块排序继续按原有规则保存在当前浏览器，不冒称跨设备共享排序。

验证：本机D1并发、重试、分页、保存、断网恢复通过；Chrome触摸模拟、桌面/平板独立会话与WebKit HTTPS通过。线上只读验收覆盖Chrome1440/768/390/320和WebKit390，原有76站数据及版本与迁移快照一致，无正式测试站。实体手机、独立4G/5G及不同运营商网络尚无实测证据。旧远程命令自动落库迁移仍是此前单独遗留事项，本次不宣称已完成。

当前使用入口：https://fxtt-feixi.pages.dev/ 。2026-09-28 在本机 Chrome 显式设置 `--no-proxy-server`，完成团队码登录、76站读取、历史/版本逐行比对和Excel下载；curl `--noproxy "*"` 返回 HTTP 200。此证据仅代表当前网络，不保证所有地区运营商均可用。原 workers.dev 地址本机直连超时，不再作为推荐入口。

Pages 使用同一 Worker 代码和同一个 D1 绑定，不复制数据库，也不从浏览器跨域调用 workers.dev。`_routes.json` 强制全部请求先经过鉴权；已验证未登录直接请求 index.html/adapter.js 只返回登录页，数据库接口返回401。团队码保持不变。Pages 官方部署方式参考 https://developers.cloudflare.com/pages/functions/advanced-mode/ 。

Pages 发布命令（从仓库根目录开始）：
```
node tools/build-cloudflare-pages.cjs
cd cloudflare/pages
npx wrangler pages deploy --branch cloudbase-sync-v1
```
首次配置需要通过 `wrangler pages secret bulk` 为生产项目 fxtt-feixi 设置 APP_PASSWORD 和 SESSION_SECRET；不得将密钥提交仓库。

当前生产代码仍以 cloudbase-dist/index.html 为功能源。执行 `node tools/build-cloudflare.cjs` 生成 Cloudflare 页面和共享规则，部署前必须重新构建。

- Worker: fxtt；D1: fxtt。运行配置在 cloudflare/wrangler.jsonc。
- 页面和 API 均需团队共用访问码，不要求每人注册账号。HttpOnly 会话保存 30 天。
- 访问码与会话密钥保存在 Cloudflare Secrets，本地 secret 文件、生成页面和业务快照不提交 Git。
- 无持续数据库轮询；加载页面、手动刷新、回到页面且距上次检查超过一分钟时读取，修改立即写入。
- 沿用逐站版本条件更新、持久待同步备份、历史撤销和日期验证。
- SQLite 中保存原有站点 JSON、undo/redo、远程命令回执和 revision，迁移不重置业务历史。
- 首次导入源为 2026-09-27T06-17-38-168Z 的已核验备份：76 站，选址9/疑难18/待立项11/施工11/完工27。用户于迁移前确认停服后无修改或未同步记录。原 CloudBase 当前仍返回隔离/限流，不能声称已取得停服瞬间快照。
- 导入脚本使用 INSERT，无覆盖/替换逻辑；重复导入应报错。不得对正式库直接重复执行。

部署：
```
node tools/build-cloudflare.cjs
npx wrangler deploy --config cloudflare/wrangler.jsonc
```

验证：既有 tests/*.cjs 回归；本机 D1 启动后执行 tests/cloudflare-local.cjs（只使用固定 localhost 地址，写入测试数据后恢复内容）；浏览器检查登录、76站、导出、刷新和版本冲突。线上验证以读取和导出为主，不写入模拟业务。

远程更新：迁移后不能继续向旧 CloudBase 写入。旧 GitHub 自动写入工作流只在显式将 FXTT_DATA_BACKEND 设置为 cloudbase 时执行。Cloudflare 批量更新应先在本地校验业务规则，再通过带版本条件的接口或受控脚本执行。

密码轮换：通过 wrangler secret put APP_PASSWORD 更新；同时轮换 SESSION_SECRET 可使全部现有会话失效。

2026-09-28 验证记录：
- 已部署 https://fxtt.fxtt-feixi.workers.dev ，发布版本 2026-09-28-cloudflare-1。
- 通过 SOCKS5 远端 DNS 的真实浏览器验证：团队码登录、76站、五模块计数9/18/11/11/27、无定时轮询、Excel下载正常。
- 线上只读逐行对比 id/data/revision/updated_at，与迁移快照一致，data 包含完整历史和命令回执。旧库额外列 updated_by（均空）、meta.change_seq/source_exported_at 未映射到新表；原始快照保留。
- 本机真实 D1 已验证保存、刷新后读取、撤销、版本冲突、未登录与跨站请求拦截。
- 当时本机直接访问 workers.dev 出现 DNS/TLS 故障，代理访问成功。随后新建 Pages 入口并完成上述直连验证；旧 Vercel 跳转入口尚未切换。
- Cloudflare 远程命令自动落库流程尚未接通，原命令回执已保留。后续接通前不得声称完整替代旧自动化。
