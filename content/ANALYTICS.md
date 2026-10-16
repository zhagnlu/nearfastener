# SEO 流量与询价统计

`content/site.json` 中的 `analytics.measurementId` 控制 GA4。当前为 `null`，不加载 Google 标签、不上传统计数据。取得本网站 GA4 Web 数据流的真实 `G-…` 衡量 ID 后填写，重新构建发布即可启用；ID 是公开的网站标识，不需要密码或 API 私钥。

标签仅在配置的正式 HTTPS 主机上加载，本地预览和其他主机不发送数据。静态站及 React 布局共用配置校验。页面浏览只发送不含查询参数和片段的页面地址、去除查询参数的来源地址；询价事件不采集表单姓名、邮箱、公司、留言、图纸、文件名和填写的规格。

| 事件 | 触发条件 | 含义 |
| --- | --- | --- |
| page_view | 正式页面加载 | 页面访问，一次加载仅主动发送一次 |
| rfq_click | 点击本网站询价链接 | 进入询价的点击意图 |
| rfq_start | 产品页规格表单通过浏览器校验并提交 | 从产品页携带规格进入询价页 |
| rfq_submit | 询价校验通过、即将原生提交至 FormSubmit | 服务商交接，不代表邮件已收到 |
| email_click | 点击邮件链接 | 邮件联系意图 |
| whatsapp_click | 点击 WhatsApp 联系链接 | WhatsApp 联系意图 |

事件携带页面语言，以及能从页面已发布产品记录确定的产品 ID。未发送 `generate_lead` 或虚构成功页事件；当前服务商验证码及邮件投递没有回传确认。

启用后在 GA4 实时报告/DebugView 核查上述事件，再按业务口径把联系意图或交接事件标为关键事件。不要将页面浏览和已确认成交混为一类。Google 标签管理中的自动增强型表单事件与这里的自定义事件可能描述同一操作，统计时选择一个口径，避免相加重复计数。

Search Console 使用域名资源核对每周的查询、页面、国家、设备、曝光、点击、点击率及平均排名；另看页面索引报告。GA4 关注自然搜索来源的重点产品浏览及联系意图。保留 28 天、90 天对比，单独记录客户最终回复和有效询盘。

参考：[Google 标签配置](https://developers.google.com/tag-platform/gtagjs/configure)、[GA4 页面浏览](https://developers.google.com/analytics/devguides/collection/ga4/views)、[GA4 事件](https://developers.google.com/analytics/devguides/collection/ga4/events)。
