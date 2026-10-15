# Near Fastener 网站复刻

根据浏览器中打开的 Near Fastener 预览网站制作，保留原站的英文内容、深蓝与橙色配色、字体、布局、图标、卡片、规格表及响应式样式。采集日期：2026-09-20。

## 内容范围

- 10 个主要页面：首页、产品目录、标准目录、制造能力、行业、质量、关于、资源、联系、询价。
- 31 个产品分类页。
- 42 个具体产品详情页。
- 15 个标准详情页。
- 9 篇技术文章。
- 1 个独立生产链路图文页面。
- 合计 **108 个页面、44 张原站图片及 31 张新生成的产品效果图**，图片全部保存在本地。

原站工厂介绍、电话、地址等占位文字保持原样。产品和标准信息按原站内容复制。

## 直接查看

`static-site/index.html` 是独立版本入口，可以直接用浏览器打开。所有子页面使用相对链接，CSS、JavaScript、图片也都是本地文件。也可以把整个 `static-site` 文件夹上传到普通静态服务器。

## 启动项目

```sh
npm install
npm run dev
```

运行后打开终端显示的本地地址。

```sh
npm run build          # Cloudflare Workers / Sites 构建
npm test               # 全站内容、图片、路由和 404 检查
npm run export:static  # 重新生成独立 HTML 网站
```

## ECS 自动部署

完整操作步骤、密钥获取、GitHub Secrets、Nginx 配置及故障定位见 [部署文档](content/DEPLOYMENT.md)。文档仅含占位示例，不记录密码或私钥。

开发源码保留在 `main`（或其他开发分支），`push_remote` 只保存生成的静态网站和部署 workflow，不保存应用源码或 node_modules。

开发完成并提交代码后执行：

```sh
npm run build:ecs    # 构建和测试，只生成本地静态产物
# 打开 static-site/index.html 预览，或用静态服务器预览
npm run publish:ecs  # 推送已预览的产物，不重新构建
```

`build:ecs` 执行 `npm test` 并记录本次构建的开发提交。构建和推送独立，构建不会访问远程或触发部署。可通过 `python3 -m http.server 8000 --directory static-site` 在 `http://localhost:8000/` 预览产物。

`publish:ecs` 只读取已构建的 `static-site/`，通过临时 Git 工作目录将产物作为分支根目录提交并推送到 `push_remote`。不重新构建、不切换开发分支、不强制推送，自动移除发布分支中已过时的文件。开发提交如已变化，需重新构建和预览。构建和发布前工作区需干净；构建若更新了已跟踪的生成文件，先提交它们再构建。`npm run publish:ecs -- --dry-run` 可验证发布提交但不推送，仍读取远程分支。

GitHub `.github/workflows/deploy-ecs.yml` 只监听 `push_remote`，手动运行也只能选择该分支。GitHub 不构建网站，只通过 SSH + rsync 将分支文件同步到 `ECS_DEPLOY_PATH` 根目录。没有 releases/current、版本保留或自动回滚；同步会删除服务器上已经不在发布分支中的旧网站文件，保留 `.well-known/` 和 `.user.ini`，不上传 `.git/` 和 `.github/`。同步期间可能短暂出现新旧文件混合。

在仓库 Settings → Secrets and variables → Actions 配置：

| Secret | 内容 |
| --- | --- |
| `ECS_HOST` | ECS IPv4 公网地址或主机名 |
| `ECS_USER` | 对整个站点目录有读写权限的 SSH 用户，例如 deploy |
| `ECS_SSH_KEY` | 完整无密码短语的专用 SSH 私钥 |
| `ECS_KNOWN_HOSTS` | 经核验的服务器 SSH 公钥记录；非 22 端口使用 `[主机]:端口` |
| `ECS_PORT` | 可选，默认 `22` |
| `ECS_DEPLOY_PATH` | 可选，默认 `/var/www/nearfastener`；仅用于本网站的绝对目录 |

ECS 需安装 Nginx、rsync，并将部署公钥加入部署用户的 authorized_keys。现有文件若归 www-data，需要将本网站整个目录授权给 deploy（仅针对 `/var/www/nearfastener`）。Nginx 保持 `root /var/www/nearfastener;`，配置 `index index.html;` 和 `try_files $uri $uri/ =404;`；无需修改 Nginx 程序或其他网站配置。`ECS_HEALTHCHECK_URL` 不再使用。

报价使用 FormSubmit 邮件服务，无需额外部署报价 API；正式域名需填入 `content/site.json` 的 `url`，生成 canonical 和 sitemap。

## 编辑内容

