function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function connectWithRetry(createConnection, { attempts, delayMs, onRetry } = {}) {
  const maxAttempts = Number.isInteger(attempts) && attempts > 0 ? attempts : 1;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await createConnection();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        onRetry?.({ attempt, maxAttempts, error });
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}

module.exports = { connectWithRetry };
