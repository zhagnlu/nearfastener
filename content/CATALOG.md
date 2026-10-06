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

产品使用唯一 `id`、唯一详情 `path`、一个 `primaryCategoryId` 和多个 `categoryIds`。一个产品可以显示于多个分类，详情内容只维护一次。数据生成的详情页面包屑自动跟随主分类及父分类；旧手写详情页的正文继续手动维护，面包屑由目录生成器自动同步。

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

1. 在 `categories` 中增加分类；设置名称、说明、稳定 URL、父级和状态。图片可省略，有图片时放入 `public/assets/products/<分类ID>/`。
2. 在 `products` 中增加产品记录、图片和分类关联。推荐配置 `detail.specifications`（名称与值的二元数组）、`detail.notes`（标题与正文）、`detail.availability`，自动生成详情和询价配置表单。若有标准资料，在顶层 `standards` 添加说明和来源，并用产品的 `standardId` 关联；标准索引入口也应同步添加。旧方式仍可在 `pages/product/` 新增 HTML 并在 `routes.json` 登记路由。
3. 在九个 `content/locales/*.json` 语言文件中补齐新增分类、卡片、元数据和详情文案；不要把草稿内容标成现货或已供应。
4. 设置分类和产品 `status: "published"`，执行 `npm run export:static`。开发、构建命令也会自动生成目录。开发服务运行期间修改 JSON 后，运行 `npm run catalog:build` 更新生成页面。
5. 执行 `npm run test:flow`，检查目录、语言和产品到询价的静态路径。完整应用验证使用 `npm test`。

分类降为草稿后重新生成会删除其生成页面和路由；静态导出会根据自身清单移除上次导出后失效的页面。父类处于草稿时不能发布其子类。已发布产品的主分类必须处于发布状态。

首页推荐和页脚链接是人工精选入口，并非完整目录；增加分类时无需强行加入所有推荐区。完整目录始终从 `/products` 进入。

询价页的产品上下文由目录自动生成。`public/site.js` 只接受已发布产品 ID，并将详情页填写的参数带入询价表单。当前表单生成本地询价文本，不发送邮件、不上传图纸。完整示例见 `docs/countersunk-screw-flow.md`。

## 图片目录

所有网站图片按用途存放在 `public/assets/`，HTML 和目录数据使用 `/assets/...` 引用。

| 目录 | 用途 |
| --- | --- |
| `products/hex-bolts/` | 外六角螺栓 |
| `products/high-strength-bolts/` | 高强度螺栓 |
| `products/structural-bolts/` | 钢结构螺栓及连接副 |
| `products/hex-nuts/` | 六角螺母 |
| `products/stud-bolts/` | 双头螺柱 |
| `products/threaded-rods/` | 全牙螺杆 |
| `products/washers/` | 垫圈 |
| `products/anchor-bolts/` | 地脚螺栓 |
| `products/custom-fasteners/` | 非标紧固件 |
| `products/countersunk-screws/` | 沉头螺丝，含沉头内六角实例 |
| `products/hex-socket-screws/` | 内六角螺丝专用图片，已预留目录 |
| `products/screws/` | 螺钉父分类专用图片，已预留目录 |
| `company/` | 厂区、公司介绍；首页使用 `factory_4.jpg`，关于页使用 `factory-1.jpg` |
| `capabilities/` | 车间、工艺、设备、包装 |
| `quality/` | 检测设备与质量实验室 |
| `industries/` | 应用行业 |
| `resources/` | 材料、等级、表面处理及技术资料 |
| `brand/` | 正式品牌图片；`originals/` 保存原图，`candidates/` 保存备选图 |

产品图片按 `primaryCategoryId` 归档；同一产品跨分类展示时共用主分类中的图片，不复制文件。标准页和技术文章也可引用已有产品图片。无专用图片的分类保留 `.gitkeep`，需要时直接添加图片即可。

移动图片后同步更新 `catalog.json`、手写页面及 `assets.json` 中的对应路径，再运行 `npm run export:static`。导出会重建 `static-site/assets/`，清除旧路径的副本。历史采集脚本会保留 `assets.json` 中已分类的路径，未分类的新采集图片先放入 `assets/imports/`。

## 螺丝螺栓展示目录扩充

依据店铺螺丝螺栓分类列表中已观察到的产品结构新增 16 个系列，未逐项迁移全部商品链接或尺寸 SKU。新增机牙、紧定、肩螺钉、手拧、组合与松不脱、钻尾和特殊头型七个分类，继续复用现有沉头、外六角和螺柱详情。

写实产品 JPEG 位于 `public/assets/products/screw-families/*-photo.jpg`，由内置 image_gen 参照原目录主图的暖灰台面、窗影、光线和景深生成，无价格、宣传文字或品牌水印。17 张效果图替换目录中的 SVG 引用；旧 SVG 保留作为源示意稿。详情通过 `imageKind: "generated"` 标记效果图并显示九种语言说明。效果图不是工厂实拍或加工尺寸依据。图片记录和提示词规范见 `content/product-imagery.json`。

产品页介绍系列结构和应用方向。制造可行性、材质与交付按客户图纸或规格确认；不从店铺推定工厂供货范围。新增内容与元数据已加入九种语言词库。

## 产品导航层级

一级入口按产品类型统一为螺栓、螺钉、螺母、螺柱与螺杆、垫圈、定制紧固件。六角、特殊头型、地脚归入螺栓；双头螺柱和螺纹杆共用父类。

`navigationGroup` 默认为 `family`，表示产品系列。`head-style`、`performance`、`application` 分别表示头型、强度、用途的交叉浏览入口，生成器在分类页分组展示，避免与产品系列混排。高强度和钢结构页面归在螺栓下；沉头页面归在螺钉下。产品的主分类使用产品系列，其他入口通过 `categoryIds` 关联，父级汇总去重。旧分类和产品网址继续保留。
