# 可扩展产品目录

`catalog.json` 是产品分类与产品列表的维护入口。`scripts/build-catalog.mjs` 自动生成 `/products`、已发布分类页，以及包含 `detail` 数据的产品详情页和关联标准页，并更新 `routes.json`。应用与静态导出使用同一批页面。旧产品详情仍在 `pages/product/` 中维护；新产品可采用数据生成方式。

## 分类规则

- 分类使用稳定 `id` 和独立 `path`。调整显示名称不必更换 URL。
- `parentId` 支持多级分类，顶层使用 `null`。父类列表会汇总所有已发布子类的产品，并按产品记录去重。
- `kind` 区分类型、头型、驱动形式、性能、应用和定制服务；可增加新维度。
- `aliases` 保存中文俗称和其他叫法，供未来搜索使用；当前不提供搜索或别名 URL 跳转。
- `status` 为 `draft` 或 `published`。草稿分类不会生成页面，也不会出现在目录中。
- 显示顺序与 JSON 中的数组顺序一致。

`screws`（螺钉）及其子类 `countersunk-screws`（沉头螺丝）、`hex-socket-screws`（内六角螺丝）已发布，共同关联内六角沉头螺钉实例。外六角螺丝作为 `hex-bolts` 的别名，继续使用现有 URL。

“沉头”属于头型，“内六角”属于驱动形式。一件产品可同时具备二者。不要将它们建成两条重复产品记录。

## 产品记录

产品使用唯一 `id`、唯一详情 `path`、一个 `primaryCategoryId` 和多个 `categoryIds`。一个产品可以显示于多个分类，详情内容只维护一次。数据生成的详情页面包屑自动跟随主分类及父分类；旧手写详情页的面包屑需要手动同步。

`attributes` 独立保存头型、驱动形式等属性。例如未来的内六角沉头螺钉可以使用：

```json
{
  "primaryCategoryId": "countersunk-screws",
  "categoryIds": ["countersunk-screws", "hex-socket-screws"],
  "attributes": {
    "headStyle": ["countersunk"],
    "driveType": ["hex-socket"]
  }
}
```

属性选项统一定义在顶层 `attributes` 中。未来可加入材质、等级、涂层等属性，不需要更改渲染模板。目前这些属性属于目录数据，尚未增加前台属性筛选器。产品记录表示一个产品系列，不代表某一个尺寸 SKU。

## 新增和发布

1. 在 `categories` 中增加分类；设置名称、说明、稳定 URL、父级和状态。图片可省略，有图片时放入 `public/assets/`。
2. 在 `products` 中增加产品记录、图片和分类关联。推荐配置 `detail.specifications`（名称与值的二元数组）、`detail.notes`（标题与正文）、`detail.availability`，自动生成详情和询价配置表单。若有标准资料，在顶层 `standards` 添加说明和来源，并用产品的 `standardId` 关联；标准索引入口也应同步添加。旧方式仍可在 `pages/product/` 新增 HTML 并在 `routes.json` 登记路由。
3. 在九个 `content/locales/*.json` 语言文件中补齐新增分类、卡片、元数据和详情文案；不要把草稿内容标成现货或已供应。
4. 设置分类和产品 `status: "published"`，执行 `npm run export:static`。开发、构建命令也会自动生成目录。开发服务运行期间修改 JSON 后，运行 `npm run catalog:build` 更新生成页面。
5. 执行 `npm run test:flow`，检查目录、语言和产品到询价的静态路径。完整应用验证使用 `npm test`。

分类降为草稿后重新生成会删除其生成页面和路由；静态导出会根据自身清单移除上次导出后失效的页面。父类处于草稿时不能发布其子类。已发布产品的主分类必须处于发布状态。

首页推荐和页脚链接是人工精选入口，并非完整目录；增加分类时无需强行加入所有推荐区。完整目录始终从 `/products` 进入。

询价页的产品上下文由目录自动生成。`public/site.js` 只接受已发布产品 ID，并将详情页填写的参数带入询价表单。当前表单生成本地询价文本，不发送邮件、不上传图纸。完整示例见 `docs/countersunk-screw-flow.md`。
