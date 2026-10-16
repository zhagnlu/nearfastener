# GitHub 发布分支与 ECS 静态部署

本文只记录配置方法。IP、域名和公钥示例均为占位内容，不包含密码、私钥或实际服务器凭据。

## 发布流程

```text
main 或其他开发分支：源码修改 → commit
  → npm run build:ecs：构建、静态导出、测试
  → 本地预览 static-site/
  → npm run publish:ecs：提交静态产物到 push_remote 并推送
  → GitHub Actions：SSH + rsync 同步到 ECS_DEPLOY_PATH 根目录
  → Nginx 展示静态文件
```

`static-site/` 是本项目的静态 dist 产物。`push_remote` 根目录包含 `index.html`、页面、图片、样式、脚本及 `.github/workflows/deploy-ecs.yml`，不包含开发源码。不要将开发分支直接合并到 `push_remote`，也不要在该分支开发；发布脚本管理它。

Git 保留每次有变化的发布 commit；ECS 仅保留一套网站文件，没有版本目录或自动回滚。rsync 会覆盖更新并删除已经不在发布分支中的旧文件。部署目录必须只用于本网站，不存放其他应用数据。`.well-known/` 和 `.user.ini` 被保留；`.git/`、`.github/`、导出说明和路由清单不上传。

## 一次性配置 ECS

服务器需安装 Nginx、SSH 服务及 rsync。软件包安装方式按服务器系统选择，例如 Ubuntu/Debian：

```bash
sudo apt-get update
sudo apt-get install nginx rsync
```

创建部署用户；若已经存在则跳过创建：

```bash
sudo useradd -m -s /bin/bash deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo touch /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

仅针对本网站授权目录。若已有文件，先确认它们都是可替换的静态网站文件，再递归授权：

```bash
sudo mkdir -p /var/www/nearfastener
sudo chown -R deploy:deploy /var/www/nearfastener
sudo chmod 755 /var/www/nearfastener
```

Nginx 可继续以 www-data 等用户运行，文件不需要归它所有。workflow 上传的目录设置为 755、文件为 644，供 Nginx 读取。deploy 不需要 sudo 权限。

Nginx 对应域名的 server 配置使用以下根目录，不使用 current 或 releases：

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/nearfastener;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

将 example.com 替换成自己的域名。HTTPS 按现有证书配置管理；已有正确站点配置无需重写。修改配置后检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

ECS 安全组和系统防火墙需允许实际 SSH 端口及网站 HTTP/HTTPS 访问。部署 runner 必须能连接 SSH。不要为部署关闭主机身份校验。

## 配置 SSH 密钥

在自己的 Mac 终端生成专用密钥（同名文件已存在时不要覆盖）：

```bash
mkdir -p ~/.ssh
ssh-keygen -t ed25519 -C "github-ecs-deploy" -f ~/.ssh/github_ecs_deploy -N ""
```

当前 workflow 需要无密码短语的部署私钥。私钥文件没有 `.pub` 后缀，公钥文件有 `.pub` 后缀。

在 Mac 查看公钥：

```bash
cat ~/.ssh/github_ecs_deploy.pub
```

通过阿里云控制台进入 ECS，将输出的公钥完整一行追加到 `/home/deploy/.ssh/authorized_keys`，保留已有公钥。不要将私钥上传到服务器授权文件。

在 Mac 复制私钥后直接粘贴到 GitHub Secret：

```bash
pbcopy < ~/.ssh/github_ecs_deploy
```

多个自有网站可以共用同一个 deploy 用户和密钥：各仓库填相同登录参数，但 ECS_DEPLOY_PATH 使用不同网站目录。共用用户能修改其获授权的所有目录，因此仓库管理者需属于同一信任范围。

## GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret。

| 名称 | 填写内容 |
| --- | --- |
| ECS_HOST | ECS 公网 IPv4 或主机名，不带 http:// |
| ECS_USER | deploy，须与服务器授权公钥的用户一致 |
| ECS_SSH_KEY | 专用私钥完整内容，保留 BEGIN/END 和真实换行；不是公钥或登录密码 |
| ECS_KNOWN_HOSTS | 经核验的服务器 SSH 主机公钥记录，获取方式见下文 |
| ECS_PORT | 可选，默认 22 |
| ECS_DEPLOY_PATH | 可选，默认 /var/www/nearfastener |

ECS_HEALTHCHECK_URL 不再使用，可移除。workflow 不打印密钥，GitHub 自动遮盖 Secret 值。

获取 ECS_KNOWN_HOSTS：通过可信的阿里云控制台终端，在 ECS 执行：

```bash
cat /etc/ssh/ssh_host_ed25519_key.pub
```

将 ECS_HOST 的实际值、一个空格和输出中的公钥类型及完整公钥组合成一行，末尾注释可省略。占位格式：

```text
ECS公网IP ssh-ed25519 服务器公钥完整字符串
```

非 22 端口使用：

```text
[ECS公网IP]:SSH端口 ssh-ed25519 服务器公钥完整字符串
```

这不是部署用户的公钥，而是服务器身份公钥。不要读取或复制服务器没有 `.pub` 后缀的主机私钥。

## 日常构建、预览与发布

1. 在开发分支完成修改，提交代码，保持工作区干净。
2. 执行 `npm run build:ecs`。若生成的已跟踪文件有更新，先检查并提交，再重新构建。
3. 执行下面命令，打开 http://localhost:8000/ 预览。停止预览服务器用 Ctrl+C。

   ```bash
   python3 -m http.server 8000 --directory static-site
   ```

4. 确认后执行 `npm run publish:ecs`。此步骤不会重新构建，只推送已生成的文件。第一版会自动创建远程 push_remote 分支。
5. 打开 GitHub → Actions → Deploy website to ECS，查看同步结果；成功后实际访问网站检查。

发布脚本会核对构建记录与当前开发 commit。源码提交变化后需重新构建和预览；构建成功记录不代表后来手工修改的产物再次经过测试，因此不要绕过源码直接编辑产物。

`npm run publish:ecs -- --dry-run` 可准备发布提交并验证，不推送、不触发 ECS；仍需访问远程读取发布分支。没有产物变化时不会创建发布 commit。

只执行 `git push origin main` 不会部署。手动重传已发布产物可在 Actions 中选择 push_remote 执行 Run workflow；不要选择开发分支。

## 报价、域名与故障定位

### 规范 URL 与 CDN

正式页面采用 `https://www.nearfastener.com/<路径>/`。线上 HTML 的导航、语言切换和询价 GET 表单统一使用目录 URL；`data-offline-href` 和 `data-offline-action` 仅在 `file:` 预览时恢复相对 `index.html` 文件链接。

