# 报价邮件模式

报价表单使用原生 multipart POST 提交到 `https://formsubmit.co/info@nearfastener.com`。产品、规格、数量、联系人、公司、年度需求、交付计划和留言进入邮件，客户邮箱作为 Reply-To；可选图纸作为 `attachment` 上传，最多 10 MB。拖放和文件选择均保留附件。

提交后进入 FormSubmit 的验证码／确认页面，网站不会提前声称邮件已投递。客户资料及图纸由 FormSubmit 处理。ECS 仅需静态网站，无需部署 `/api/rfq` 或配置邮箱密码。

## 上线

1. 在正式 HTTP/HTTPS 网站提交测试询价。
2. 收件邮箱 `info@nearfastener.com` 按 FormSubmit 的首次激活邮件确认。
3. 再次测试字段、附件及 Reply-To，并在收件箱确认实际收到；服务商接受请求不代表最终投递。

参考：[FormSubmit 文档](https://formsubmit.co/documentation)。保留默认验证码，不设置 AJAX 自动回复。

现有 `worker/rfq.mjs` 是以前的备用实现，当前报价页面不再调用它。以前的 R2 留存、下载链接及定时重试不适用于邮件模式。联系页仍打开客户邮件应用中的草稿。
