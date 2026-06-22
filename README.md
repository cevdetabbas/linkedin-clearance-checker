# LinkedIn Clearance Check

A Chrome Manifest V3 extension that scans LinkedIn job descriptions for
security clearance requirements and displays the result in Chrome's side
panel.

Possible results:

- Clearance required
- Must be able to obtain clearance
- Clearance not required
- Review manually
- Clearance not mentioned

Strong phrases such as TS/SCI, Top Secret, and polygraph trigger a prominent
red warning in the side panel. Selected jobs that require clearance also
receive a tilted red badge in the left-hand job list.

## Installation

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `linkedin-clearance-checker` folder.
5. Open a LinkedIn job listing.
6. Click the extension icon to open the side panel.

All analysis runs locally in the browser. Job listing data is not sent to an
external server.
