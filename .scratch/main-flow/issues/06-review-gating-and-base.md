# 06: Review gating and Base

**What to build:** Code reviews that `/implement` runs per ticket don't jump the flow to Review; the review after the last ticket completes Review. When Review is next, its card has a Base field that fills `/code-review <base>`.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] A review command counts only while the implement step is complete
- [ ] In Full, the code review run during the last ticket's `/implement` completes Review
- [ ] Base field (default `main`) appears only in the Review card; text on mobile
- [ ] Review command reads `/code-review <base>`
