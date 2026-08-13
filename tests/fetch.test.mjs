import assert from "node:assert/strict";
import test from "node:test";

import { createFetchWithTimeout } from "../src/server/fetch.ts";

const noWait = async () => {};
const noLog = () => {};

test("retries recoverable HTTP responses once and cancels their bodies", async () => {
  for (const status of [429, 500, 503]) {
    let calls = 0;
    let cancelled = false;
    const client = createFetchWithTimeout({
      fetcher: async () => {
        calls += 1;
        if (calls === 1) {
          return new Response(new ReadableStream({ cancel: () => { cancelled = true; } }), { status });
        }
        return Response.json({ ok: true });
      },
      sleep: noWait,
      onRetry: noLog,
    });

    const response = await client("https://example.com/schedule");
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    assert.equal(cancelled, true);
  }
});

test("returns the final recoverable HTTP response after the retry is exhausted", async () => {
  let calls = 0;
  const client = createFetchWithTimeout({
    fetcher: async () => {
      calls += 1;
      return new Response(null, { status: 503 });
    },
    sleep: noWait,
    onRetry: noLog,
  });

  const response = await client("https://example.com/schedule");
  assert.equal(response.status, 503);
  assert.equal(calls, 2);
});

test("retries network failures and uses a fresh timeout signal", async () => {
  const signals = [];
  const retryEvents = [];
  const client = createFetchWithTimeout({
    fetcher: async (_input, init) => {
      signals.push(init.signal);
      if (signals.length === 1) throw new TypeError("network unavailable");
      return Response.json({ ok: true });
    },
    sleep: noWait,
    onRetry: (event) => retryEvents.push(event),
  });

  const response = await client("https://example.com/schedule");
  assert.equal(response.status, 200);
  assert.equal(signals.length, 2);
  assert.notEqual(signals[0], signals[1]);
  assert.equal(retryEvents[0].nextAttempt, 2);
  assert.equal(retryEvents[0].errorType, "TypeError");
});

test("retries timed out attempts with a fresh timeout", async () => {
  const signals = [];
  const client = createFetchWithTimeout({
    timeoutMs: 5,
    fetcher: async (_input, init) => {
      signals.push(init.signal);
      await new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
      });
      throw new Error("unreachable");
    },
    sleep: noWait,
    onRetry: noLog,
  });

  await assert.rejects(client("https://example.com/schedule"), /timed out|timeout/i);
  assert.equal(signals.length, 2);
  assert.notEqual(signals[0], signals[1]);
});

test("does not retry non-recoverable HTTP responses or caller cancellation", async () => {
  let httpCalls = 0;
  const httpClient = createFetchWithTimeout({
    fetcher: async () => {
      httpCalls += 1;
      return new Response(null, { status: 400 });
    },
    sleep: noWait,
    onRetry: noLog,
  });
  assert.equal((await httpClient("https://example.com/schedule")).status, 400);
  assert.equal(httpCalls, 1);

  let cancelledCalls = 0;
  const controller = new AbortController();
  controller.abort(new DOMException("cancelled", "AbortError"));
  const cancelledClient = createFetchWithTimeout({
    fetcher: async () => {
      cancelledCalls += 1;
      return Response.json({ ok: true });
    },
    sleep: noWait,
    onRetry: noLog,
  });
  await assert.rejects(
    cancelledClient("https://example.com/schedule", { signal: controller.signal }),
    /cancelled/,
  );
  assert.equal(cancelledCalls, 0);
});
