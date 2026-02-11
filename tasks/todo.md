# Merge, Integration Test & Local Server

## Part 1 — Merge
- [ ] Checkout main and pull latest
- [ ] Merge `origin/feature/data-quality`
- [ ] Merge `origin/feature/rag-excellence` (likely no-op, same commit as main)
- [ ] Resolve any merge conflicts
- [ ] Verify with `npx tsc --noEmit`

## Part 2 — Install & Build
- [ ] `npm install`
- [ ] `npx tsc --noEmit` — fix any type errors
- [ ] `npm run build` — fix any build errors

## Part 3 — Automated Tests
- [ ] Run existing tests (`npm test`)
- [ ] Create `__tests__/integration.test.ts` with 10 integration tests
- [ ] Run all tests again

## Part 4 — Start Local Server
- [ ] `npm run dev`
- [ ] Report URL, landing page, and testing guidance

## Part 5 — Commit & Push
- [ ] `git add -A && git commit && git push`
- [ ] Summary report to user
