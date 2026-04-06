# Optimize Performance

## Overview
Analyze and optimize React component performance with memoization, code splitting, and lazy loading (for Vite/React stack).

## Steps
1. **Identify performance issues**
   - Check for unnecessary re-renders
   - Find expensive calculations
   - Look for large bundle/chunk impact
   - Identify render bottlenecks

2. **Apply React optimizations**
   - Add `React.memo()` for pure expensive components
   - Use `useMemo()` for expensive derived values
   - Use `useCallback()` for stable function props where needed
   - Optimize context usage and provider churn

3. **Implement code splitting**
   - Use `React.lazy()` for route/modal-level splitting
   - Use dynamic imports for heavy optional libraries
   - Keep critical path minimal

4. **Optimize media and lists**
   - Add lazy loading for below-the-fold images/media
   - Prefer modern image formats where possible
   - Virtualize long lists when render volume is high

## Checklist
- [ ] Hot path identified and measured first
- [ ] No behavior regression after optimization
- [ ] Reduced render count or improved latency
- [ ] No over-memoization added blindly
- [ ] Code remains readable and maintainable