- `content/pages/`：每个页面的可编辑 HTML，路径与原站网址对应。
- `content/routes.json`：页面标题、描述及文件映射。
- `content/header.html`、`content/footer.html`：公共导航及页脚。
- `public/assets/`：按产品类别和公共用途分类的图片；目录说明见 [content/CATALOG.md](content/CATALOG.md#图片目录)。
- `public/site.css`：原站的实际样式，包括响应式断点。
- `public/replica.css`：手机菜单、键盘焦点、表单反馈等补充样式。
- `public/site.js`：手机菜单、导航状态、滚动动效、文件校验、报价在线提交及联系表单下载。
- `app/[[...slug]]/page.tsx`：108 个页面的服务端路由。
- `scripts/export-static.mjs`：生成可直接打开和部署的独立版本。

编辑内容或样式后重新执行 `npm run export:static`，更新独立版本。

### 生产链路图文介绍

`/capabilities/production-line` 是独立的螺丝生产链路页面，将 9 张车间照片按车间总览、上料与网带输送、炉体与加热、工艺槽与输送、工段转运组织为 5 个章节，每行单独展示一张图片和对应说明。章节导航支持直接跳转。关于我们页在公司介绍和基础数据之后直接展示生产现场：车间总览作为全宽背景，另外 4 个环节各突出 1 张主图，其余 4 张图作为较小的补充图片，随后衔接价值观和联系区域。制造能力页保留普通文字链接，定制紧固件页保留单图入口；独立生产链路页面沿用原地址，并提供返回关于我们生产现场的链接。

原片保留在 `pis/`，网页使用 `public/assets/capabilities/workshop/` 中的 `-v2.webp` 精修图片，统一为 1440 × 1080 WebP，正文图片与关于我们生产现场背景图延迟加载；上一版图片保留供对照。原片映射与完整修图提示词记录在 `content/workshop-imagery.json`。

生产现场内容由 `scripts/manufacturing-gallery.mjs` 维护，目录构建会更新关于我们中的标记区块，并生成独立页面正文和路由；文案覆盖九种语言。工艺槽的具体用途尚未确认，因此按可见设备描述，不推断淬火、清洗等具体用途和工艺参数。

## Resources 博客

`content/resources.json` 维护文章主题、正文分节、表格、更新时间、来源链接及关联产品 ID。`npm run resources:build` 生成列表与详情页，`dev`、`build` 和静态导出也会自动执行。文章保留 `/resources/<文章ID>` 路径；在数据中增加文章并补齐九种语言后即可发布，不需要手工复制 HTML 模板。

列表提供主题筛选；详情包括章节目录、技术来源、相关产品与询价入口。无 JavaScript 时文章和链接仍可阅读。日期表示正文实际更新日。删除文章后重新生成会移除对应的生成页面与路由，静态导出随后清理旧页面。

## 表单行为

报价页通过 FormSubmit 发送到 `info@nearfastener.com`，保留产品参数和最多 10 MB 的图纸附件。提交后进入服务商确认页面；首次上线需在收件邮箱完成激活，不需要邮箱密码、Worker、R2 或 Resend。联系页仍使用客户邮件应用中的邮件草稿。

上线配置、存储位置和恢复方式见 [content/RFQ.md](content/RFQ.md)。ECS 静态托管可直接提交报价；离线文件请使用邮件联系。

## 检查

检查覆盖全部 108 个路由、页面标题与主要内容、404 返回、页面间的链接、标准章节锚点和 44 个本地图片文件。静态导出另外检查所有相对链接与资源路径。

站点没有包含原预览平台的编辑器、远程运行环境、分析脚本或登录状态。

## 本地多语言

顶部语言菜单支持英语、简体中文、西班牙语、法语、德语、葡萄牙语、俄语、阿拉伯语和日语。译文保存在 `content/locales/*.json`，切换时加载本地语言包，无需在线翻译 API；独立 HTML 版本直接从磁盘打开也可切换。选择会记忆并传递到后续页面，阿拉伯语使用从右到左布局。

```sh
npm run i18n:build  # 从 JSON 生成语言包
npm run test:i18n   # 检查翻译覆盖及语言包一致性
npm run export:static # 更新语言包和全部静态页面
```

文案维护与加载规则见 [content/locales/README.md](content/locales/README.md)。

## 搜索与分享信息

`content/site.json` 管理品牌、邮箱、分享图片和正式域名。`url` 已配置为 `https://www.nearfastener.com`，全站 canonical、分享链接和 `sitemap.xml` 统一使用该地址。ECS 已将 HTTP 及不带 `www` 的地址永久跳转到 HTTPS 的 `www` 地址。`npm run seo:build` 生成爬虫规则和站点地图；生产构建与静态导出均自动调用。

React 页面及独立 HTML 共用 `scripts/seo.mjs`：提供分享标题、摘要及 JSON-LD，产品分类和面包屑来自产品目录。域名未配置时不会生成猜测的绝对网址。产品没有添加价格、现货或评价，不保证出现搜索富结果。规范链接的用途参见 [Google canonical 文档](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)，产品展示要求参见 [Google 产品结构化数据文档](https://developers.google.com/search/docs/appearance/structured-data/product)。

`robots.txt` 的 API 排除规则只用于爬虫提示，附件权限仍由后台验证。

### 多语言页面与搜索信息

静态导出按英文根目录及 `/zh-CN/`、`/de/`、`/es/` 等语言目录生成 9 个版本。正文、标题、描述、分享信息和结构化数据在构建时翻译，关闭 JavaScript 也能读取。页脚语言链接可直接抓取；语言选择器跳转到相应静态页面，原有 `?lang=` 访问方式会保留查询参数并转到对应语言目录。产品询价继续携带产品标识和规格字段。

正式 HTTPS 主域名须写入 `content/site.json` 的 `url`。配置后生成自引用 canonical、9 种语言与 x-default 的 hreflang、覆盖全部语言页面的站点地图，以及完整产品图片和面包屑 URL。规范网址统一以 `/` 结尾，实体标识使用同一个主域名。`build:ecs` 默认拒绝域名为空的发布构建；若明确需要先发布已有功能，可执行 `npm run build:ecs -- --allow-unconfigured-origin`，构建记录会注明域名相关 SEO 项目仍待配置。普通本地预览使用相对链接。

公司结构化数据使用页面已展示的联系方式、所在地和成立年份；产品参数来自目录；文章标记只使用已记录的更新日期和可见技术来源。分类及标准页的规格表和订货问答也使用已有目录数据。未添加虚构价格、库存、评价、专家身份或认证。可抓取正文、准确事实、清晰表格、来源链接和稳定实体信息同时服务传统搜索与生成式搜索；不保证收录、排名或引用。
