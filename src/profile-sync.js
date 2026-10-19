export const profilePendingKey = userId => `vibelog.profilePending.${userId}`;
export const transientFailure = error => !error.status || error.status === 408 || error.status === 429 || error.status >= 500;

export async function retryProfileUpdate(send, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; ; attempt++) {
    try { return await send(); }
    catch (error) {
      if (!transientFailure(error) || attempt === 2) throw error;
      await wait(attempt === 0 ? 350 : 1000);
    }
  }
}
