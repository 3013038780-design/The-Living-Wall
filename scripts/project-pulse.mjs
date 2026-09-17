#!/usr/bin/env node
// 生成根目录《项目动态.md》：把 issues（任务帖）、PR（改动申请）、分支（工作副本）
// 的对应关系、时间线与作者整理成白话中文，方便全体成员（含非技术背景）阅读。
// 本页由机器人（GitHub Actions）自动重新生成，请勿手动修改。
//
// 本地试运行：$env:GH_TOKEN = (gh auth token); node scripts/project-pulse.mjs
// 无第三方依赖，Node.js 22+ 内置 fetch 直接可用。

import { readFile, writeFile } from "node:fs/promises";

const REPO = process.env.GITHUB_REPOSITORY || "3013038780-design/The-Living-Wall";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const TIMELINE_LIMIT = 20;
const RECENT_DAYS = 7;

if (!TOKEN) {
  console.error("缺少令牌：请设置 GITHUB_TOKEN，或本地运行前执行 $env:GH_TOKEN = (gh auth token)");
  process.exit(1);
}

// ---------- GitHub API ----------

async function api(path) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "project-pulse",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} 返回 ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function apiAll(path) {
  // 简单分页：每页 100 条，最多 5 页
  const out = [];
  for (let page = 1; page <= 5; page += 1) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await api(`${path}${sep}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

// ---------- 关联规则 ----------

// 分支名约定：codex/22-xxx、livehighhigh/30-xxx —— 斜杠后的数字即任务帖编号
function issueNumberFromBranch(branchName) {
  const m = branchName.match(/(?:^|\/)(\d+)(?=-)/);
  return m ? Number(m[1]) : null;
}

// PR 正文中的 Closes #n / Fixes #n / Resolves #n
function issueNumbersFromBody(body) {
  if (!body) return [];
  const out = new Set();
  for (const m of body.matchAll(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)) {
    out.add(Number(m[1]));
  }
  return [...out];
}

// ---------- 展示辅助 ----------

const dayFmt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const day = (iso) => (iso ? dayFmt.format(new Date(iso)) : "—");
const daysAgo = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;
const who = (user) => (user ? `@${user.login}` : "—");
const link = (text, url) => `[${text}](${url})`;

// ---------- 主流程 ----------

const [issuesRaw, prs, branches] = await Promise.all([
  apiAll("/issues?state=all&sort=updated&direction=desc"),
  apiAll("/pulls?state=all&sort=updated&direction=desc"),
  apiAll("/branches"),
]);

// issues 接口会混入 PR，过滤掉
const issues = issuesRaw.filter((it) => !it.pull_request);

// 每个分支取最新一次提交（用于"最近活动"时间线）
const branchCommits = await Promise.all(
  branches.map(async (b) => {
    try {
      const [c] = await api(`/commits?sha=${encodeURIComponent(b.name)}&per_page=1`);
      return {
        name: b.name,
        date: c?.commit?.committer?.date || null,
        author: c?.commit?.author?.name || null,
        url: c?.html_url || null,
      };
    } catch {
      return { name: b.name, date: null, author: null, url: null };
    }
  }),
);
const branchByName = new Map(branchCommits.map((b) => [b.name, b]));

// 按任务帖编号建立 分支 / PR 索引
const branchesByIssue = new Map();
for (const b of branchCommits) {
  const n = issueNumberFromBranch(b.name);
  if (n === null) continue;
  if (!branchesByIssue.has(n)) branchesByIssue.set(n, []);
  branchesByIssue.get(n).push(b);
}

const prsByIssue = new Map();
for (const pr of prs) {
  const nums = new Set(issueNumbersFromBody(pr.body));
  const headNum = issueNumberFromBranch(pr.head?.ref || "");
  if (headNum !== null) nums.add(headNum);
  for (const n of nums) {
    if (!prsByIssue.has(n)) prsByIssue.set(n, []);
    prsByIssue.get(n).push(pr);
  }
}

// ---------- 区块一：一句话现状 ----------

const openIssues = issues.filter((i) => i.state === "open");
const openPrs = prs.filter((p) => p.state === "open");
const doneRecently = [
  ...issues.filter((i) => i.state === "closed" && daysAgo(i.closed_at) <= RECENT_DAYS),
  ...prs.filter((p) => p.merged_at && daysAgo(p.merged_at) <= RECENT_DAYS),
];

// ---------- 区块二：正在做的事（未完成任务帖） ----------

function prStateText(pr) {
  if (pr.state === "open") return pr.draft ? "草稿，还在写" : "等待审核";
  if (pr.merged_at) return `已合并（${day(pr.merged_at)}）`;
  return "未合并已关闭";
}

const doingLines = [];
for (const issue of openIssues) {
  const n = issue.number;
  doingLines.push(`### ${link(`#${n} ${issue.title}`, issue.html_url)}`);
  doingLines.push("");
  doingLines.push(`- 发起：${who(issue.user)}，${day(issue.created_at)}`);
  const assignees = (issue.assignees || []).map((a) => `@${a.login}`).join("、");
  doingLines.push(`- 负责人：${assignees || "暂未指定"}`);
  const bs = branchesByIssue.get(n) || [];
  if (bs.length > 0) {
    const bText = bs
      .map((b) => `\`${b.name}\`（最近活动 ${b.date ? day(b.date) : "未知"}）`)
      .join("、");
    doingLines.push(`- 工作副本（分支）：${bText}`);
  } else {
    doingLines.push("- 工作副本（分支）：还没有，任务可能未开工");
  }
  const ps = prsByIssue.get(n) || [];
  if (ps.length > 0) {
    for (const pr of ps) {
      doingLines.push(
        `- 改动申请（PR）：${link(`#${pr.number} ${pr.title}`, pr.html_url)} — ${prStateText(pr)}，作者 ${who(pr.user)}`,
      );
    }
  } else {
    doingLines.push("- 改动申请（PR）：暂无");
  }
  doingLines.push(`- 最近更新：${day(issue.updated_at)}`);
  doingLines.push("");
}
if (openIssues.length === 0) {
  doingLines.push("当前没有进行中的任务帖。", "");
}

// ---------- 区块三：等待审核的改动（open PR） ----------

const reviewLines = [];
for (const pr of openPrs) {
  const related = new Set(issueNumbersFromBody(pr.body));
  const headNum = issueNumberFromBranch(pr.head?.ref || "");
  if (headNum !== null) related.add(headNum);
  const relText =
    related.size > 0 ? [...related].map((n) => `#${n}`).join("、") : "未关联任务帖";
  const draftText = pr.draft ? "（草稿）" : "";
  reviewLines.push(
    `- ${link(`#${pr.number} ${pr.title}`, pr.html_url)}${draftText} — ${who(pr.user)}，${day(pr.created_at)} 提交，关联任务：${relText}`,
  );
}
if (openPrs.length === 0) {
  reviewLines.push("- 当前没有等待审核的改动。");
}

// ---------- 区块四：最近动态（时间线） ----------

const events = [];
for (const i of issues) {
  events.push({
    at: i.created_at,
    text: `${who(i.user)} 发了任务帖 ${link(`#${i.number} ${i.title}`, i.html_url)}`,
  });
  if (i.closed_at) {
    events.push({
      at: i.closed_at,
      text: `任务帖 ${link(`#${i.number} ${i.title}`, i.html_url)} 已完成关闭`,
    });
  }
}
for (const p of prs) {
  events.push({
    at: p.created_at,
    text: `${who(p.user)} 提交了改动申请 ${link(`#${p.number} ${p.title}`, p.html_url)}`,
  });
  if (p.merged_at) {
    events.push({
      at: p.merged_at,
      text: `改动申请 ${link(`#${p.number} ${p.title}`, p.html_url)} 审核通过，已合并生效`,
    });
  } else if (p.closed_at) {
    events.push({
      at: p.closed_at,
      text: `改动申请 ${link(`#${p.number} ${p.title}`, p.html_url)} 未合并被关闭`,
    });
  }
}
for (const b of branchCommits) {
  if (!b.date) continue;
  events.push({
    at: b.date,
    text: `工作副本 \`${b.name}\` 有新代码${b.author ? `（${b.author}）` : ""}`,
  });
}
events.sort((a, b) => new Date(b.at) - new Date(a.at));
const timelineLines = events
  .slice(0, TIMELINE_LIMIT)
  .map((e) => `- ${day(e.at)} — ${e.text}`);
if (timelineLines.length === 0) {
  timelineLines.push("- 暂无动态。");
}

// ---------- 拼装输出 ----------

const md = `# 项目动态 · The Living Wall

> 本页由机器人自动整理生成，请勿手动修改。最后更新：${timeFmt.format(new Date())}（北京时间）
> 数据来源：仓库的任务帖（Issues）、改动申请（PR）与分支。新名词见文末「名词小词典」。

**一句话现状**：进行中的任务 ${openIssues.length} 个 · 等待审核的改动 ${openPrs.length} 个 · 近 ${RECENT_DAYS} 天完成 ${doneRecently.length} 项

## 正在做的事

${doingLines.join("\n")}
## 等待审核的改动

${reviewLines.join("\n")}

## 最近动态

${timelineLines.join("\n")}

## 名词小词典

- **任务帖（Issue）**：一件要做的事或要修的问题，大家围绕它讨论。
- **改动申请（PR / Pull Request）**：成员完成一段工作后提交给大家审核的「改动包裹」，审核通过才会正式生效。
- **工作副本（分支 / Branch）**：互不打扰的工作副本，通常一个任务一份，完成后再合并回主线。
- **合并（Merge）**：改动申请通过审核，内容正式进入主线版本。
- **机器人**：仓库里的自动小助手（GitHub Actions），每当任务帖、改动申请或分支有变化，就会自动刷新本页。
`;

const outUrl = new URL("../项目动态.md", import.meta.url);
// 忽略「最后更新」时间戳进行对比：无实质变化时不改写文件，
// 机器人因此不会产生仅时间戳不同的空提交。
const stripStamp = (s) => s.replace(/最后更新：[^\n]*/, "最后更新：<略>");
let existing = null;
try {
  existing = await readFile(outUrl, "utf8");
} catch {
  // 首次生成，文件尚不存在
}
if (existing !== null && stripStamp(existing) === stripStamp(md)) {
  console.log("无实质变化，保留原文件与时间戳");
} else {
  await writeFile(outUrl, md, "utf8");
  console.log(`已生成 项目动态.md（${REPO}）：任务 ${issues.length}，PR ${prs.length}，分支 ${branches.length}`);
}
