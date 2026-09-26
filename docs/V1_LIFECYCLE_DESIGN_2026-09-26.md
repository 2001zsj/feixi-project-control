# V1.0 生命周期重构：第一阶段审查与执行结果

## 范围与结论

依据 `CODEX_HANDOFF_2026-09-26.md`，第一阶段完成只读数据冻结、现状审查、接口设计和分批验收计划。尚未修改产品页面、生产表、远程队列或部署配置。

审查结论：采用统一状态层、动作层的方向；调整实施顺序，先修复未同步修改保护，再抽离状态层，之后迁移跨模块动作。不能只包一层函数名而保留各入口任意 patch。

源码基线：`cloudbase-sync-v1` / `163e0b8867a12e5b0396d392a10dc5552d803cfa`。指定的两个交接提交已在该分支。开发副本在用户配置目录，未向业务资料目录放入技术文件。

## 1. 已执行的数据冻结

冻结指保存审查快照，不是停用用户写入、锁生产库或把数量写死在业务代码中。

- 环境：`zsj1314-d9ger6ak4a25a8717`。
- 读取：`feixi_stations` 全行（分页）及 `feixi_meta` 全行。
- 采集结束：2026-09-26 23:20:48 北京时间。
- 两次完整读取逐字比较一致；这是稳定读取证据，不是数据库事务快照或 PITR 备份。
- 76 行、76 个唯一 ID；行 ID 与内嵌站点 ID 全部一致；meta 1 行。
- 当前模块：选址 9、疑难 18、待立项 11、施工 11、完工 27。
- SHA-256：`99049a9edbc3c5aa6c6a1cc798dcc5b6ebeccd049ee763ea5f8510b250805a11`。
- 原始 JSON 保留完整站点、revision、updated_at、updated_by、undo、redo、历史项目、命令回执及元数据；不保存认证令牌。
- 文件：`audit-evidence/phase-a/2026-09-26T15-20-48-385Z/snapshot.json`，同目录有 `manifest.json` 和 `validation.json`。由既有 `.gitignore` 排除，不向公开仓库提交业务快照。

| 站点 ID | 当前 revision | 已核对事实 |
|---|---:|---|
| design-2026-047 | 2 | 09-22 进场、09-23 浇筑，09-26 状态为养护中 |
| design-2026-066 | 2 | 09-24 进场，实际浇筑及装塔为空，阶段待浇筑 |
| design-2026-022 | 3 | 待立项，旧编码 26A09AHHF011005046 在历史；最新人工进展“重新立项”保留 |
| design-2026-071 | 1 | 蓬莱路与站前路交口东南，09-22 实际浇筑保留 |

三条队列命令均有回执及撤销快照。完整快照校验和直接执行共享版真实函数的 11 项检查通过。没有执行生产并发写入、撤销或页面刷新测试，不能把这 11 项称为完整产品验收。

## 2. 现状审查与优先级

以下位置均以基线 `cloudbase-dist/index.html` 为准。

### P1：保存失败仍可被误报为成功，待同步本地数据缺少持续保护

`queueCloudSync`（207–223 行）普通异常只提示错误，finally 在 ready 且队列为空时仍显示“云端已同步”。`cloudRefresh`（224–264 行）只检查 pending/syncing/conflict，没有持续的 dirty 标记：之后收到远程站点变化时会替换本地站点。现有本地缓存因此不足以保护失败写入。此项已通过静态路径审查，另见隔离复现脚本与记录；未向生产写入测试数据。

设计修正：dirty/outbox 是每站显式状态；成功 CAS 并确认后才能清除。失败后保留原始 baseRevision、命令及候选 bundle。刷新对 dirty 站只更新 remoteShadow 并暴露冲突，不能自动替换。状态采用“待同步/同步中/失败/冲突/已同步”，禁止 finally 无条件恢复成功。

### P1：正常启动仍依赖旧迁移且可能阻止云端读取

`load`（1349–1377 行）先跑旧迁移并保存，`boot`（2115 行起）必须 load 成功后才能 startCloud。旧缓存解析、75 站底册校验失败时会在连接云端前抛错。不能简单删除预设常量后继续沿用启动顺序。

设计修正：云端优先读取；损坏/过时缓存隔离备份后不能阻止云端连接。只有结构校验，不在正常启动、刷新、渲染时应用 SEED 或历史业务修正。离线缓存明确只读或进入显式 outbox；未知来源旧数据走独立导入/迁移工具。云端全量、刷新均校验行 ID 与 station.id 一致。固定 ID 清单从已验收 roster 分离出来，不再靠 SEED 业务字段提供底册。

### P1：撤销、幂等和项目归属需要一起设计

当前 CI 在 `.github/workflows/apply-cloudbase-updates.yml` 内自己实现 patch、历史和 undo；浏览器另有远程执行函数及表单直接写字段。回执截断为最近 100 条，不能支持无限期保留队列后仍保证不重放。撤销当前站点全量快照若跨越别人的后续改动，也可能删除合法事实。

