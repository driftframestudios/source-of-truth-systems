export const REQUEST_ADMISSION_LIMITS = Object.freeze({
  concurrent: 8,
  retryAfterSeconds: 1,
});

/** Share one instance across API routes; register before the deadline wrapper. */
export function createRequestAdmission({
  concurrent = REQUEST_ADMISSION_LIMITS.concurrent,
} = {}) {
  if (!Number.isSafeInteger(concurrent) || concurrent < 1)
    throw new TypeError("Request capacity must be a positive integer.");
  let active = 0;
  return {
    onRequest({ requestHandler, setRequestHandler }) {
      setRequestHandler(async (request, context, fetchAPI) => {
        if (active >= concurrent)
          return fetchAPI.Response.json(
            {
              errors: [
                {
                  message:
                    "The service is busy. Keep your changes and retry shortly.",
                  extensions: { code: "SERVICE_BUSY" },
                },
              ],
            },
            {
              status: 503,
              headers: {
                "Cache-Control": "no-store",
                "Retry-After": String(
                  REQUEST_ADMISSION_LIMITS.retryAfterSeconds,
                ),
              },
            },
          );
        active += 1;
        try {
          return await requestHandler(request, context, fetchAPI);
        } finally {
          // A deadline may already have returned a response. Count unfinished
          // work until this handler's own storage/transport cleanup settles.
          active -= 1;
        }
      });
    },
  };
}
