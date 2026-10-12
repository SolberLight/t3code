import type {
  PreviewStreamEvents,
  PreviewStreamInput,
} from "@t3tools/client-runtime/preview/server-browser-stream";
import { afterEach, expect, it, vi } from "vite-plus/test";

const client = vi.hoisted(() => ({
  events: null as PreviewStreamEvents | null,
  sent: [] as PreviewStreamInput[],
}));

vi.mock("@t3tools/client-runtime/preview/server-browser-stream", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createPreviewFramePainter: () => ({ paint() {}, stop() {} }),
  createPreviewStreamClient: (_target: unknown, events: PreviewStreamEvents) => {
    client.events = events;
    return {
      send: (input: PreviewStreamInput) => {
        client.sent.push(input);
        return true;
      },
      stop() {},
    };
  },
}));

import { holdPageSize, start, stop } from "./preview-stream.browser";

class Element extends EventTarget {
  readonly style = {};
  value = "";
  disabled = false;
  className = "";
  innerHTML = "";
  rect = { left: 0, top: 0, width: 390, height: 700 };
  setAttribute() {}
  append() {}
  prepend() {}
  focus() {}
  blur() {}
  setSelectionRange() {}
  getBoundingClientRect() {
    return this.rect;
  }
}

async function setup() {
  vi.useFakeTimers();
  const elements: Element[] = [];
  vi.stubGlobal("document", {
    body: { style: {}, replaceChildren() {} },
    createElement: () => {
      const element = new Element();
      elements.push(element);
      return element;
    },
  });
  vi.stubGlobal("window", { ReactNativeWebView: { postMessage() {} }, addEventListener() {} });
  // Only the prototype is read, to detect picture in picture support.
  vi.stubGlobal("HTMLVideoElement", { prototype: {} });
  let observed = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observed = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  start({
    access: {
      httpBase: "https://env.test",
      wsBase: "wss://env.test",
      query: {},
      credentials: false,
    },
    threadId: "thread",
    tabId: "tab",
    interactive: true,
    background: "black",
  });
  // The first element is the container the view measures.
  const [container] = elements;
  const resizeView = async (width: number, height: number) => {
    container!.rect = { ...container!.rect, width, height };
    observed();
    await vi.advanceTimersByTimeAsync(150);
  };
  await resizeView(390, 700);
  client.events?.onControl?.({
    canOperate: true,
    controller: "you",
    generation: 1,
    dialog: null,
  });
  return { resizeView };
}

const resizes = () => client.sent.filter((input) => input.type === "resize");

afterEach(() => {
  stop();
  client.events = null;
  client.sent = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps the page size while the view floats in picture in picture", async () => {
  const { resizeView } = await setup();
  expect(resizes()).toEqual([{ type: "resize", width: 390, height: 700 }]);

  holdPageSize(true);
  await resizeView(240, 430);
  expect(resizes()).toHaveLength(1);

  holdPageSize(false);
  await resizeView(390, 700);
  expect(resizes().at(-1)).toEqual({ type: "resize", width: 390, height: 700 });
  expect(resizes()).not.toContainEqual({ type: "resize", width: 240, height: 430 });
});
