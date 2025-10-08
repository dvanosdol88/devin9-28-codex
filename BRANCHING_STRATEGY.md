# Branching Strategy for Devin/Codex Version Testing

This document explains the branching strategy used to isolate and test two different versions.

## Step-by-Step Instructions

### STEP 1 — Get the repository onto your machine
```bash
git clone <repo-url>
```
Downloads the repo and sets the remote name to 'origin'

### STEP 2 — Enter the project
```bash
cd <repo-folder>
```
Move into the repo directory so git commands apply here

### STEP 3 — Sync your local refs with the server
```bash
git fetch --all --prune
```
Gets all branches/tags and removes locals that were deleted on origin

### STEP 4 — Move onto the base line
```bash
git switch main
```
Selects the main branch without altering history

### STEP 5 — Update main without creating merge commits
```bash
git pull --ff-only
```
Fast-forwards to the latest main; fails if your local has diverged

### STEP 6 — Freeze a known-good checkpoint
```bash
git tag -a known-good-2025-10-07 -m "Checkpoint before splitting versions"
```
Creates a human label on this exact commit

### STEP 7 — Publish the checkpoint so others can roll back to it
```bash
git push origin --tags
```
Pushes the new tag to GitHub

## Creating Version Branches

### STEP 8 — Create Version A (Devin) from today's main
```bash
git switch -c version/devin
```
Makes and checks out a new branch starting at main's current commit

### STEP 9 — Publish Version A and link your local to the remote
```bash
git push -u origin version/devin
```
Creates the remote branch and sets upstream so future 'git push' knows where to go

### STEP 10 — Return to main to start Version B from the same baseline
```bash
git switch main
```
Back to the base line so Version B starts from identical code

### STEP 11 — Create Version B (Codex)
```bash
git switch -c version/codex
```
Makes the second branch for the other developer or approach

### STEP 12 — Publish Version B
```bash
git push -u origin version/codex
```
Creates the remote branch and links it for easy pushes/pulls

## Verification

### STEP 13 — Verify both branches exist on GitHub
```bash
git branch -r | grep 'version/'
```
Should list:
- origin/version/devin
- origin/version/codex

## Branch Purpose

- **main** - Stable baseline branch
- **version/devin** - Devin development and testing
- **version/codex** - Codex development and testing

## Working with Branches

Switch to Devin version:
```bash
git switch version/devin
```

Switch to Codex version:
```bash
git switch version/codex
```

Switch back to main:
```bash
git switch main
```

## Rollback to Checkpoint

If needed, you can rollback to the known-good checkpoint:
```bash
git reset --hard known-good-2025-10-07
```

**Warning:** This is destructive and will discard uncommitted changes.
