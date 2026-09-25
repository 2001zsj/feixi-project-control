# CloudBase PostgreSQL 共享版部署说明

环境：`zsj1314-d9ger6ak4a25a8717`

## 当前架构

- 静态站点：CloudBase 静态网站托管
- 数据库：CloudBase PostgreSQL
- 前端 SDK：CloudBase JS SDK v3
- 鉴权：匿名登录（用户无需输入账号密码）
- 共享表：
  - `public.feixi_stations`
  - `public.feixi_meta`

## 数据基线

首次正式初始化只接受已确认的 76 站完整备份，迁移时模块数量必须为：

- 选址中：9
- 疑难站址：18
- 待立项：10
- 施工中：12
- 完工站：27

初始化完成后模块数量可以随业务正常变化，不再锁定上述数量。

## 同步与冲突保护

- 每个站点独立存储为一行，避免整库覆盖。
- 同一站点通过 `revision` 乐观锁防止多人静默覆盖。
- 每 60 秒批量检查站点 revision；发现变化后只读取变化站点。
- localStorage 保留本机缓存及云端覆盖前回退副本。
- 云端冲突时不覆盖云端，当前修改保留在本机，并提示先下载完整备份。

## 安全

- 前端不使用 API Key / SecretKey / service_role 凭据。
- 匿名会话使用 `anon` 角色。
- 数据库启用 RLS，`anon` 对两张业务表按既定共享模式读写。
- 网址不要公开传播；当前产品明确不做账号与权限体系。

## 部署

CloudBase Git 部署分支：`cloudbase-sync-v1`

静态构建产物目录：`cloudbase-dist`
