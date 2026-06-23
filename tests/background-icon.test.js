const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const iconCalls = [];
const titleCalls = [];
let messageListener;

class FakeContext {
  clearRect() {}
  beginPath() {}
  arc() {}
  fill() {}
  stroke() {}
  fillText() {}
  getImageData() {
    return { mockedImageData: true };
  }
}

class FakeOffscreenCanvas {
  getContext() {
    return new FakeContext();
  }
}

const chrome = {
  action: {
    async setIcon(options) {
      iconCalls.push(options);
    },
    async setTitle(options) {
      titleCalls.push(options);
    }
  },
  runtime: {
    onMessage: {
      addListener(listener) {
        messageListener = listener;
      }
    },
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} }
  },
  sidePanel: {
    async setPanelBehavior() {}
  },
  tabs: {
    onUpdated: { addListener() {} }
  }
};

const source = fs.readFileSync(
  path.join(__dirname, "..", "background.js"),
  "utf8"
);

vm.runInNewContext(source, {
  chrome,
  OffscreenCanvas: FakeOffscreenCanvas,
  Set,
  Object,
  Math,
  Number,
  console
});

messageListener(
  { type: "CLEARANCE_RESULT", result: { status: "required" } },
  { tab: { id: 42 } }
);

setImmediate(() => {
  const alertIcon = iconCalls.find((call) => call.tabId === 42);
  const alertTitle = titleCalls.find((call) => call.tabId === 42);
  assert.ok(alertIcon, "required status should update the tab icon");
  assert.match(alertTitle.title, /Clearance required/);

  messageListener(
    { type: "CLEARANCE_RESULT", result: { status: "not_mentioned" } },
    { tab: { id: 42 } }
  );

  setImmediate(() => {
    assert.equal(
      titleCalls.at(-1).title,
      "Open Clearance Check",
      "a non-clearance result should restore the normal icon title"
    );
    console.log("Passed toolbar icon state test.");
  });
});
