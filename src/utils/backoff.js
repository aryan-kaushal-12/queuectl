export function getDelaySeconds(base, attempts) {
  // attempts is number of attempts already done before retry (we compute next attempt delay using nextAttempts)
  const nextAttempts = attempts + 1;
  return Math.pow(base, nextAttempts);
}
