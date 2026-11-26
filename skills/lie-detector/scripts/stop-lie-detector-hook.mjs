#!/usr/bin/env node
/**
 * Lie Detector — Universal `Stop` Lifecycle Hook (v1.0)
 *
 * Supports both:
 *   1. Antigravity Stop hook payloads (`terminationReason`, `continuationActive`, `transcriptPath`)
 *      -> outputs `{"decision":"continue","reason":"..."}` or `{}`
 *   2. Claude Code Stop hook payloads (`hook_event_name: "Stop"`, `stop_hook_active`, `transcript_path`, `last_assistant_message`)
 *      -> outputs `{"decision":"block","reason":"..."}` or `{}`
 *
 * Anti-loop invariant:
 * - Only forces ONE audit pass per user turn (`continuationActive === true` or `stop_hook_active === true` -> allow stop).
 * - If the latest reply already contains `测谎仪复检` -> allow stop.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const LIE_DETECTOR_SKILL_PATH = join(SCRIPT_DIR, '..', 'SKILL.md')
const RECEIPT_MARKER = '测谎仪复检'

const RED_FLAG_PATTERNS = [
  {
    id: 'FAKE_GREEN_OR_ABSOLUTE_PROMISE',
    re: /(放心切|放心搬家|全绿|100%\s*正常|绝对没问题|彻底根治了|已经完全没问题|零缺陷|zero bugs|100% working)/gi,
    note: '命中高危绝对化/假绿灯措辞（需核验是否已有端到端真机证据，否则必须撤回并改标灰灯盲区）',
  },
  {
    id: 'UNVERIFIED_COMPLETION_CLAIM',
    re: /(已经修好了|已全部修好|已彻底解决|已完全打通|已自动生效|已经上线生效)/g,
    note: '命中完成/生效断言（需核对是“已写代码/已触发部署”还是“已亲眼在真实环境验证完毕”）',
  },
  {
    id: 'INTERNAL_IMPLEMENTATION_JARGON',
    re: /\b(hooks\.json|PreToolUse|PostToolUse|transcript\.jsonl)\b/g,
    note: '命中面向非技术用户回复中可能多余的内部配置文件/底层术语（若面向决策者汇报，请核查是否符合去代码化大白话规范）',
  },
]

function readAllStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

function parseJsonLines(filePath) {
  if (!filePath || !existsSync(filePath)) return []
  try {
    const raw = readFileSync(filePath, 'utf8')
    const out = []
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        out.push(JSON.parse(trimmed))
      } catch {
        // skip malformed line
      }
    }
    return out
  } catch {
    return []
  }
}

function extractAntigravityTurnContext(transcriptPath) {
  const compact = parseJsonLines(transcriptPath)
  if (compact.length === 0) {
    return { lastReply: '', editedCodeInTurn: false, ranCheckInTurn: false, alreadyAudited: false }
  }

  let turnStartIdx = 0
  for (let i = compact.length - 1; i >= 0; i -= 1) {
    if (compact[i]?.type === 'USER_INPUT') {
      turnStartIdx = i
      break
    }
  }
  const turnSteps = compact.slice(turnStartIdx)

  let latestReplyEntry = null
  let editedCodeInTurn = false
  let ranCheckInTurn = false
  let alreadyAudited = false

  for (const entry of turnSteps) {
    if (entry?.type === 'PLANNER_RESPONSE') {
      const calls = Array.isArray(entry.tool_calls) ? entry.tool_calls : []
      for (const c of calls) {
        const name = String(c?.name || c?.function?.name || '')
        const argsStr = typeof c?.arguments === 'string' ? c.arguments : JSON.stringify(c?.args ?? c?.arguments ?? '')
        if (name === 'edit_file' || name === 'write_file') {
          if (/\.(ts|tsx|js|mjs|jsx|py|sh|yml|yaml|sql|swift|go|rs)\b/.test(argsStr)) {
            editedCodeInTurn = true
          }
        }
        if (name === 'run_command') {
          if (/(vitest|jest|check:all|build|pytest|go test|cargo test|node\s+.*test|curl|psql)/i.test(argsStr)) {
            ranCheckInTurn = true
          }
        }
      }
      if (calls.length === 0 && typeof entry.content === 'string' && entry.content.trim() !== '') {
        latestReplyEntry = entry
        if (entry.content.includes(RECEIPT_MARKER)) {
          alreadyAudited = true
        }
      }
    }
  }

  let lastReply = typeof latestReplyEntry?.content === 'string' ? latestReplyEntry.content : ''
  if (
    latestReplyEntry &&
    Array.isArray(latestReplyEntry.truncated_fields) &&
    latestReplyEntry.truncated_fields.includes('content') &&
    typeof latestReplyEntry.step_index === 'number'
  ) {
    const fullPath = join(dirname(transcriptPath), 'transcript_full.jsonl')
    const fullEntries = parseJsonLines(fullPath)
    const exact = fullEntries.find((e) => e?.step_index === latestReplyEntry.step_index)
    if (typeof exact?.content === 'string' && exact.content.length > lastReply.length) {
      lastReply = exact.content
      if (lastReply.includes(RECEIPT_MARKER)) alreadyAudited = true
    }
  }

  return { lastReply, editedCodeInTurn, ranCheckInTurn, alreadyAudited }
}

function extractClaudeCodeTurnContext(payload) {
  let lastReply = typeof payload.last_assistant_message === 'string' ? payload.last_assistant_message : ''
  let editedCodeInTurn = false
  let ranCheckInTurn = false

  const transcriptPath = typeof payload.transcript_path === 'string' ? payload.transcript_path : ''
  const entries = parseJsonLines(transcriptPath)
  if (entries.length > 0) {
    let turnStartIdx = 0
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (entries[i]?.type === 'user' || entries[i]?.role === 'user') {
        turnStartIdx = i
        break
      }
    }
    for (const entry of entries.slice(turnStartIdx)) {
      const msg = entry?.message ?? entry
      const blocks = Array.isArray(msg?.content) ? msg.content : []
      for (const b of blocks) {
        if (b?.type === 'tool_use') {
          const name = String(b?.name || '')
          const inputStr = JSON.stringify(b?.input ?? {})
          if (/^(Edit|Write|MultiEdit)$/i.test(name)) {
            if (/\.(ts|tsx|js|mjs|jsx|py|sh|yml|yaml|sql|swift|go|rs)\b/.test(inputStr)) {
              editedCodeInTurn = true
            }
          }
          if (/^Bash$/i.test(name)) {
            if (/(vitest|jest|check:all|build|pytest|go test|cargo test|node\s+.*test|curl|psql)/i.test(inputStr)) {
              ranCheckInTurn = true
            }
          }
        } else if (b?.type === 'text' && typeof b?.text === 'string' && !lastReply) {
          lastReply = b.text
        }
      }
    }
  }

  return {
    lastReply,
    editedCodeInTurn,
    ranCheckInTurn,
    alreadyAudited: lastReply.includes(RECEIPT_MARKER),
  }
}

function scanRedFlags(replyText, editedCodeInTurn, ranCheckInTurn) {
  const hits = []
  for (const rule of RED_FLAG_PATTERNS) {
    const matches = replyText.match(rule.re)
    if (matches && matches.length > 0) {
      const uniq = [...new Set(matches)].slice(0, 5)
      hits.push(`[${rule.id}] 命中词「${uniq.join('、')}」— ${rule.note}`)
    }
  }
  if (editedCodeInTurn && !ranCheckInTurn) {
    hits.push('[EDITED_WITHOUT_VERIFY_CMD] 本回合修改了代码/脚本文件，但未检测到验证命令执行记录，严禁宣称已验证通过。')
  }
  return hits
}

function buildAuditReason(hits) {
  const flagsBlock =
    hits.length > 0
      ? `\n自动初筛高危提示（必须逐项重点核查）：\n${hits.map((h) => `- ${h}`).join('\n')}`
      : '\n自动初筛未命中高危词，但仍须按 Skill 逐条核查事实主张、隐性吹牛与灰灯盲区。'

  return [
    `【测谎仪自动复检触发】你刚刚回答了用户问题。请立即按测谎仪 Skill（${LIE_DETECTOR_SKILL_PATH}）对你上一条回答做铁面复检：`,
    '1. 逐条核对上一条回答中的事实断言、完成/生效宣称与归因，确认每一条都有本回合真实工具输出支撑（绝不凭记忆或设计稿冒充现状）；',
    '2. 若发现任何未核实猜测、说满夸大、波将金村假闭环、漏标灰灯盲区或违背去代码化大白话规范之处，必须当场直接认错并逐条更正；',
    '3. 若核实无失真，只输出极简 2–4 行「🔍 测谎仪复检」回执（说明核验条数、失真数、残留灰灯盲区）即可结束。',
    flagsBlock,
  ].join('\n')
}

function main() {
  const raw = readAllStdin().trim()
  if (!raw) {
    process.stdout.write('{}\n')
    return
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    process.stdout.write('{}\n')
    return
  }

  const isClaudeCode =
    payload.hook_event_name === 'Stop' ||
    Object.prototype.hasOwnProperty.call(payload, 'stop_hook_active')

  if (isClaudeCode) {
    if (payload.stop_hook_active === true) {
      process.stdout.write('{}\n')
      return
    }
    const ctx = extractClaudeCodeTurnContext(payload)
    if (!ctx.lastReply || ctx.lastReply.trim().length < 12 || ctx.alreadyAudited) {
      process.stdout.write('{}\n')
      return
    }
    const hits = scanRedFlags(ctx.lastReply, ctx.editedCodeInTurn, ctx.ranCheckInTurn)
    process.stdout.write(`${JSON.stringify({ decision: 'block', reason: buildAuditReason(hits) })}\n`)
    return
  }

  // Antigravity Stop hook protocol
  if (payload.terminationReason !== 'NO_TOOL_CALL' || payload.continuationActive === true) {
    process.stdout.write('{}\n')
    return
  }

  const transcriptPath = typeof payload.transcriptPath === 'string' ? payload.transcriptPath : ''
  const ctx = extractAntigravityTurnContext(transcriptPath)
  if (!ctx.lastReply || ctx.lastReply.trim().length < 12 || ctx.alreadyAudited) {
    process.stdout.write('{}\n')
    return
  }

  const hits = scanRedFlags(ctx.lastReply, ctx.editedCodeInTurn, ctx.ranCheckInTurn)
  process.stdout.write(`${JSON.stringify({ decision: 'continue', reason: buildAuditReason(hits) })}\n`)
}

main()