阿里云 CDN 的 `www.nearfastener.com` 域名需开启 **HTTPS 配置 → 强制跳转 → HTTP → HTTPS → 301**。源站跳转不能替代 CDN 客户端协议设置，CDN 缓存命中时可能不回源。开启前确认 HTTPS 证书有效；开启后检查带路径和查询参数的 HTTP 请求均保留路径和参数跳转至 HTTPS。

旧的 `/index.html` 地址需要服务器永久跳转。仓库 `ops/nginx/nearfastener-canonical.conf` 提供仅处理显式 `index.html` 请求的规则，避免 Nginx 内部解析目录首页时循环。在现有 HTTPS `server` 块内 include 此规则，保留现有证书、root、ACME 和其他 location。此文件不会随静态发布自动安装。管理员先备份现有配置，执行 `sudo nginx -t`，通过后再执行 `sudo systemctl reload nginx`；失败时恢复原配置。

上线后核对 `/`、`/index.html`、`/zh-CN/product/eye-bolt/index.html?source=check`、裸域和 HTTP；规范页应返回 200，旧 `index.html` 应以 301 保留查询参数跳到对应目录，随机不存在路径应保持 404。CDN 修改跳转规则后按需刷新旧 URL 缓存。

报价采用 FormSubmit 邮件模式，静态 ECS 无需部署报价 API。首次使用需要收件邮箱激活，详见 [RFQ.md](RFQ.md)。正式域名填写在 `content/site.json` 的 url 中，然后重新构建发布，以生成正确 canonical 和 sitemap。

| 错误 | 检查项 |
| --- | --- |
| ECS_SSH_KEY cannot be read / libcrypto | 私钥是否完整、真实多行、没有密码短语，且不是 .pub |
| Permission denied (publickey) | ECS_USER、私钥与该用户 authorized_keys 中的公钥是否配对；文件属主和权限是否正确 |
| Host key verification failed | ECS_KNOWN_HOSTS 的主机、端口、公钥是否与 ECS 一致 |
| rsync not found | ECS 是否已安装 rsync |
| rsync Permission denied | deploy 对已有网站文件和子目录是否有写权限 |
| Workflow 没执行 | 是否真的推送到 push_remote，且该分支包含 workflow |
| 同步成功但页面没更新 | Nginx root 是否指向 ECS_DEPLOY_PATH，浏览器或 CDN 是否缓存 |

私钥本地验证命令（不输出内容）：

```bash
ssh-keygen -y -P '' -f ~/.ssh/github_ecs_deploy > /dev/null
```

本地登录测试，将占位主机替换为实际值；非默认端口加 `-p 端口`。首次连接先核对主机指纹：

```bash
ssh -o IdentitiesOnly=yes -i ~/.ssh/github_ecs_deploy deploy@ECS公网IP
```

所有真实私钥、密码和服务凭据只存 GitHub Secrets 或受控本地配置，不写入本文、仓库或 Actions 日志。
