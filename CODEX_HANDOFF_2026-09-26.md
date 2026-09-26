# Codex 开发交接 — 肥西新建站推进系统

更新时间：2026-09-26（北京时间）  
后续开发负责人：**Codex**  
仓库：`2001zsj/feixi-project-control`  
继续开发分支：`cloudbase-sync-v1`

> 本文件是 2026-09-26 起的最新开发交接文件。  
> `PROJECT_HANDOFF.md` 与 `PROJECT_STATE_2026-09-19.json` 仅保留历史背景，凡与本文件、CloudBase 当前数据库、用户最新明确指令冲突，以本文件和用户最新指令为准。

---

## 1. 当前产品定位

这是肥西新建站推进控制台，不做通用项目管理，不追求功能多。

核心目标只有三个：

1. 一眼知道每个站现在在哪个业务阶段。
2. 实际节点录入后，模块、阶段、逾期、历史自动联动。
3. 同一个站从选址到完工始终是一条记录，不因阶段变化复制站点。

用户当前最不满意的是：**模块之间连通性不足，像几个页面拼在一起。**

因此后续开发主线不是继续打局部补丁，而是做 **V1.0 生命周期/动作引擎重构**。

---

## 2. 用户最新 UI 取舍（必须执行）

### 2.1 删除无意义的小字

用户明确要求：

- 不要再堆说明性灰色小字、提示语、解释性 microcopy。
- 能通过字段名、状态、按钮表达的，不再额外解释。
- 页面要紧凑、高信息密度。

处理原则：

- 删除/隐藏辅助说明、重复解释、长提示。
- 风险提示只在真的需要用户处理时出现。
- 不要为了“显得完整”增加文字。

### 2.2 删除“下一步建议”

用户明确说“下一步建议没啥用，会造成系统臃肿”。

因此 V1.0：

- 不再自动生成“下一步建议”。
- 不在工作台、详情页、模块列表展示“下一步建议”。
- `currentNextAction` / `currentOwner` / `expectedFinish` 等旧字段暂时保留兼容，不要为了删除 UI 破坏旧数据，但不应继续作为核心模型。
- 如果未来确有人工待办需求，单独设计“事项/待办”，不要混进站点状态计算器。

### 2.3 顶部模块

当前应保留：

- 工作台
- 选址中
- 疑难站址
- 待立项
- 施工中
- 完工站
- 大陆日历

**“施工排程”已经取消，不得恢复。**

---

## 3. 当前数据源与生产架构

### 3.1 CloudBase

环境 ID：

`zsj1314-d9ger6ak4a25a8717`

当前共享数据库：CloudBase PostgreSQL。

表：

`public.feixi_stations`

- `id text PRIMARY KEY`
- `data jsonb NOT NULL`
- `revision bigint NOT NULL DEFAULT 1`
- `updated_at timestamptz`
- `updated_by text`

`public.feixi_meta`

- `id text PRIMARY KEY`
- `data jsonb`
- `revision bigint`
- `change_seq bigint`
- `updated_at timestamptz`
- `source_exported_at timestamptz`

匿名用户对两表已配置 RLS / CRUD 权限。

匿名登录 REST 调用需要请求头：

`x-device-id`

不要使用或提交 CloudBase API Secret。

### 3.2 浏览器

旧本地数据键：

`feixi-v072-state`

localStorage 只应作为：

- 本地缓存
- 云端写入失败时的临时保护
- 冲突/恢复辅助

**CloudBase PostgreSQL 才是多人/多设备共享数据源。**

### 3.3 当前静态版本

主要开发文件：

`cloudbase-dist/index.html`

不要只改仓库根目录旧 `index.html` 然后以为 CloudBase 已更新。

---

## 4. 当前站点总量与模块状态

当前总量固定：**76 站**。

在 2026-09-26 最新三个远程命令已写入后，当前预期模块数量：

- 选址中：9
- 疑难站址：18
- 待立项：11
- 施工中：11
- 完工站：27

合计：76。

> 旧的 75 站、16/12/7/13/27、17/11/9/12/27 等统计均已过时，不得恢复。

最初 76 站正确迁移基线是用户 2026-09-26 00:41 左右导出的完整备份，迁移时模块数为：

