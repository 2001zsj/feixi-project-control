# CloudBase 共享数据配置（V0.9.3-CB1）

环境 ID：`zsj1314-d9ger6ak4a25a8717`

当前 CloudBase 正式测试入口仍建议先使用 `cloudbase-migration` 分支。
共享数据代码已单独准备在 `cloudbase-sync-v1` 分支，数据库配置完成后再切换部署分支。

## 1. 开启匿名登录

CloudBase 控制台 → 登录授权 / 身份认证 → 开启“匿名登录”。

用户无需看到登录页，也无需注册账号；网页会在后台自动获得匿名身份。

## 2. 配置 Web 安全域名

CloudBase 控制台 → 环境配置 → 安全配置 → Web 安全域名。

添加：

`zsj1314-d9ger6ak4a25a8717-1496070976.tcloudbaseapp.com`

## 3. 创建文档型数据库集合

创建两个集合：

- `feixi_stations`
- `feixi_meta`

两个集合都配置相同安全规则：

```json
{
  "read": "auth.loginType == 'ANONYMOUS'",
  "write": "auth.loginType == 'ANONYMOUS'"
}
```

这是当前项目“无账号、无权限、拿到网址即可共同维护”的既定模式。

## 4. 切换 Git 部署分支

数据库配置完成后，把 CloudBase Web 项目的 Git 分支从：

`cloudbase-migration`

改为：

`cloudbase-sync-v1`

其余保持：

- 项目框架：其他
- 目标目录：`./`
- 安装命令：留空
- 构建命令：留空
- 构建产物目录：`cloudbase-dist`
- 部署路径：`/`

## 5. 第一次初始化云端底册

新版本打开后顶部会显示“云端未初始化”，并出现“导入云端底册”按钮。

使用原电脑导出的：

`肥西完整备份-2026-09-25.json`

进行初始化。

导入逻辑：
- 76 个站分别写入 `feixi_stations`，每站一个文档；
- 全局版本信息写入 `feixi_meta/main`；
- 备份内容不会写入公开 GitHub 仓库；
- 初始化成功后，云端成为共享主数据；
- localStorage 继续保留为本机缓存和应急副本。

## 6. 冲突规则

不同站点可以分别更新。
如果两个人同时修改同一站点，后提交的一方不会静默覆盖前一方，页面会提示“云端冲突”，本机修改仍会保留，需先下载完整备份再刷新处理。
