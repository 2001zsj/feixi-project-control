# FXTT 免费入口

入口：https://fxtt.vercel.app/
Vercel 项目：fxtt，团队 3237550536zsj-2046s-projects。

该入口自动跳转到现有 CloudBase 根网址，不含 release 参数，保留 # 模块路径。更新 CloudBase 页面后短入口无需重新部署。
CloudBase 当前套餐拒绝新增安全域名（CreateAuthDomain：当前套餐无法执行此操作），因此这不是保持 FXTT 地址栏的直接托管。未升级套餐、未代理绕过域名限制。腾讯云首次访问提示可能仍出现。

只从 fxtt-entry 目录部署 Vercel fxtt 项目。已断开它与 Git 仓库的自动部署，避免从旧根目录部署旧系统。主程序仍从 cloudbase-dist/index.html 发布 CloudBase。

验证：Vercel 正式地址已生效，浏览器自动跳转原系统；业务数据仍由原 CloudBase 环境提供。
