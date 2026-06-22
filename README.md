# LinkedIn Clearance Check

A small Chrome extension that reads the selected LinkedIn job's **About the
job** section and warns only when the description contains an actual
security-clearance requirement.

## What counts as a warning

- An active/current Secret, Top Secret, or TS/SCI clearance
- A clearance explicitly marked required or mandatory
- A requirement to obtain or maintain a clearance
- A required polygraph

General words such as `security`, `cybersecurity`, `SOC`, `background check`,
`NIST`, or `incident response` do not create a red warning.

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this `linkedin-clearance-checker` folder.
5. Open LinkedIn Jobs and click the extension icon to open its side panel.

After changing the source, use **Reload extension** in the side panel or the
reload button on `chrome://extensions`.

## Behavior

- The selected job description is rescanned automatically as LinkedIn changes
  jobs without a full page reload.
- A red diagonal label is added to the selected job card only for an explicit
  requirement.
- Ambiguous mentions appear as **Mentioned — review manually** in the side
  panel but do not create a red label.
- All processing happens locally in the browser.

## Test

```powershell
node tests/detector.test.js
```
