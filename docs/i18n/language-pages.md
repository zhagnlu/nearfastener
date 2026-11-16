# 按语言划分页面

参考 `../nearblade/` 的语言路径、独立 HTML、SEO 和旧地址迁移方式实现。

- 地址统一带语言前缀和尾斜杠：`/en/`、`/zh-cn/products/`、`/ar/product/sems-screw/`。
- 107 个有效路由 × 9 种语言 = 963 页，另有各语言 404 与旧地址跳转入口。
- `content/locales/*.json` 仅作构建／服务端文案源；`public/i18n.js` 和 `public/locales/*.js` 已移除。浏览器没有整页动态翻译和语言包网络请求。
- 共用 HTML 模板在导出时生成各语言页面，在应用端由服务端输出各语言内容。语言菜单为普通链接，JS 开启时保留查询参数、产品询价参数和锚点。切换语言会加载新页面，未提交表单输入不会跨页面保存。
- `lang` 和 `dir` 与路径一致；阿拉伯语使用 RTL。标题、描述、分享元数据、结构化数据与内部链接同步本地化。
- `content/site.json` 的 `url` 目前未配置，因此延续原有策略，不生成猜测的绝对 canonical、hreflang 和 sitemap。配置正式 HTTPS 域名后构建会生成自引用 canonical、九种语言及 x-default 链接和仅包含语言目录的 sitemap。

## 旧地址

| 旧入口 | 目标 |
| --- | --- |
| `/` | `/en/` |
| `/products?lang=zh-CN&topic=all` | `/zh-cn/products/?topic=all` |
| `/de/products/index.html?lang=ja` | `/de/products/` |
| `/en/products` | `/en/products/` |

已有路径语言优先于旧 `lang` 参数。未知语言、未知页面保持 404，不重定向到首页。

沿用现有 Nginx 配置，语言页面由各目录内的 `index.html` 直接提供，无需新增服务器规则。

独立导出保留旧无前缀地址的 HTML 入口，通过 meta refresh 和 JavaScript 跳转到对应语言页面。JavaScript 可用时识别旧 `lang` 参数，并保留其他查询参数与锚点；禁用 JavaScript 时通过 meta refresh 跳转英文页面。这是浏览器跳转，旧入口的 HTTP 响应仍是 200，不承诺服务器 301。已有语言前缀时路径语言生效，静态页面无需清理 URL 中残留的 `lang` 参数。

应用／Worker 和本地专用预览服务仍可在自身代码中返回 301，不涉及 Nginx。生产 ECS 静态部署以现有服务器行为为准；未知路径的 404 也由现有配置处理。

静态文件仍使用相对链接，可直接打开 `static-site/index.html` 离线浏览。目录地址和显式 `index.html` 均可访问，目录尾斜杠由现有服务器处理。

## 验证

`npm test` 构建应用和独立 HTML 后检查全部语言页、站内链接、词典覆盖、Worker 首响应正文、语言标记、旧地址重定向、404，以及原有目录、资源和 RFQ 测试。`npm run test:i18n` 需要先导出静态页面。

本地修改不自动提交、推送或部署。本次不生成、修改或应用 Nginx 配置。

预览：`npm run preview:static`，默认 `http://127.0.0.1:8011/zh-cn/`，支持与语言目录一致的 301、GET／HEAD 和真实 404；`PORT` 可指定其他端口。

## 本轮验证（2026-11-16）

- `npm test`：构建成功，44 项测试全部通过，覆盖全部 963 个语言页面的静态 HTML 和 Worker 渲染。
- 独立 HTTP 检查：963 页均返回 200，语言标记匹配；旧地址、参数清理、语言前缀优先级和未知路径／资源 404 通过。
- `git diff --check`：通过。
- Chrome／内置浏览器连接失败，未完成真实浏览器视觉验收。
- 独立 `npx tsc --noEmit` 仍受项目已有 Cloudflare 类型缺失影响（`cloudflare:workers`、`Fetcher`、`D1Database`）；本轮应用构建通过。
- 未提交、推送或部署。原有未跟踪的 `SEO_PLAN.md` 未修改。

## 2026-11-17 范围调整

按用户要求移除此前新增的 Nginx 示例、映射文件和构建生成逻辑。多语言页面沿用现有静态服务器配置，旧地址采用已生成的 HTML／浏览器跳转兜底。
