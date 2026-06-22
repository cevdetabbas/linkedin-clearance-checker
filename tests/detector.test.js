const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "clearance-detector.js"),
  "utf8"
);
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const detector = context.globalThis.ClearanceDetector;

const cases = [
  {
    name: "ordinary cybersecurity job",
    text: "We need a security engineer with SIEM, EDR, and incident response experience.",
    status: "not_mentioned"
  },
  {
    name: "background check only",
    text: "Employment is contingent on a standard background check.",
    status: "not_mentioned"
  },
  {
    name: "active Secret",
    text: "Candidates must possess an active Secret clearance.",
    status: "required"
  },
  {
    name: "TS/SCI",
    text: "An active TS/SCI clearance is required for this position.",
    status: "required"
  },
  {
    name: "clearance level listed in qualifications",
    text: "Required qualifications\nTop Secret clearance\nFive years of experience",
    status: "required"
  },
  {
    name: "polygraph",
    text: "Applicants must pass a counterintelligence polygraph.",
    status: "required"
  },
  {
    name: "ability to obtain",
    text: "You must be able to obtain and maintain a Secret security clearance.",
    status: "obtainable"
  },
  {
    name: "explicitly not required",
    text: "No security clearance is required for this commercial role.",
    status: "not_required"
  },
  {
    name: "specific clearance explicitly not required",
    text: "No Secret clearance is required.",
    status: "not_required"
  },
  {
    name: "ambiguous mention",
    text: "Our customers operate in environments involving security clearance programs.",
    status: "review"
  }
];

for (const testCase of cases) {
  const result = detector.analyze(testCase.text);
  assert.equal(result.status, testCase.status, testCase.name);
}

console.log(`Passed ${cases.length} clearance-detector cases.`);
