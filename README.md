# Near Fastener 网站复刻

根据浏览器中打开的 Near Fastener 预览网站制作，保留原站的英文内容、深蓝与橙色配色、字体、布局、图标、卡片、规格表及响应式样式。采集日期：2026-09-20。

## 内容范围

- 10 个主要页面：首页、产品目录、标准目录、制造能力、行业、质量、关于、资源、联系、询价。
- 9 个产品分类页。
- 12 个具体产品详情页。
- 14 个标准详情页。
- 4 篇技术文章。
- 合计 **49 个页面、44 张原站图片**，图片全部保存在本地。

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

## 编辑内容

- `content/pages/`：每个页面的可编辑 HTML，路径与原站网址对应。
- `content/routes.json`：页面标题、描述及文件映射。
- `content/header.html`、`content/footer.html`：公共导航及页脚。
- `public/assets/`：按产品类别和公共用途分类的图片；目录说明见 [content/CATALOG.md](content/CATALOG.md#图片目录)。
- `public/site.css`：原站的实际样式，包括响应式断点。
- `public/replica.css`：手机菜单、键盘焦点、表单反馈等补充样式。
- `public/site.js`：手机菜单、导航状态、滚动动效、文件校验及表单下载。
- `app/[[...slug]]/page.tsx`：49 个页面的服务端路由。
- `scripts/export-static.mjs`：生成可直接打开和部署的独立版本。

编辑内容或样式后重新执行 `npm run export:static`，更新独立版本。

## Resources 博客

`content/resources.json` 维护文章主题、正文分节、表格、更新时间、来源链接及关联产品 ID。`npm run resources:build` 生成列表与详情页，`dev`、`build` 和静态导出也会自动执行。文章保留 `/resources/<文章ID>` 路径；在数据中增加文章并补齐九种语言后即可发布，不需要手工复制 HTML 模板。

列表提供主题筛选；详情包括章节目录、技术来源、相关产品与询价入口。无 JavaScript 时文章和链接仍可阅读。日期表示正文实际更新日。删除文章后重新生成会移除对应的生成页面与路由，静态导出随后清理旧页面。

## 表单行为

联系页和询价页保留原站表单布局，并支持必填验证、文件格式和 20 MB 大小检查、拖放选择，以及下载填写好的询价文本。

当前是展示版本，**不会发送邮件或上传附件**。表单中有明确提示，提交后也不会伪装成已经发送成功。正式收件需要之后接入真实邮箱服务或询价后台。填写内容不会保存在浏览器本地存储中。

## 检查

检查覆盖全部 49 个路由、页面标题与主要内容、404 返回、页面间的链接、标准章节锚点和 44 个本地图片文件。静态导出另外检查所有相对链接与资源路径。

站点没有包含原预览平台的编辑器、远程运行环境、分析脚本或登录状态。

## 本地多语言

顶部语言菜单支持英语、简体中文、西班牙语、法语、德语、葡萄牙语、俄语、阿拉伯语和日语。译文保存在 `content/locales/*.json`，切换时加载本地语言包，无需在线翻译 API；独立 HTML 版本直接从磁盘打开也可切换。选择会记忆并传递到后续页面，阿拉伯语使用从右到左布局。

```sh
npm run i18n:build  # 从 JSON 生成语言包
npm run test:i18n   # 检查翻译覆盖及语言包一致性
npm run export:static # 更新语言包和全部静态页面
```

文案维护与加载规则见 [content/locales/README.md](content/locales/README.md)。