设计修正：业务动作纯计算；持久化层一次 CAS 写入同一站点 bundle 的事实、undo、redo、command receipt，成功后 revision + 1。队列命令转换为显式类型，不再允许任意字段路径。已处理 v1 命令保留兼容与回执，不重放、不重写历史队列。回执不静默截断；将来压缩必须与归档队列的不可重放保证同时实施。

撤销也是新命令，指向原 commandId，并校验原动作的 after 状态/项目实例仍匹配；不把 revision 倒退。撤销后保留原命令回执，避免 CI 又把动作做一遍。对旧无 commandId 的 undo，保留兼容，使用当前 revision 和预期快照校验，跨后续修改冲突时不得静默覆盖。

### P2：已有状态入口尚未统一，也不纯

`deriveStationState`（1536 行）已经存在，不能重复新增同名入口。其调用的 mainStage/scheduleMeta 使用全局 today 和日历；cloudModuleCounts 另写模块优先级。缺立项日期时 preEstStage 返回另一套文案；smartInsight 又计算风险/建议。应替换内部实现并逐步统一调用方，而非叠加一套 V1 状态。

### P2：旧验收及部署证据不能直接沿用

`tests/preset-safety.cjs` 硬编码根目录 `index.html` 及 75 站；其他旧套件也默认读根目录。旧套件绿不代表共享版验收。新增验收明确读 `cloudbase-dist/index.html` 和冻结快照。

GitHub deployment 6672301040 对 HEAD 返回 success，但环境是 Vercel Preview。仓库没有可确认的 CloudBase 静态 URL；当前未验证 CloudBase 线上字节是否等于 Git 内容。此项尚待实际使用网址，不能以 Vercel 成功替代。

## 3. 目标模型：先兼容读写，再按需迁移存储

保持现有 PostgreSQL 表和 station bundle，不立即把 76 站批量改为新 schema。

运行时规范模型为：

```text
Station
  id / 基础信息
  selection: done, doneDate, difficult, problem, followups
  currentProject: null | {instanceId, code, establishDate, actualNodes,
                         cureDays, pauses, activePause, constructionProblem}
  completion: confirmed, date
  priorProjects: 原历史项目数组（原样兼容）
  updates / 其他兼容字段

StationBundle
  station / undo / redo / appliedRemoteCommands / 后续带类型的命令回执

Row
  id / bundle / revision / updated_at / updated_by
```

首版 adapter 读取现有 flat 字段，编码时保留所有未知字段。不从 sourceRemark、currentStage、sourceSelectionStatus 或计划文字推断业务事实。已有 `completeConfirmed=true` 且日期空的站仍为完工，不补造日期。旧字段 currentNextAction/currentOwner/expectedFinish 原样保留，但不参与新状态计算或显示。

项目实例不能只靠项目编码标识：重立项需产生新 instanceId，动作携带预期项目实例，拒绝旧项目迟到指令误写新项目。旧项目实例先通过兼容 adapter 识别；写入新增 ID 时随真实业务动作保存，不批量改库。历史数组不按站名或项目编码模糊合并。

## 4. 状态层接口

```js
deriveStationState(station, {asOfDate, calendar})
// -> {module, stage, deadlines, overdue, paused, constructionProblem, dataIssues}
```

asOfDate 必须显式传入北京时间业务日期，calendar 为现有已配置大陆工作日日历。函数不读 Date.now/localStorage、DOM、网络，不修改 station。内部拆分 deriveStationModule、deriveConstructionStage、deriveOverdueState；网页、统计、导出和命令验证共享实现。

模块顺序固定：完工事实 → 当前有效项目 → 选址完成待立项 → 未选址完成且疑难 → 选址中。暂停及施工问题是施工项目属性，不创造第六个模块。`计划销项` 文案不能触发销项。

阶段按实际事实计算：已确认完工 → 完工；有效项目下以实际装塔/浇筑/进场进展计算，缺少早期日期列为 dataIssues，不让后补日期缺失把已完成的后序节点倒退。已装塔不再显示养护中。没有实际节点时为待进场；没有立项日期仅使工期未知，不能挡住实际进度。孤立的引电/配套只表示对应专业完成，不自动认定装塔或整站完成。

时间规则沿用现实现：立项日工作日计为第 1 天，48 个大陆工作日；进场期限立项后 7 个自然日，浇筑期限进场后 3 个自然日；养护 28/20 个自然日，20 必须人工选定；暂停仍计入 48 工作日。缺年度日历则工期 unknown，不能标正常。阈值沿用目前逻辑：剩余 <=6 工作日红色、7 日黄色；节点晚完成与当前未完成逾期分开返回，避免混为同一原因。

状态层不返回 action/next/下一步建议。错误提示和确需处理的冲突仍保留。

## 5. 动作层与持久化接口

```js
applyStationCommand(bundle, command, {businessDate, timestamp, calendar})
// -> {kind:'applied'|'duplicate'|'rejected', nextBundle?, event?, errors?}

commitStationCommand({stationId, expectedRevision, command})
// adapter: 读取 -> 纯动作 -> 单行 CAS -> 成功回执/冲突/待同步
```

