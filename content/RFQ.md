# 报价表单与邮件通知

`/rfq` 通过同源 `POST /api/rfq` 提交产品、规格、数量、联系人、客户邮箱、公司名称、年度需求、交付计划、留言及可选图纸。收件人固定为 `info@nearfastener.com`，客户邮箱只作为 Reply-To。询价信息使用 Cloudflare 私有 R2 存储，不需要邮箱登录密码，也不需要新增数据库。

未配置 R2、发信地址或 Resend 密钥时，接口返回 503，前端显示“在线提交尚未启用”，不会收集或声称发送成功。当前没有配置真实凭据，也没有发送测试邮件。联系页使用邮件草稿模式：在客户邮件应用中填入需求，由客户确认发送，不调用报价后台。

## 上线时配置

1. 创建私有 R2 bucket `nearfastener-rfq`，在实际部署 Worker 中绑定为 `RFQ_STORAGE`。不要开启公共访问。`vite.config.ts` 和构建产物 `dist/server/wrangler.json` 已包含此绑定；部署平台必须提供对应 bucket，不能只上传 `static-site`。
2. 在 Resend 验证自己的发信域名，按其控制台要求配置 DNS。
3. 添加 Worker secret `RESEND_API_KEY`，添加发信地址 `RFQ_FROM`（例如 `Near Fastener <quotes@nearfastener.com>`，须属于已验证域名）。本地配置参考根目录 `.dev.vars.example`，真实 `.dev.vars` 已加入忽略。
4. 确认生产 Worker 已配置定时触发器 `*/10 * * * *`，每 10 分钟尝试通知待发询价。上线时为 `/api/rfq` 配置 Cloudflare 请求频率限制；当前代码已有同源校验、隐藏诱捕字段、字段长度与文件大小限制。
5. 用一份真实测试询价验证保存、收件、回复地址和下载链接，然后检查通知失败后的重试。API 接受邮件不等同于邮箱最终投递，需检查 Resend 投递日志和收件箱。

参考：[Resend 邮件 API](https://resend.com/docs/api-reference/emails/send-email)、[R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)。

## 保存与恢复

- `rfq/records/<询价编号>.json`：完整字段、创建时间、通知状态、邮件 ID 和附件信息。
- `rfq/drawings/<询价编号>`：原始附件，最多 20 MB，接受 PDF/CAD/Office/JPG/PNG。
- `rfq/pending/<询价编号>`：待通知索引，定时任务每次最多处理 50 条。
- 状态 `queued` 表示询价已保存但通知待发送，`notified` 表示发信服务已接受邮件。前端会分别提示并展示询价编号。
- 重复点击或网络重试复用提交编号及 Resend 幂等键，不新增同一询价。超过 23 小时仍未确认邮件的记录转为 `review-required`，停止自动通知，避免超过服务幂等窗口重复发信。上线后需检查此状态及 Worker 定时任务日志，并在 Resend 确认投递后人工处理。
- 邮件里的图纸链接携带随机访问凭证，30 天后失效，下载强制以附件返回；仅凭询价编号不能下载。链接过期不会删除记录或图纸，可从授权的 Cloudflare 管理界面下载。没有公开记录列表接口，也未制作管理后台。
- 存储没有自动删除周期；上线时根据业务需要设置保存期限。不要将询价内容、下载凭证或密钥写入公开日志。

## 验证

`node --test tests/rfq.test.mjs` 使用隔离的存储和邮件替身，覆盖缺少配置、字段及文件校验、保存、固定收件人、回复地址、重复提交、失败重试、下载权限与过期。`npm test` 还包含生产构建、静态导出、页面路由和九种语言检查，不会发送真实邮件。

本次 `npm test` 的生产构建和 32 项测试全部通过。独立 `tsc --noEmit` 仍被项目原有 Cloudflare 全局类型缺失阻挡（`cloudflare:workers`、`Fetcher`、`D1Database`）；报价模块新增类型已通过检查，没有实际发送或投递验证。
