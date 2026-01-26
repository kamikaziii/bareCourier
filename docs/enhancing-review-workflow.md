# Enhancing the /workflows:review Command

> Research findings on Claude Code plugin architecture and specific improvements for large codebase reviews.

## Current Architecture

The `/workflows:review` command is part of the **compound-engineering** plugin:

```
~/.claude/plugins/marketplaces/every-marketplace/plugins/compound-engineering/
├── .claude-plugin/
│   └── plugin.json                 # Plugin metadata (v2.13.0)
├── commands/
│   └── workflows/
│       └── review.md               # The /workflows:review command
├── agents/
│   └── review/
│       ├── security-sentinel.md
│       ├── performance-oracle.md
│       ├── architecture-strategist.md
│       └── ... (13+ reviewer agents)
├── skills/
│   └── file-todos/
│       └── SKILL.md
└── README.md
```

## How Plugin Enhancement Works

Based on [official documentation](https://code.claude.com/docs/en/skills):

### Option 1: Override with Personal/Project Skills

Skills at higher priority locations win. Create your own version:

```bash
# Personal override (all projects)
mkdir -p ~/.claude/skills/workflows-review-large/
# Create SKILL.md with improvements

# Project override (this project only)
mkdir -p .claude/skills/workflows-review-large/
# Create SKILL.md with improvements
```

### Option 2: Fork the Plugin

```bash
# Copy plugin to personal location
cp -r ~/.claude/plugins/marketplaces/every-marketplace/plugins/compound-engineering \
      ~/.claude/plugins/custom/compound-engineering-enhanced/

# Modify the review.md command
# Update plugin.json version
```

### Option 3: Create Complementary Skill

Create a new skill that wraps `/workflows:review` with better scoping:

```yaml
---
name: review-large-codebase
description: Review entire codebases with context-aware chunking. Use when asked to review an entire app, full codebase, or large repository.
disable-model-invocation: true
---
```

## Root Cause: Why Our Review Hit Limits

The current `/workflows:review` is designed for **PR reviews**, not **full codebase reviews**:

| Designed For | What We Asked |
|--------------|---------------|
| PR with 5-20 changed files | "Review the entire app" |
| Scoped to diff context | All ~80 source files |
| Single focused change | Multiple domains |

### Problematic Section in Current Command

```markdown
#### Parallel Agents to review the PR:

Run ALL or most of these agents at the same time:

1. Task kieran-rails-reviewer(PR content)
2. Task dhh-rails-reviewer(PR title)
...
13. Task agent-native-reviewer(PR content)
```

**Problem**: "PR content" becomes "entire codebase" for full app reviews, causing each agent to consume excessive context.

## Proposed Enhancement: review-large-codebase Skill

Create `.claude/skills/review-large-codebase/SKILL.md`:

```yaml
---
name: review-large-codebase
description: Review entire codebases with context-aware chunking and phased execution. Use when reviewing an entire app, full codebase, or large repository without a specific PR.
argument-hint: "[scope: full|courier|client|infrastructure]"
disable-model-invocation: true
context: fork
---

# Large Codebase Review

Review entire codebases without hitting context limits.

## Phase 1: Discovery (Single Agent)

Before launching parallel reviews, map the codebase:

<task_list>
- [ ] Count files: `find src -name "*.ts" -o -name "*.svelte" | wc -l`
- [ ] Identify hot directories by file count
- [ ] Detect tech stack from package.json/Gemfile
- [ ] Create file inventory with risk assessment
- [ ] Determine chunk strategy based on file count
</task_list>

<chunk_strategy>
| File Count | Strategy |
|------------|----------|
| <30 files | Single-pass, 3 parallel agents |
| 30-100 files | Two-phase, domain-focused teams |
| 100+ files | Hierarchical, multi-round |
</chunk_strategy>

## Phase 2: Domain Assignment

Assign agents to specific file patterns, NOT "entire codebase":

<domain_teams>

### Security Team
- **Files**: hooks.server.ts, **/+layout.server.ts, lib/supabase*.ts
- **Agents**: security-sentinel, data-integrity-guardian
- **Max files per agent**: 10

### Data Team
- **Files**: **/+page.server.ts, lib/services/*.ts, migrations/**
- **Agents**: performance-oracle, data-migration-expert
- **Max files per agent**: 15

### Frontend Team
- **Files**: **/*.svelte (excluding ui/**), lib/components/*.svelte
- **Agents**: pattern-recognition, code-simplicity-reviewer
- **Max files per agent**: 20

### Architecture Team
- **Files**: routes/**/+layout*, hooks*, app.*, CLAUDE.md
- **Agents**: architecture-strategist, git-history-analyzer
- **Max files per agent**: 10

</domain_teams>

## Phase 3: Scoped Parallel Execution

Launch agents with EXPLICIT file boundaries:

<parallel_execution>

```markdown
Task(security-sentinel): "Review ONLY these files for security:
  - src/hooks.server.ts
  - src/routes/courier/+layout.server.ts
  - src/routes/client/+layout.server.ts
Focus: auth bypass, session handling, input validation
Output: JSON summary with max 10 findings"

Task(performance-oracle): "Review ONLY these files for performance:
  - src/routes/**/+page.server.ts (list specific files)
Focus: N+1 queries, missing indexes, inefficient patterns
Output: JSON summary with max 10 findings"

# Continue for each domain team...
```

</parallel_execution>

## Phase 4: Synthesis

After all agents complete:

<synthesis>
- [ ] Collect JSON summaries from all agents
- [ ] Deduplicate overlapping findings
- [ ] Prioritize: P1 (critical), P2 (important), P3 (nice-to-have)
- [ ] Write findings to disk: `docs/review-findings/{domain}.md`
- [ ] Create todo files using file-todos skill
- [ ] Present summary with file counts and top findings
</synthesis>

## Agent Output Format

All agents MUST return structured JSON, not prose:

<output_format>
```json
{
  "agent": "security-sentinel",
  "files_analyzed": 5,
  "files_skipped": 0,
  "critical": [
    {"file": "path/file.ts", "line": 42, "issue": "description", "fix": "suggestion"}
  ],
  "warnings": [...],
  "info": [...],
  "summary": "One paragraph assessment"
}
```
</output_format>

## Context Budget Rules

<context_limits>
- Each agent gets MAX 10 files
- Stop analysis at 60% context usage
- Write checkpoint every 5 files
- Return summary, not full findings
- Persist detailed findings to disk
</context_limits>

## Quick Reference

```bash
# Full app review with chunking
/review-large-codebase full

# Domain-specific review
/review-large-codebase courier    # Only courier routes
/review-large-codebase client     # Only client routes
/review-large-codebase infra      # Only infrastructure
```
```

## Implementation Steps

### Step 1: Create the Skill Directory

```bash
mkdir -p ~/.claude/skills/review-large-codebase
```

### Step 2: Create SKILL.md

Use the template above, customized for your typical projects.

### Step 3: Add Supporting Files (Optional)

```
review-large-codebase/
├── SKILL.md                    # Main instructions
├── references/
│   └── agent-scoping.md        # Detailed scoping patterns
├── templates/
│   └── agent-output.json       # Expected output format
└── workflows/
    └── full-review.md          # Step-by-step for full reviews
    └── domain-review.md        # Step-by-step for domain reviews
```

### Step 4: Test

```bash
# In any project
/review-large-codebase full
```

## Alternative: Enhance Existing Plugin

If you want to modify the compound-engineering plugin directly:

### Fork Location

```bash
~/.claude/plugins/custom/compound-engineering-enhanced/
```

### Modify review.md

Add scope detection at the start:

```markdown
### 0. Scope Detection (BEFORE ANY AGENTS)

<thinking>
Determine if this is a PR review or full codebase review.
</thinking>

<scope_detection>
If $ARGUMENTS is empty or contains "full", "app", "codebase":
  → Use chunked review strategy (see Phase 2)
  → DO NOT launch all agents at once
  → Follow domain-team assignment

If $ARGUMENTS is a PR number, URL, or branch:
  → Use standard PR review (existing logic)
  → Agents analyze PR diff only
</scope_detection>
```

## Sources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Claude Code Plugins](https://www.anthropic.com/news/claude-code-plugins)
- [Building Skills for Claude Code](https://claude.com/blog/building-skills-for-claude-code)
- [Agent Skills Standard](https://agentskills.io)

---

*Document created: 2026-01-26*
*Based on: bareCourier review session learnings + official documentation research*
