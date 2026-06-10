# Sidebar Custom Action Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the 25 custom actions as seven restrained category cards with category accents, counts, and neutral action buttons.

**Architecture:** Keep the existing `PRESET_CATEGORIES` data and grouping behavior. Add stable category modifier classes and a count element during sidebar rendering, then express the selected visual direction entirely through scoped CSS using Obsidian theme variables.

**Tech Stack:** TypeScript, Obsidian DOM helpers, CSS, Node.js built-in test runner, esbuild.

---

### Task 1: Add a failing sidebar structure test

**Files:**
- Create: `tests/sidebar-category-ui.test.mjs`

- [ ] **Step 1: Write the failing test**

Read `main.ts` and `styles.css`, then assert that rendering includes a sanitized category modifier class and a `.category-count` element, and that CSS includes card, accent bar, and neutral custom-button rules.

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests/sidebar-category-ui.test.mjs
```

Expected: FAIL because the category modifier, count element, and selected card styles do not exist yet.

### Task 2: Implement category card rendering

**Files:**
- Modify: `main.ts`

- [ ] **Step 1: Add stable category modifier classes**

Sanitize the category ID to lowercase letters, numbers, and hyphens, falling back to `uncategorized`, and render:

```text
ai-workbench-category ai-workbench-category--<category-id>
```

- [ ] **Step 2: Add the action count**

Render a `.category-count` span after the category title using the current grouped prompt array length.

### Task 3: Implement restrained category styling

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Convert category sections into cards**

Use an Obsidian secondary background, standard border, 8px radius, internal padding, and a 3px `::before` accent bar.

- [ ] **Step 2: Add category accent variables**

Define low-saturation accent values for `basic`, `xiaohongshu`, `video`, `wechat`, `translate`, `code`, `other`, and `uncategorized`.

- [ ] **Step 3: Keep buttons neutral**

Remove the dashed custom-button border, retain neutral theme-variable backgrounds, and keep existing hover behavior.

- [ ] **Step 4: Keep the category grid compact**

Remove the generic grid's bottom margin inside category cards and allow long labels to wrap consistently.

### Task 4: Verify

**Files:**
- Verify: `tests/sidebar-category-ui.test.mjs`
- Verify: `main.ts`
- Verify: `styles.css`
- Generated: `main.js`

- [ ] **Step 1: Run the focused test**

```powershell
node --test tests/sidebar-category-ui.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run the production build**

```powershell
npm run build
```

Expected: esbuild completes with exit code 0 and regenerates `main.js`.

- [ ] **Step 3: Inspect the final diff**

Confirm changes are restricted to the approved sidebar rendering, styles, test, plan, and generated bundle.
