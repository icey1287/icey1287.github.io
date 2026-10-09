# icey / a curious mind.

## 自动发布

网站地址：https://icey1287.github.io/

提交到 `main` 后，GitHub Actions 会运行 `python3 build.py`、执行 Shell 测试，并将构建生成的 `index.html` 发布到 GitHub Pages。站点只发布构建产物，不发布源码、测试或预览图片。

GitHub 仓库的 **Settings → Pages → Source** 应选择 **GitHub Actions**。也可以在 **Actions → Build and deploy homepage → Run workflow** 手动发布。

日常修改 `content/` 中的正文或 `src/` 中的模板、样式与功能模块即可；不必手动粘贴或上传整份 HTML。仓库根目录原有的 `index.html` 保留为初次发布快照，线上版本始终由工作流根据最新源码重新构建。

## 本地预览

先运行 `python3 build.py`，再用浏览器打开生成的 `index.html`。

HTML、样式、Markdown 内容、终端组件与脚本均已内嵌。

## 内容维护

正文位于 `content/`，其中 `about.md` 是默认首页，`life.md` 是代码之外的记录，`blog/` 按日期保存文章。

```text
content/
├── about.md
├── life.md
├── blog/
│   └── 2026.10.7.md
├── projects/
│   ├── supermew.md
│   ├── ourtomorrow.md
│   ├── foucs-rabbit.md
│   ├── cookmind.md
│   └── feynman-s-cat.md
├── skills.json
└── manifest.json
```

修改 Markdown 文件后，在项目根目录运行：

```sh
python3 build.py
```

重新生成的 `index.html` 就是可分发、可部署的单文件版本。`src/profile.js` 与 `src/app.js` 是构建产物，不要直接维护。

添加项目时，在 `content/projects/` 新建 Markdown，再向 `content/manifest.json` 的 `projects` 数组添加 `slug`、`name` 和 `subtitle`。构建会同步生成导航、数量与项目目录。

给 `blog/` 添加 Markdown 后重新构建，即可用 `blog` 查看文章列表，点击目录中的文章阅读；文件夹保持为空时不需要任何占位文件。

页面地址统一使用站点相对路径，例如 `#life`、`#projects/feynman-s-cat`、`#blog/2026.10.7`。旧的 `#/home/icey/...` 地址会自动转成短地址。终端以 `/` 为站点根目录，`~` 指向同一位置；`cd ..` 在根目录保持不变。

## 页面组织

文件预览位于上方，终端位于下方，中间分隔线可以拖动。右上角只保留文件类型与预览 / 源码切换。主题在顶部搜索面板中切换；`piano` 等彩蛋通过终端命令打开。

## 测试

```sh
node tests/shell.test.cjs
node --test tests/routes.test.cjs
python3 tests/content.test.py
python3 tests/browser.test.py
python3 tests/scroll.test.py
python3 tests/terminal.test.py
```

浏览器测试需要 Playwright 和 Chromium，默认读取 `/usr/bin/chromium`，也可通过 `CHROMIUM_EXECUTABLE` 指定路径。测试结果写入 `tests/*-results.json`。

`vendor/` 中的 Marked 与 xterm.js 沿用前一版，许可证随包保留。
