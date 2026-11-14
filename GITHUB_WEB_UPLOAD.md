# 只用 GitHub 网页版：发布中国指数估值网站

不需要安装 Git。全程浏览器操作，约 10 分钟。

> 这是一个新网站，仓库名建议 `china-index-compass`。
>
> 完成后网址：`https://zeraray929418798.github.io/china-index-compass/`

## 1. 下载并解压

下载 `china-index-compass-upload.zip`，右键 → **全部解压缩**。

里面应该有：

```text
.github
data
scripts
site
templates
README.md
requirements.txt
serve.py
```

## 2. 新建仓库

打开 [github.com/new](https://github.com/new)：

- Repository name：`china-index-compass`
- 选 **Public**
- 不要勾选 Add a README / .gitignore / license
- 点 **Create repository**

## 3. 上传内容

1. 进入新仓库，点 **uploading an existing file**。
2. 打开解压后的文件夹，按 **Ctrl + A** 全选里面的内容。
3. 直接拖进浏览器上传框。
4. Commit message：`initial upload`。
5. 点 **Commit changes**。

> 不要上传外面的 `china-index-compass` 文件夹本身，否则会多套一层。

## 4. 开启 Pages

仓库 **Settings → Pages**：

- **Build and deployment → Source = GitHub Actions**

## 5. 运行一次

仓库顶部 **Actions** → 左侧 **Update China index data and deploy** → **Run workflow** → `main` → 绿色按钮。

首次运行会下载数据并构建，约 2–5 分钟。

## 6. 打开网站

**Settings → Pages** 顶部会出现 **Visit site**，或直接打开：

```text
https://zeraray929418798.github.io/china-index-compass/
```

## 以后

- 周一至周五 **北京时间 18:00** 自动更新（A 股收盘后）。
- 想立刻更新：**Actions → Update China index data and deploy → Run workflow**。
- 修改代码后手动 Run 一次即可重新部署。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| Pages 404 | 确认 Source = GitHub Actions，等首次部署完成 |
| Actions 没有工作流 | 检查 `.github/workflows/update-and-deploy.yml` 是否上传 |
| 运行失败 403 | Settings → Actions → General → Workflow permissions → Read and write |
| 数据为空 | 检查 `site/data/*.js` 是否上传；看控制台 404 |
| 页面显示旧数据 | 浏览器 Ctrl + F5 强制刷新 |

## 提醒

- 不要把 GitHub 密码、验证码发给任何人。
- 不需要 API key，不需要付费。
- 这是研究工具，不构成投资建议。
