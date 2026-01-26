# Multi-Agent Code Review Patterns

> Lessons learned from reviewing the bareCourier codebase with 8 parallel agents, and best practices researched from industry sources.

## The Problem We Encountered

When running a comprehensive code review of bareCourier using 8 specialized agents in parallel:
- **Security Sentinel**
- **Performance Oracle**
- **Architecture Strategist**
- **Pattern Recognition Specialist**
- **Data Integrity Guardian**
- **Agent-Native Reviewer**
- **Code Simplicity Reviewer**
- **Git History Analyzer**

**Result**: Almost every agent hit context window limits before completing their analysis. They produced useful but truncated reports, missing depth in certain areas.

## Root Cause Analysis

### What We Did Wrong

1. **Unbounded Scope**: Each agent was asked to review "the entire app" without file/directory constraints
2. **No Chunking Strategy**: Agents read entire files instead of focused sections
3. **Parallel Overload**: All 8 agents reading similar files duplicated context consumption
4. **No Iterative Passes**: Tried to get complete analysis in single pass per agent

### What Research Says

> "Context must be treated as a finite resource with diminishing marginal returns. Like humans who have limited working memory capacity, LLMs have an 'attention budget' that they draw on when parsing large volumes of context."
> — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

> "Studies on needle-in-a-haystack style benchmarking have uncovered the concept of 'context rot': as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases."
> — [JetBrains Research](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)

## Best Practices for Large Codebase Reviews

### 1. Scope by Default (Minimum Context Required)

Each agent should see ONLY what it needs:

```
# BAD: Review the entire codebase for security issues
Task(security-sentinel): "Review bareCourier for security vulnerabilities"

# GOOD: Review specific security-sensitive areas
Task(security-sentinel): "Review auth files only:
  - src/hooks.server.ts
  - src/routes/courier/+layout.server.ts
  - src/routes/client/+layout.server.ts
  - src/lib/supabase.ts
Focus on: session handling, RLS bypass risks, input validation"
```

### 2. Functional Decomposition

Split agents by domain, not by review type:

```
# Instead of 8 generalist reviewers, use domain-focused teams:

# Team 1: Auth & Security
- security-sentinel: src/hooks.server.ts, auth layouts
- data-integrity: RLS policies, session management

# Team 2: Data Layer
- performance-oracle: database queries, N+1 patterns
- data-integrity: migrations, transaction boundaries

# Team 3: Frontend
- pattern-recognition: component patterns, Svelte 5 compliance
- code-simplicity: UI component complexity

# Team 4: Infrastructure
- architecture-strategist: route structure, data flow
- git-history: development patterns, hot spots
```

### 3. Chunk by Directory

For a codebase like bareCourier:

```
# Pass 1: Core infrastructure
src/hooks.server.ts
src/lib/*.ts

# Pass 2: Courier routes
src/routes/courier/**

# Pass 3: Client routes
src/routes/client/**

# Pass 4: Shared components
src/lib/components/**

# Pass 5: Database layer
supabase/migrations/**
```

### 4. Two-Phase Review Pattern

**Phase 1: Discovery (Shallow, Wide)**
```
Task(explorer): "List all files in src/routes/courier/
  Identify: entry points, data loaders, form actions
  Output: structured file inventory with purpose"
```

**Phase 2: Deep Analysis (Narrow, Deep)**
```
Task(security-sentinel): "Given inventory from Phase 1,
  analyze these 5 highest-risk files:
  [specific file paths]
  Focus areas: [specific concerns]"
```

### 5. Avoid the "Last 20%" Rule

> "Avoid the last 20% of the context window for anything touching multiple parts of your codebase."
> — [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)

**Implementation:**
- Set `max_turns` on agents to limit iterations
- Have agents produce checkpoint summaries every N files
- Use `/compact` proactively, not reactively

### 6. Subagent Summary Pattern

Subagents should return **summaries**, not raw findings:

```
# BAD: Subagent returns full file contents + detailed analysis
Return: {
  files_read: [...entire contents...],
  issues: [...50 detailed findings...]
}

# GOOD: Subagent returns actionable summary
Return: {
  files_analyzed: 12,
  critical_issues: 2,
  summary: "Auth bypass risk in hooks.server.ts:47, missing RLS on services table",
  details_file: "review-security-findings.md"  // Written to disk, not context
}
```

### 7. Persist Notes Outside Context

> "Structured note-taking is a technique where the agent regularly writes notes persisted to memory outside of the context window, which get pulled back in at later times."
> — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

**Implementation:**
- Agents write findings to `review-findings/{agent-name}.md`
- Summary agent reads all finding files
- Main context stays clean for orchestration

## Recommended Review Architecture

### For Small Codebases (<50 files)
```
Single-pass parallel agents with focused scopes
├── Agent A: src/lib/**
├── Agent B: src/routes/**
└── Agent C: tests/** + config
```

### For Medium Codebases (50-200 files)
```
Two-phase with file inventory
├── Phase 1: Discovery agent creates inventory
└── Phase 2: Specialized agents review chunks
    ├── Chunk 1: Core + Auth
    ├── Chunk 2: Features
    └── Chunk 3: Infrastructure
```

### For Large Codebases (200+ files)
```
Hierarchical multi-pass
├── Round 1: Directory-level analysis
│   └── Produce: hot-spot map, risk areas
├── Round 2: Focused deep-dives on hot spots
│   └── Produce: detailed findings per area
└── Round 3: Cross-cutting concerns
    └── Produce: integration issues, patterns
```

## Practical Checklist for Next Review

- [ ] **Pre-review**: Run `find src -name "*.ts" -o -name "*.svelte" | wc -l` to gauge size
- [ ] **Scope definition**: Write explicit file patterns for each agent
- [ ] **Max turns**: Set reasonable limits (5-10 turns per agent)
- [ ] **Output format**: Require summary format, not raw dumps
- [ ] **Checkpoint files**: Agents write to disk, not just context
- [ ] **Phased approach**: Discovery → Analysis → Synthesis
- [ ] **Early compaction**: Use `/compact` at 60% context, not 90%

## bareCourier-Specific Learnings

### What Worked
- Parallel agent execution (8 agents finished)
- Specialized reviewer types (security vs performance vs patterns)
- Comprehensive coverage of concerns

### What Didn't Work
- Each agent tried to read 30+ files
- No file-level scoping in prompts
- Single-pass expected complete analysis
- Findings returned in context, not persisted

### Recommended Approach for bareCourier

Given ~80 source files:

```bash
# Phase 1: Quick inventory (single agent, 1-2 minutes)
Task(explorer): "Create file inventory with risk assessment"

# Phase 2: Focused reviews (3 parallel agents, scoped)
Task(security): "Review only: hooks, layouts, RLS"
Task(performance): "Review only: +page.server.ts files, queries"
Task(patterns): "Review only: .svelte components, runes usage"

# Phase 3: Synthesis (single agent reads finding files)
Task(synthesizer): "Read review-findings/*.md, produce prioritized action list"
```

## Sources & Further Reading

- [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Anthropic
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) - Anthropic
- [Cutting Through the Noise: Smarter Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) - JetBrains Research
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) - Anthropic
- [Google ADK Multi-Agent Patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) - Google
- [Context Window Problem: Scaling Agents Beyond Token Limits](https://factory.ai/news/context-window-problem) - Factory.ai
- [Architecting Efficient Context-Aware Multi-Agent Framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/) - Google

---

*Document created: 2026-01-26*
*Based on: bareCourier comprehensive review session*
