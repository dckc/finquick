export const makeTestClock = (startMs = Date.UTC(2020, 0, 1), stepDays = 3) => {
  const stepMs = stepDays * 24 * 60 * 60 * 1000;
  return (() => {
    let now = startMs;
    return () => {
      const current = now;
      now += stepMs;
      return current;
    };
  })();
};
