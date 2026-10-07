# 电脑、手机云同步后自动部署到 EdgeOne

流程：电脑或手机保存文章 → 云同步推送到 `heywarms/heywarms.github.io` 的 `main` 分支 → GitHub Actions 生成 Hexo 静态站点 → 上传到 EdgeOne 项目 `my-test`。

仅保存在设备本地不会触发部署；云同步成功并产生新提交才会触发。草稿也会触发构建，但不会作为公开文章输出。

## 一次性设置

工作流通过 EdgeOne CLI 上传构建结果，目标项目需要是「直接上传」类型。现有配置的项目名称为 `my-test`；请在 EdgeOne 控制台确认项目类型。

1. 在 [仓库的 Actions Secrets](https://github.com/heywarms/heywarms.github.io/settings/secrets/actions) 新建 **Repository secret**：
   - 名称：`EDGEONE_API_TOKEN`
   - 值：有权限部署 `my-test` 的 EdgeOne API Token，可在 EdgeOne 控制台的 API Token 页面创建。它与电脑、手机连接 GitHub 使用的令牌不同。
2. 在 [Actions Variables](https://github.com/heywarms/heywarms.github.io/settings/variables/actions) 新建 **Repository variable**：
   - `BLOG_URL`：博客的正式访问地址，包含 `https://`，如自定义域名或 EdgeOne 提供的默认域名。
   - `EDGEONE_PROJECT_NAME`：`my-test`。此项可省略，工作流已将 `my-test` 作为默认值；更换项目时修改这里。
3. 在电脑端「系统管理 → 云同步」检查变更，将本地主题、博客配置，以及 `.github/workflows/deploy-edgeone.yml` 和 `.github/scripts/prepare-ci.cjs` 一起同步到上述仓库的 `main` 分支。
4. 打开 [Actions](https://github.com/heywarms/heywarms.github.io/actions)，查看 **Deploy blog to EdgeOne**。后续每次 `main` 有新提交都会运行；也可以通过 **Run workflow** 手动部署 `main`。

若同步工作流文件提示权限不足，需要给电脑端 GitHub 令牌增加 **Workflows: Read and write**（经典令牌为 `workflow` scope）。普通文章同步需要 **Contents: Read and write**，无需为手机额外增加工作流编辑权限。

## 日常使用

- **电脑**：保存文章后，在「云同步」检查并同步变更。
- **手机**：保存并同步至同一个仓库的 `main` 分支。
- 不需要先部署 GitHub Pages，也不需要保持电脑开机。
- `main` 保存博客源码，EdgeOne 接收生成后的 `public/`。不要用 GitHub Pages 的静态产物覆盖 `main`。
- 如果 EdgeOne 还绑定了这个仓库的自动 Git 部署，选择保留一条自动发布流程，避免同一个提交重复部署。

## 这个工作流处理了什么

- 构建前在 GitHub 的临时副本中移除仅供桌面编辑器使用的 `hexo-pro` 本机路径依赖。本机的 `package.json`、锁文件和编辑器不受影响。
- `npm ci` 根据锁文件安装其他博客依赖，沿用项目的渲染器、主题和自定义脚本。
- 用 `BLOG_URL` 覆盖云端生成网址，避免文章分享链接和 canonical 标签指向局域网；文章及 Front Matter 不改动。
- 只上传生成后的 `public/`，令牌来自 GitHub Secret。
- 生产部署串行执行，避免较旧的上传在较新的上传之后完成。
- 只有 `main` 自动部署；其他分支不发布。

## 常见失败

| 提示 | 处理 |
| --- | --- |
| `Set the BLOG_URL repository variable` | 在仓库 Variables 填入正式网址后，重新运行工作流。 |
| `Add the EDGEONE_API_TOKEN repository secret` | 在仓库 Secrets 填入 EdgeOne 令牌。 |
| `refusing to allow ... workflow` | 给电脑同步凭据增加 Workflows 写入权限，再同步工作流。 |
| `npm ci` 提示锁文件不一致 | 更新依赖后，将 `package.json` 和 `package-lock.json` 一起同步。 |
| 仍显示旧主题 | 检查 `main` 是否已有 `themes/fieldnotes/`，以及 `_config.yml` 的 `theme: fieldnotes`。 |
| 同步成功却没有新运行 | 检查是否产生新提交、分支是否为 `main`、仓库 Actions 是否启用，以及提交信息是否带 `[skip ci]`。 |

官方参考：[EdgeOne CLI](https://pages.edgeone.ai/zh/document/edgeone-cli)、[EdgeOne API Token](https://pages.edgeone.ai/zh/document/api-token)、[GitHub 工作流触发规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)。
