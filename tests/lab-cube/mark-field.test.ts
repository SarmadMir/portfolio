import { afterEach, describe, expect, it, vi } from "vitest";
import { computeMarkField } from "@/app/lab/cube/mark-field";

const mark = { d: "M0 0H1V1Z", viewBox: [0, 0, 1, 1] as [number, number, number, number] };
const field = { data: new Uint8Array(4), size: 2 };

/** A stand-in for a module worker: the test decides how it answers. */
class FakeWorker {
  static last: FakeWorker | null = null;
  static behaviour: "reply" | "error" | "silent" = "reply";
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { preventDefault(): void }) => void) | null = null;
  terminated = false;
  constructor() {
    FakeWorker.last = this;
  }
  postMessage() {
    queueMicrotask(() => {
      if (FakeWorker.behaviour === "reply") this.onmessage?.({ data: field });
      if (FakeWorker.behaviour === "error") this.onerror?.({ preventDefault() {} });
    });
  }
  terminate() {
    this.terminated = true;
  }
}

/** A document whose canvas has no 2D context: the main-thread fallback fails with a known message. */
const noCanvas = { createElement: () => ({ getContext: () => null }) };

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.last = null;
  FakeWorker.behaviour = "reply";
});

function stubWorker(worker: unknown = FakeWorker) {
  vi.stubGlobal("OffscreenCanvas", class {});
  vi.stubGlobal("Worker", worker);
  vi.stubGlobal("document", noCanvas);
}

describe("building the mark's distance field", () => {
  it("resolves with the worker's field and stops the worker", async () => {
    stubWorker();
    await expect(computeMarkField(mark, new AbortController().signal)).resolves.toEqual(field);
    expect(FakeWorker.last?.terminated).toBe(true);
  });

  it("rejects with an AbortError and stops the worker when aborted", async () => {
    stubWorker();
    FakeWorker.behaviour = "silent";
    const abort = new AbortController();
    const pending = computeMarkField(mark, abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeWorker.last?.terminated).toBe(true);
  });

  it("falls back to the main thread when the worker fails, and rejects when that fails too", async () => {
    stubWorker();
    FakeWorker.behaviour = "error";
    await expect(computeMarkField(mark, new AbortController().signal)).rejects.toThrow(/No 2D canvas/);
    expect(FakeWorker.last?.terminated).toBe(true);
  });

  it("falls back to the main thread when the worker cannot be created at all", async () => {
    stubWorker(
      class {
        constructor() {
          throw new DOMException("Blocked by the content security policy.", "SecurityError");
        }
      },
    );
    await expect(computeMarkField(mark, new AbortController().signal)).rejects.toThrow(/No 2D canvas/);
  });
});
