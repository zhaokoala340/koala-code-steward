---
name: code-review-graph
description: >-
  先对代码仓库建立本地代码知识图谱（code-review-graph MCP / CLI），并强制在每次改代码前先查图谱以定义问题、
  精准定位改动点、看清全量上下游调用方、爆炸半径与缺失单测——同时强制亲自逐行阅读真实源码后再动笔，绝不靠图谱摘要拍脑袋改码。
  凡新接入代码仓库、改动核心代码/函数签名、排查安全与权限边界、做“查一再查十”全仓扫雷、或提交 PR 前必须触发本 Skill。
license: MIT
metadata:
  version: "1.1.0"
  stage: "1-graph-first-coding"
---

# `code-review-graph` 先建图、改前先看图、动笔必看真源码

> **一句话定位**：
> **查图谱**是为了**定义问题、精准定位要改的地方、看清上下游调用方、爆炸半径和缺失单测**；
> **但源码也必须亲自逐行看**——图谱是指路雷达，绝不是替代读源码的偷懒捷径。
>
> 打个比方：给房子敲墙改水电前，先拿红外扫描仪扫出整栋楼的管线透视图，找准墙体位置、看清会震到楼上哪几间房；真正下锤之前，依然要把墙面那块面板亲自撬开看清真实线缆颜色和接头，绝不光凭透视图盲剪电线。

---

## 一、首次接入仓库：3 步建好本地代码图谱

在任意新仓库开工前，先执行一次建图（本地运行，零云端代码泄露，依赖 Python 3.10+）：

```bash
# 1. 安装 code-review-graph（推荐 uv，也支持 pipx / pip）
uv tool install code-review-graph

# 2. 为本机 AI 编程工具自动注册 MCP 服务与钩子（支持 Claude Code / Cursor / Codex / Antigravity 等）
code-review-graph install

# 3. 在目标代码仓库根目录首次全量建图
code-review-graph build
```

- 如需同时把**底层底座或可靠的开源“素描模特”参考仓**也纳入跨仓对照，可执行 `code-review-graph register <参考仓路径>`，并用 `code-review-graph wiki` 生成轻量架构导航（对照开源代码同样遵循“图谱找路、真源码拍板”）。
- **严禁提交本地图谱索引**：确认 `.code-review-graph/` 已加入 `.gitignore` 或 `.git/info/exclude`，绝不入库。

---

## 二、什么时候必须调用（改前先查图 + 必读真源码，交前必查漏）

### 1. 每次改代码前（强制前置：架构师视角查图定位 → 再逐行读真源码）

> **【身份提示词 · 跨模块改动与定位问题前】**
> 当你准备修改跨模块代码、重构核心接口或排查复杂缺陷时，先切换为**「系统架构师」**视角读图谱：看清模块依赖方向、数据所有权边界、爆炸半径与关联执行流——先确认“**问题本身是不是定义歪了、是不是上游耦合导致改一处动全身**”，再打开真源码落笔。

只要涉及修改现有代码、调整函数/接口签名、排查权限与隔离边界、或执行全仓“查一再查十”扫雷，动笔前严格走两步：
1. **第一步 · 查图谱（定义问题、定准位置、摸清半径与测缺）**：
   - 先确认图谱最新（若刚拉取 `origin/main` 或切分支，先调 `build_or_update_graph_tool` 或执行 `code-review-graph update`）；
   - 调 `query_graph_tool`（`pattern="callers_of"` / `callees_of"` / `imports_of"` / `tests_for"`）列出目标符号的**全部上下游调用方与对应测试**；
   - 调 `get_impact_radius_tool` 与 `get_affected_flows_tool`，看清本次改动的**爆炸半径**和受影响的端到端主链路；
   - 陌生模块或跨仓找“素描模特”结构时，用 `get_architecture_overview_tool` / `semantic_search_nodes_tool` / `cross_repo_search_tool` 快速定位。
2. **第二步 · 必看真源码（绝不可省）**：
   - 拿到图谱给出的目标文件与关键上下游清单后，**必须打开真实源码文件与关联测试逐行读完**——确认真实状态流、异常分支、并发锁、隐形副作用与注释契约后再落笔；
   - 任何不看真源码、仅凭图谱节点名或摘要就直接改代码的行为，一律视为严重违规。

### 2. 改完代码、准备开 PR 或送独立审码前（防回归、防漏测）
- **变更风险与单测缺口扫描**：调 `detect_changes_tool` 获取本次改动的**风险评分**、受影响执行流、以及**缺少直接单测覆盖的函数缺口（test gaps）**；
- **拉取精准审码上下文**：调 `get_review_context_tool` 获取结构化审查上下文，配合 `first-principles-code-review` 逐项复核边界条件与权限隔离；
- **防臃肿与清死代码**：调 `find_large_functions_tool` / `refactor_tool`（或 `code-review-graph dead-code`）检查过长函数与无引用死代码。

### 3. 在独立临时 `git worktree` 中开发时（多 Agent 协同必备）
- 调用 MCP 工具时必须显式传入 `repo_root: "<当前 worktree 绝对路径>"`；
- 若该 worktree 首次建图，先调用 `build_or_update_graph_tool(repo_root=...)` 或执行 `code-review-graph update --repo <worktree>`。

---

## 三、「把事情做对」的 4 条防虚假安全感硬纪律

1. **图谱定问题看半径，源码必须亲自读**：图谱只帮你把路照亮、把上下游拉齐；下笔改任何一行逻辑前，必须亲眼读完目标文件与关键调用方的真实源码。
2. **源码永远高于图谱**：若图谱结果与磁盘文件有任何出入，一律以磁盘真实源码为准，并立刻增量更新刷新索引。
3. **空结果 ≠ 不存在**：静态语法树图谱对动态拼接事件名、字符串路由、反射或配置文件引用存在天然盲区；涉及**安全审计、隐私排查、协议字段重命名或破坏性重构**时，必须用 `grep` + 静态类型检查 + 机械门禁双重兜底。
4. **本地索引零入库**：`.code-review-graph/` 仅限本机加速使用，严禁提交到任何 Git 分支。
