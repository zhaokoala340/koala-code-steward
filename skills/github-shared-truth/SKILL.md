---
name: github-shared-truth
description: >-
  以 GitHub 仓库作为全团队与多 Agent 唯一正本（Single Source of Truth）的协作防断档 Skill。
  负责在项目启动时先在 GitHub 建仓，强制每个来 coding 的 Agent 开工前拉最新正本（宪法、蓝图、字段表、边界、错题本、决策记录）并开独立工作分支/worktree，
  每笔改动必须留下完整“前因后果”，并通过并发礼让、同船同步合入与精确 commit SHA 交接，确保多 Agent 协作时绝不互相改坏、绝不两边断档。
  凡新项目建仓、多 Agent 并行开发、准备提交/合并 PR、或跨对话交接审查与整改结论时必须触发本 Skill。
license: MIT
metadata:
  version: "1.0.0"
  stage: "0a-github-shared-truth"
---

# GitHub 唯一正本与多 Agent 协同防断档协议（GitHub Shared Truth）

> **一句话比方**：如果五个装修队同时在一栋楼里施工，各自把改动的图纸记在自己手机备忘录里，明天早上甲队一定把乙队刚埋好的水管挖断。
> 唯一的解法，是把 **GitHub 仓库的 `main` 分支设为工地大门口唯一合法的共享总图纸柜**——没放进柜子的规矩不算数，任何人动锤子前先领最新图纸，改完必须连同“为什么这么改、改了哪、谁验过”一起放回柜子归档。

---

## 一、唯一正本铁律：什么必须住在 GitHub `main` 里？

整个研发系统启动的第一步，就是**先在 GitHub 建仓**，并把以下 6 类共享上下文全部作为代码仓库的一部分常驻 `main` 分支（严禁只留在某个 AI 聊天框或某台电脑的本地草稿里）：

| 正本资产 | 建议落盘路径 | 为什么必须在 GitHub 统一托管 |
| :--- | :--- | :--- |
| **研发总宪** | `AGENTS.md`（可软链 `CLAUDE.md`） | 任何新进场的 Agent 一进仓库就自动读到同一套红线与决策权 |
| **封闭产品蓝图** | `PRODUCT_BLUEPRINT.md` | 统一对齐产品是什么、不是什么、封闭范围，防某个 Agent 擅自加料 |
| **唯一协议与字段总表** | `PROTOCOL_FIELDS.md` | 前后端与多 Agent 共看一张接口与事件表，杜绝各自起名 |
| **Agent 与代码协同边界** | `BOUNDARIES.md` | 锁死官方底座 vs 自研、代码层 vs 提示词层（及按需推荐的可选快模型边界），防后来者把删掉的补丁又写回去 |
| **活态错题本** | `MISTAKE_BOOK.md` | 让今天踩过的坑变成所有未来 Agent 共享的免疫记忆 |
| **前因后果与根源外置交接单** | `docs/decisions/`、`docs/handoffs/` + GitHub PR / Issue | 记录每次重大取舍、视觉战报、审码判决，以及**自包含的问题根源 Markdown 交接单**（含代码仓路径、SHA、文件行号与源码摘录），方便用户直接扔给更高智力 Agent 接手 Review，也防后来者误删护栏 |

> **生效铁律**：任何在聊天中达成的架构规则、错题结论或边界调整，**只要还没提交并合入 GitHub `main`，对其他 Agent 而言就等于不存在**。

---

## 二、6 道防改坏、防断档的硬协同机制

### 1. 开工三同步（每个 coding Agent 进场必走）
动笔写任何代码前，强制按顺序做三件事：
1. **拉最新正本 + 开隔离区**：执行 `git fetch origin`，基于最新 `origin/main` 创建**独立任务分支**（多对话并行在本机开发时，必须开独立临时 `git worktree`，**严禁直推 `main`，严禁在他人未提交的脏工作区里混改**）。
2. **读共同协作上下文**：通读 `origin/main` 最新版 `AGENTS.md`、`PRODUCT_BLUEPRINT.md`、`PROTOCOL_FIELDS.md`、`BOUNDARIES.md`、`MISTAKE_BOOK.md`，并扫一眼近期合入的 `git log -n 10 --oneline` 与相关 `docs/decisions/`，摸清前人刚做过什么改动、为什么这么改。
3. **刷图谱 + 看真源码**：增量更新 `code-review-graph`，先查影响面与调用链，再亲自逐行读完目标与关联真源码。

