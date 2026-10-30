import { useEffect, useState } from "react";

/**
 * Runs `fetcher(params)` whenever `params` change, and keeps the last answer.
 * Until a newer answer arrives, the previous one stays, marked `stale`, so the screen doesn't
 * empty on every filter change, and a slow answer to an older request never replaces a newer one.
 * `params` must be plain JSON (strings, numbers, null). Define `fetcher` outside the component,
 * so it's the same function on every render.
 * Returns { data, error, loaded, stale, retry }: `data` or `error` is the last answer, `loaded`
 * says whether there has been one at all.
 */
export default function useFetched(fetcher, params) {
  const [retries, setRetries] = useState(0);
  // { key, data } or { key, error }: `key` says which request the answer is for.
  const [answer, setAnswer] = useState(null);
  const key = JSON.stringify([params, retries]);

  useEffect(() => {
    let current = true;
    fetcher(JSON.parse(key)[0]).then(
      data => current && setAnswer({ key, data }),
      err => current && setAnswer({ key, error: err.message || String(err) })
    );
    return () => {
      current = false;
    };
  }, [fetcher, key]);

  return {
    data: answer?.data,
    error: answer?.error,
    loaded: answer !== null,
    stale: answer?.key !== key,
    retry: () => setRetries(n => n + 1)
  };
}