- 9 / 18 / 10 / 12 / 27

之后“珠光紫蓬产业园”转待立项，因此变为：

- **9 / 18 / 11 / 11 / 27**

---

## 5. 2026-09-26 已确认并已写入 CloudBase 的三条更新

远程队列：

`cloudbase-dist/remote-updates.json`

### design-2026-047 — 肥西聚星路与四合路交口东北

确认：

- 进场/定位放线：2026-09-22
- 桩基浇筑：2026-09-23
- 当前阶段：养护中

### design-2026-066 — 肥西丰乐镇滨河苑小区

确认：

- 进场/定位放线：2026-09-24
- 当前阶段：待浇筑

原 09-28 浇筑、10-28 装塔仅为计划，不能写成实际节点。

### design-2026-022 — 珠光紫蓬产业园

用户明确要求：“放到待立项里面”。

已处理：

- 原活动项目编码 `26A09AHHF011005046` 清出当前项目
- 原项目归入历史项目
- 当前模块：待立项
- 当前阶段：待立项
- 原施工问题标记清除
- 等待重新立项

该动作不是简单“改 module 字段”，而应语义化为 **项目销项 → 旧项目归档 → 回到待立项**。

### 远程命令执行状态

GitHub Actions 最终成功执行：

workflow run：`36172267565`

日志明确返回：

- SKIP already applied: design-2026-047 命令
- SKIP already applied: design-2026-066 命令
- SKIP already applied: design-2026-022 命令

说明三条命令的 `appliedRemoteCommands` 已存在于 CloudBase 站点记录。

---

## 6. 远程自动落库链路

当前已建立：

`cloudbase-dist/remote-updates.json`
→ GitHub Actions
→ CloudBase 匿名认证
→ PostgreSQL REST
→ `feixi_stations`

Workflow：

`.github/workflows/apply-cloudbase-updates.yml`

当前成功方式不是浏览器模拟，而是直接调用 CloudBase gateway。

匿名认证：

`POST https://<envId>.api.tcloudbasegateway.com/auth/v1/signin/anonymously`

必须带：

`x-device-id: feixi-github-actions-sync-v1`

然后通过：

`/v1/rdb/rest/feixi_stations`

读写。

更新时使用：

- station id 精确匹配
- `revision` 乐观锁
- `appliedRemoteCommands` 幂等
- undo snapshot
- expected 前置条件

### 重要：不要重新引入“页面必须开着才能执行远程命令”

以后远程命令应该由 CI / 服务端直接落库，网页只负责读取 CloudBase。

---

## 7. 当前网页云端刷新机制

最新代码提交后：

- CloudBase 常规刷新间隔已改为 15 秒
- 页面重新获得焦点时立即刷新
- 顶部新增“↻”立即刷新按钮
- 浏览器不再负责去 GitHub 拉远程队列

相关提交：

`86462a8c235e800e1c72119ec55a5c04db5c2913`

注意：该提交的 CloudBase 静态部署是否已经完成，交接时**没有最终验收确认**。Codex 开始前应先确认线上部署版本与 Git 分支 HEAD 一致。

---

## 8. V1.0 必须解决的根本问题：模块连通性

当前旧逻辑大致是：

`complete → 有项目编码=building → selectionDone=pending → difficult → selection`

这种字段优先级逻辑容易造成：

- 文案写着销项，但项目编码仍在，站点仍留施工中
- 字段改了但模块没变
- 模块变了但历史没归档
- 页面人工修改、远程更新、Excel 导入各有一套修改方式
- 同一业务动作需要同时手改多个字段

### V1.0 目标

模块不再是独立业务容器。

**76 个站只有一份站点数据，模块全部只是站点生命周期的视图。**

推荐模型：

`站点基础信息 → 选址状态 → 当前项目 → 历史项目`

当前项目内部：

- 项目编码
- 立项日期
- 进场
- 浇筑
- 装塔
- 引电
- 配套
- 完工
- 暂停
- 施工问题

历史项目独立保存。

---

## 9. 统一状态计算器

必须逐步收敛为一个入口，例如：

`deriveStationState(station)`

它负责计算：

- module
- 当前阶段
- 是否节点逾期
- 是否48天超期/高风险
- 暂停状态
- 当前施工问题状态