### 2. 每一笔改动必须留下完整「前因后果」（绝不写 `"fix bug"` 式哑巴提交）
为了防止后来的 Agent 看到一段防御逻辑却不知道为什么存在、顺手把它“优化”删掉，**每个 PR 必须按 [templates/PULL_REQUEST_TEMPLATE.md](templates/PULL_REQUEST_TEMPLATE.md) 写清 5 项脉络**（项目建仓时应直接复制到 `.github/pull_request_template.md`）：
- **前因（Why）**：关联哪个 Issue / 视觉缺陷 / 审码打回单？原问题是什么？
- **原则与模特（Principle & Sketch-Model）**：追出了哪条缺失底层原则？参考了哪份底座源码或开源“素描模特”？是否严守“未获明确授权不直接引入他方源码”？
- **改了什么 & 图谱影响面（What & Impact）**：改了哪些模块、图谱查出的上下游调用方如何处置、有没有顺带清掉同类隐患（查一再查十）？
- **验证证据（Evidence）**：机械门禁、真库/契约测试、纯视觉黑盒验收、独立审码判决分别结果如何？
- **正本同步（Docs Synced）**：同步更新了哪几份 GitHub 正本文档（宪法 / 蓝图 / 字段表 / 边界 / 错题本 / 决策记录）？

涉及重要架构或产品取舍时，同步在 `docs/decisions/` 下新增 1 份极简决策记录（见 [templates/DECISION_RECORD.md](templates/DECISION_RECORD.md)）。

### 3. 并发礼让与串行合入协议（彻底杜绝 A 盖掉 B）
当多个 Agent（或多个对话窗口）同时在同一个仓库施工时，严格执行**串行礼让纪律**：
1. **开工查碰撞**：开工前先看 `gh pr list --state open`，若已有其他 Agent 正在修改同一模块，先在 Issue/PR 下声明范围边界或协商错开；
2. **合前查推进**：准备合入 PR 前，先检查 `origin/main` 是否已被其他 PR 推进，以及是否有他方 PR 正在走合入/发布流程；
3. **遇他方在合先礼让，绝不抢合**：若他方正在合并，立刻暂停自身合入并持续跟进对方状态；等对方合完后，**第一时间 `git fetch origin && git rebase origin/main`**（若冲突则亲自逐行读清双方代码意图后审慎解决，**绝不无脑选 `ours` 覆盖他人成果**）；
4. **变基后必重验**：拉齐最新 `main` 后，重新刷新图谱、重跑机械门禁与真实测试，确认没有改坏前一位 Agent 刚合进去的能力，再顺次合入（也绝不暂停礼让后遗忘漏合）。

### 4. 代码与正本文档「同船合入」（防文档与实现断档）
- 凡改动涉及新增/修改接口字段、实时事件、产品边界、宪法条款、或新沉淀的错题思维示范，**必须在同一个 PR（或前置契约 PR）里把对应正本文档同步更新并一起合入 `main`**。
- 独立审码官发现“代码已改但 `PROTOCOL_FIELDS.md` / `BOUNDARIES.md` / 提示词 / 探针口径未同步”的，直接一票否决打回。

### 5. 跨 Agent 交接锁死精确 `commit SHA`（防审旧合新）
开发 Agent → 独立审码 Agent → 纯视觉验收 Agent → 整改 Agent 的交接，一律通过 **GitHub PR 评论 / Issue 标签**传递，并且**必须显式写明精确 `commit SHA`**：
- 独立审码官的 `【合宪放行】` 只对签发时的那个精确 `commit SHA` 有效；只要之后又追加了新提交，必须针对新 SHA 重审；
- 视觉验收通过后上线生产，必须发布**同一验证通过的 `commit SHA`**。

### 6. 推荐开启的 GitHub 仓库保护底座（5 秒配好）
在 GitHub 仓库设置中建议打开：
- 保护 `main` 分支：禁止直接 force-push，要求经 PR 合入且 CI 机械门禁全绿；
- 把 [templates/PULL_REQUEST_TEMPLATE.md](templates/PULL_REQUEST_TEMPLATE.md) 放进 `.github/pull_request_template.md`；
- 把 `.code-review-graph/`、本地临时测试目录与密钥文件写入 `.gitignore`。
