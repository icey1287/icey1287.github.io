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

正文位于 `content/`，其中 `about.md` 是默认首页，`空间动态.md` 是更新入口，`life/` 保存代码之外的记录，`Notes/` 与 `blog/` 分别保存知识笔记与文章。

```text
content/
├── about.md
├── 空间动态.md
├── life/
│   ├── 概览.md
│   └── Travel/          # 29 个地点，包含旅行年月
├── Notes/               # 产品研究、课程笔记、行业资料
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

给 `Notes/` 或 `blog/` 添加 Markdown 后重新构建，即可用 `notes`、`blog` 查看列表。两者都保持文章平铺。在 `manifest.json` 的 `articles` 中登记主分类，例如：

```json
"articles": {
  "blog/2026.10.7.md": { "category": "科技文章" },
  "Notes/产品观察.md": { "category": "产品研究" }
}
```

Notes 分类为「产品研究、课程笔记、行业资料」，blog 分类为「生活反思、科技文章、读书后记」。目录页显示分类筛选与数量。新文章尚未登记分类时仍出现在「全部」。`directories` 中声明的目录即使没有文件也会出现在侧栏和 Shell 中，无需占位文件。

`life/概览.md` 保留按年份、月份组织的旅行链接、钢琴与独立游戏记录；`life/Travel/` 的地点 Markdown 保存地点名与正文，旅行年月集中登记在 `manifest.json` 的 `travelDates` 中（例如 `"life/Travel/香港.md": "2026.07"`）。Travel 目录按年月分组，目录与侧栏均按旅行年月倒序排列，同月按地点名称排序；未登记年月的地点排在末尾。`life` 打开目录，`life 概览` 打开概览。

「空间动态」的两段更新列表由构建填入源文件的标记位置，并作为同一份 Markdown 提供给预览、源码和 Shell。知识更新收录 Notes/blog，空间更新收录项目和有正文的旅行文件；各取最近八条，以 Git 最后提交日期排序。空文件和未提交的新文件不进入列表，样式修改不会刷新内容日期。构建使用 Git 历史，CI checkout 应设置 `fetch-depth: 0`。

页面地址统一使用站点相对路径，例如 `#life`、`#life/Travel/香港`、`#notes`、`#activity`、`#projects/feynman-s-cat`、`#blog/2026.10.7`。旧的 `#/home/icey/...` 地址会自动转成短地址。终端以 `/` 为站点根目录，`~` 指向同一位置；`cd ..` 在根目录保持不变。

## 页面组织

文件预览位于上方，终端位于下方，中间分隔线可以拖动。右上角只保留文件类型与预览 / 源码切换。桌面提供细短鼠标拖尾、卡片倾斜反光、点击涟漪及分层切页过渡；主题在顶部搜索面板中切换；`piano` 等彩蛋通过终端命令打开。

## 测试

```sh
node tests/shell.test.cjs
node --test tests/routes.test.cjs
python3 tests/activity.test.py
python3 tests/motion.test.py
python3 tests/content.test.py
python3 tests/browser.test.py
python3 tests/scroll.test.py
python3 tests/terminal.test.py
```

浏览器测试需要 Playwright 和 Chromium，默认读取 `/usr/bin/chromium`，也可通过 `CHROMIUM_EXECUTABLE` 指定路径。测试结果写入 `tests/*-results.json`。

`vendor/` 中的 Marked 与 xterm.js 沿用前一版，许可证随包保留。
