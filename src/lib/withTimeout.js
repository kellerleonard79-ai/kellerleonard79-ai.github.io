// Bounds a promise so a hung network call (stalled fetch, a wedged
// supabase-js auth lock, a backgrounded tab waking up) can never leave a
// caller waiting forever. Resolves with `fallback` on timeout instead of
// rejecting, so callers can proceed with a known "didn't finish" state
// rather than hanging the UI indefinitely. The original promise is left to
// settle on its own; nothing awaits it after the timeout fires.
export function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}