不再让每个页面各算一遍。

### 模块判定原则

业务事实优先，不允许 UI 自己写死 module。

基本思路：

1. 完工事实成立 → 完工站
2. 有当前有效项目 → 施工中
3. 选址完成、无当前有效项目 → 待立项
4. 选址未完成 + 疑难标记 → 疑难站址
5. 其他未完成选址 → 选址中

**项目销项**属于业务动作，不是把 module 改成 pending。

---

## 10. 统一动作引擎

建议建立唯一动作入口，例如：

`applyStationCommand(station, command)`

网页人工修改、远程命令、后续导入都尽量调用同一套业务动作。

建议命令集合：

- MARK_DIFFICULT
- CLEAR_DIFFICULT
- CONFIRM_SELECTION
- START_PROJECT / ESTABLISH_PROJECT
- CONFIRM_ENTRY
- CONFIRM_POUR
- CONFIRM_TOWER
- CONFIRM_POWER
- CONFIRM_SUPPORT
- CONFIRM_COMPLETE
- PAUSE_CONSTRUCTION
- RESUME_CONSTRUCTION
- CLOSE_PROJECT
- REESTABLISH_PROJECT
- CORRECT_ACTUAL_NODE

### 示例：CONFIRM_POUR

输入：

- stationId
- date

系统自动：

- 写 `pourDate`
- 根据事实算到“养护中”
- 更新 lastUpdate
- 写进展历史
- 保存 undo
- revision + 1
- 重新计算逾期
- 云端同步

不要再让调用方同时 patch `pourDate + currentStage + currentSituation + lastUpdate`。

### 示例：CLOSE_PROJECT

系统自动：

- 当前项目完整归档
- 清活动项目编码
- 清活动施工节点
- 保留选址完成事实
- 转为待立项
- 保存历史/undo
- 不丢原项目

---

## 11. 当前业务硬规则

- 有当前有效项目编码 = 当前项目已立项。
- 无当前有效项目编码 = 当前项目未立项。
- 选址完成 + 无当前有效项目 = 待立项。
- 完工站为终态，除非用户明确纠正。
- 实际节点不能由计划日期自动生成。
- 立项后 48 个工作日内完成。
- 立项后一周内进场。
- 进场完成后 3 天内完成浇筑。
- 养护一般 28 天，夏季可 20 天。
- 进场与装塔可同一天。
- 浇筑与装塔不能同一天。
- 引电可与装塔同步。
- 配套不得超过总施工周期。
- 暂停信息要记录原因、开始/恢复时间；是否从48天扣除仍按当前既有规则处理，不要擅改。
- 计划日期只能作为计划，不得写进 actual node。
- 站名不得模糊合并。
- `观澜天下`、`观澜天下北`、`观澜天下东南角` 是不同站，严禁合并。

---

## 12. 数据保护要求

必须保留：

- 76 站唯一 ID
- station-level revision
- undo / redo
- `priorProjectHistory`
- `appliedRemoteCommands`
- localStorage 兼容
- CloudBase 共享数据
- 精确 ID 匹配

禁止：

- 用 SEED 覆盖当前 CloudBase 数据
- 清空 localStorage
- 根据旧表重新推断所有站状态
- 根据计划日期补实际日期
- 模糊匹配站名后直接写入
- 因重构删除历史项目
- 因 UI 精简删除业务事实

---

## 13. 旧代码中已知需要重点清理的区域

旧 `cloudbase-dist/index.html` 里仍存在历史迁移常量/逻辑，例如：

- `DIFFICULT_PRESET_IDS`
- `OLD_WRONG_DIFFICULT_IDS`
- `LATEST_BASE_PRESET_IDS`
- 旧 migration / normalization

这些代码可能把最新人工状态拉回旧状态。

V1.0 应：

1. 先确认 CloudBase 76 站当前数据。
2. 把一次性迁移逻辑与正常运行逻辑彻底拆开。
3. 迁移完成后不允许 startup 再自动“纠正”用户当前状态。
4. SEED 只用于首次安装/灾难恢复，不能参与日常状态归一化。

---

## 14. 页面重构方向

页面不用追求大改视觉，而是减少噪音、提高连通性。

### 列表

优先显示：