command 包含 commandId、stationId、type、payload、expectedProjectInstance 和必要事实前置条件。timestamp 是操作记录时间，actualDate 是用户确认的事实日期，二者不能混用。纯动作不改数据库 revision、不直接同步云端；只有写入成功的持久化层递增 revision。duplicate 不写历史、不加 undo、不增 revision。

首批迁移：CONFIRM_ENTRY、CONFIRM_POUR、CLOSE_PROJECT、ESTABLISH_PROJECT、REESTABLISH_PROJECT、CONFIRM_COMPLETE、CORRECT_ACTUAL_NODE。随后覆盖选址、疑难、暂停恢复、引电配套、基础信息及跟进记录。网页表单、CI、导入各自只做输入解析，最终进入同一实现。

| 动作 | 前置条件 | 原子效果 |
|---|---|---|
| CLOSE_PROJECT | 当前项目存在；项目实例匹配；未完工 | 完整保存当前项目（含节点、暂停、施工问题和关联记录），清除当前项目所有活动事实及完成标记，保留选址完成，派生待立项；追加历史/undo |
| ESTABLISH_PROJECT | 已选址完成、无活动项目、编码非空 | 新建项目实例，记录编码；实际立项日期可未知，不能编造；派生施工中 |
| REESTABLISH_PROJECT | 当前无项目且存在已销项历史 | 与立项共用实现，新实例；不复用旧节点/暂停/问题 |
| CONFIRM_ENTRY/POUR | 当前项目实例匹配；有效实际日期 | 只写事实，生成业务事件和 undo；阶段和期限即时派生 |
| CONFIRM_COMPLETE | 有有效项目或显式历史纠正；用户确认完工 | 保存完成事实，不按专业节点齐全自动完工 |
| CORRECT_ACTUAL_NODE | 明确纠正原因、预期原值匹配 | 修改/清除指定实际节点；解除完工必须显式纠正；不连带清空其他节点 |

日期验证：严格合法日期、不得把计划自动当实际；浇筑与装塔不同日；进场与装塔可同日；引电可与装塔同日。缺进场仍录浇筑、提前装塔等现有人工确认场景返回需要明确确认的业务结果，不静默补齐、不一律禁用。对于未来实际日期返回待确认/拒绝，首批实现按“不接受未来 actual”保守约束，历史导入只报告异常不批量纠正。

并发冲突不自动用新 revision 重试旧候选对象；重新取回数据后重跑命令前置条件。对同一站的本地连续动作有序排队；失败前序不能被后序绕过。不同站独立保存。

## 6. 调整后的执行批次与验收

| 批次 | 修改范围 | 放行证据 |
|---|---|---|
| A（本次） | 只读快照、审查设计、共享版基线工具 | 76 唯一 ID、关键事实、哈希、11 项检查 |
| B0 | 保存失败/outbox、刷新互斥、云端优先启动、隔离迁移 | 网络失败后仍保留脏数据；远程变化不冲掉待同步修改；损坏缓存不阻止云端读取；刷新无业务改写 |
| B1 | 抽离纯状态函数并统一计数/导出/风险 | 76 站模块零意外变化；固定日期/日历测试；暂停、养护、缺日期、完工终态；各入口输出一致 |
| C | 跨模块业务动作及一站 CAS 适配 | 销项→待立项→重新立项→施工→完工；历史完整；原 ID 不变；重复命令不生效；冲突不覆盖 |
| D | 网页/CI/导入接入；清理旧 patch 路径 | 同命令通过三个入口得到相同 bundle；乱序和旧项目指令拒绝；undo/redo 与回执互不破坏 |
| E | UI 减法 | 工作台、列表、详情取消建议及无意义说明；必要风险提示仍可见；不恢复施工排程；空分区隐藏 |
| 发布 | 隔离测试环境后再验证线上 | 线上文件版本、刷新及第二设备、失败恢复、并发和撤销证据齐备 |

共享实现可放 `cloudbase-dist/lib/`，以浏览器原生模块/Node 可复用方式交付，不为此次重构引入框架或打包系统。全局函数保留短期 adapter，逐个迁移调用点后删旧实现。禁止仅更改根目录旧页面。

生产 76 站只能读验证；命令与冲突测试使用冻结数据的隔离副本/测试 adapter，不向生产构造假站或试验撤销。第二设备真实读取与线上加载仍需独立验收。正式开始下一批前重新读 revision 对照冻结快照；有真实更新则建立新快照，不能覆盖回本次数据。回退只回退代码；数据修正需使用最新 revision 的补偿动作，不整库灌回旧快照。

## 7. 复现命令

在仓库目录执行：

```powershell
node tools/freeze-cloudbase.cjs
$env:TZ='Asia/Shanghai'
node tests/cloudbase-baseline.cjs audit-evidence/phase-a/2026-09-26T15-20-48-385Z/snapshot.json
git diff --check
```

冻结脚本只对业务表发 GET；匿名认证会创建临时会话。不需要 API Secret。业务快照只保存在本机被忽略的证据目录。新采集时使用输出的新路径验收；本次固定计数与关键事实断言仅是审查基线，不是后续生产业务约束。
