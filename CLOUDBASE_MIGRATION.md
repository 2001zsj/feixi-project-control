# CloudBase 迁移部署说明

环境 ID：`zsj1314-d9ger6ak4a25a8717`

本分支只用于腾讯云 CloudBase 国内入口迁移测试，不替换当前 Vercel 正式版。

## 控制台 Git 部署参数

- 仓库：`https://github.com/2001zsj/feixi-project-control.git`
- 分支：`cloudbase-migration`
- 部署方式：公开 Git 仓库
- 框架：静态 HTML / 其他静态网站
- 安装命令：留空
- 构建命令：留空
- 输出目录：`cloudbase-dist`
- 部署路径：`/`
- 首页：`index.html`

`cloudbase-dist/index.html` 为 V0.9.2 当前生产页面的迁移副本。

## 说明

第一阶段仅迁移网页入口，数据仍使用浏览器 localStorage，因此：
- 原电脑上的最新人工数据不会自动出现在腾讯云新域名；
- 在验证腾讯云国内访问正常前，不进行云数据库切换；
- Vercel 仍保留作为回退入口。

下一阶段确认 CloudBase 页面可正常访问后，再迁移原电脑完整备份到云数据库。