- 运营商
- 需求站名 / 铁塔站名
- 当前阶段
- 当前真实问题/状态
- 关键实际节点

不要塞：

- 长篇说明
- 下一步建议
- 系统教学文字
- 重复的业务解释

### 详情

分区建议：

1. 基础信息
2. 当前业务状态
3. 当前项目实际节点
4. 暂停/施工问题（仅有时显示）
5. 历史记录 / 历史项目

没有内容的分区尽量不显示。

---

## 15. Codex 第一阶段任务建议

不要一次性重写整页。建议按以下顺序：

### Phase A：冻结并验收数据

- 从 CloudBase 读取 76 站。
- 验证唯一 ID。
- 验证模块合计 76。
- 验证 047 / 066 / 022 三条最新事实。
- 备份当前 DB 状态。

### Phase B：建立纯函数状态层

新增/抽离：

- `deriveStationModule`
- `deriveConstructionStage`
- `deriveOverdueState`
- `deriveStationState`

先不改 UI，写测试覆盖典型站。

### Phase C：建立 command/action 层

把：

- 项目销项
- 重新立项
- 实际进场
- 实际浇筑
- 完工

先改成统一 action。

优先迁移最容易出错的跨模块动作。

### Phase D：所有入口改走动作层

- 网页按钮
- 表单保存
- remote-updates
- 后续 Excel 导入

逐步禁止任意散落 patch。

### Phase E：UI 减法

- 删除说明性小字
- 删除“下一步建议”
- 清理重复卡片
- 保留紧凑状态和操作

---

## 16. 最低验收用例

Codex 每次阶段性交付至少验证：

1. 76 站不增不减。
2. 任意站只有一个模块。
3. 9/18/11/11/27 为当前重构前参考快照；如果用户后续修改，以最新事实为准。
4. 珠光紫蓬产业园在待立项，旧项目编码可在历史项目找到。
5. 聚星路 09-22 进场、09-23 浇筑，当前养护中。
6. 滨河苑 09-24 进场，浇筑日期仍为空。
7. 蓬莱路与站前路交口东南 09-22 浇筑信息保留。
8. 刷新页面后 CloudBase 数据不回退。
9. 第二设备打开可读到同一份数据。
10. 并发修改同一站时 revision 不能静默覆盖。
11. undo 能撤回人工/远程业务动作。
12. 计划日期绝不进入实际节点。

---

## 17. 当前关键提交

近期关键提交：

- `112b401976e26d0848dbab810930a94666158ecb` — 修复 CloudBase SDK CDN
- `af1ca65d84ab7cb2986b79f6e5053c5a40c5e00e` — 切换 PostgreSQL RDB
- `91c29a79476860bf7cc719cf8a26a639a04722cb` — 远程更新队列初版
- `13435f3ac810069e405ca12b2bc8ff3c35072c9b` — 珠光紫蓬产业园转待立项命令
- `77575c27a0454ff60608899714d08c4f8b336f4d` — GitHub Actions 改直连 CloudBase PostgreSQL
- `50831b93d531534e9ac150502a2f1051844e6614` — 匿名登录补 x-device-id
- `552886ce9c1ff910a728ae8d6b929387450a1596` — 自动落库成功验证
- `86462a8c235e800e1c72119ec55a5c04db5c2913` — 网页15秒云端刷新 + 手动刷新按钮

---

## 18. Codex 接手时的第一句话

建议直接给 Codex：

> 继续接手“铁塔”项目——肥西新建站推进系统。GitHub 仓库：2001zsj/feixi-project-control，继续在 cloudbase-sync-v1 分支。先完整阅读 CODEX_HANDOFF_2026-09-26.md，再读取当前 CloudBase 76 站状态。不要以旧 PROJECT_HANDOFF.md 的 75 站数据作为当前基线。第一阶段先做数据冻结与 V1.0 生命周期重构设计，不要直接大改 UI。

---

## 19. 开发责任移交

从本文件提交后，**Codex 负责后续开发、代码修改、测试、CloudBase 同步链路维护和部署验证**。

本次交接的重点不是让 Codex“继续修补现有页面”，而是：

**在保住 76 站数据、CloudBase 共享、历史/撤销、远程自动落库的前提下，把系统重构为一个真正连通的站点生命周期控制台。**
