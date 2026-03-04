# Workflows

Markdown SOPs (Standard Operating Procedures) for the WAT framework.

## Conventions

Each workflow is a markdown file that defines:

1. **Objective** — What this workflow accomplishes
2. **Prerequisites** — What must be true before starting
3. **Inputs** — What data or parameters are needed
4. **Steps** — Ordered instructions with which tools to call
5. **Tools Used** — List of scripts from `tools/` this workflow calls
6. **Expected Output** — What the final deliverable looks like
7. **Edge Cases** — Known failure modes and how to handle them
8. **Changelog** — Updates to the workflow over time

## File Naming

Use kebab-case: `build-dashboard.md`, `run-scoring-engine.md`, `deploy-to-vercel.md`

## Key Rules

- Workflows should evolve as you learn — update them when you find better methods
- Don't create or overwrite workflows without asking unless explicitly told to
- Every feature should have a corresponding workflow before code is written
