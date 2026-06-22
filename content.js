(function initializeLinkedInClearanceChecker() {
  try {
    globalThis.__linkedinClearanceCheckerCleanup?.();
  } catch {
    // An older extension context may already be invalid after a reload.
  }

  const DESCRIPTION_SELECTORS = [
    "#job-details",
    ".jobs-description__content",
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    ".jobs-description",
    "[data-job-details-description]"
  ];

  const TITLE_SELECTORS = [
    ".job-details-jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title",
    "main h1"
  ];

  const COMPANY_SELECTORS = [
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    ".job-details-jobs-unified-top-card__primary-description-container a"
  ];

  const ACTIVE_CARD_SELECTORS = [
    ".jobs-search-results-list__list-item--active",
    ".job-card-container--active",
    ".jobs-search-results__list-item:has(.job-card-container--active)",
    ".scaffold-layout__list-item:has(.job-card-container--active)",
    "[aria-current='true'][href*='/jobs/view/']"
  ];

  let scanTimer;
  let periodicTimer;
  let lastSignature = "";

  function normalize(text) {
    return globalThis.ClearanceDetector?.normalize(text) || String(text || "").trim();
  }

  function isVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  function extractAboutTheJob(rawText) {
    const text = normalize(rawText);
    if (!text) return "";

    const heading = /(?:^|\n)\s*About the job\s*(?:\n|$)/i.exec(text);
    const start = heading ? heading.index + heading[0].length : 0;
    let section = text.slice(start);

    const boundaries = [
      /\n\s*Set alert for similar jobs\s*(?:\n|$)/i,
      /\n\s*About the company\s*(?:\n|$)/i,
      /\n\s*Job search faster with Premium\s*(?:\n|$)/i,
      /\n\s*Company photos\s*(?:\n|$)/i,
      /\n\s*More jobs\s*(?:\n|$)/i
    ];

    let end = section.length;
    for (const boundary of boundaries) {
      const match = boundary.exec(section);
      if (match && match.index < end) end = match.index;
    }

    return normalize(section.slice(0, end));
  }

  function getDescription() {
    const candidates = [];

    for (const selector of DESCRIPTION_SELECTORS) {
      for (const element of document.querySelectorAll(selector)) {
        if (
          !isVisible(element) ||
          element.closest(
            ".scaffold-layout__list, .jobs-search-results-list, .jobs-search-results-list__list"
          )
        ) {
          continue;
        }

        const text = extractAboutTheJob(element.innerText);
        if (text.length >= 40) {
          const rect = element.getBoundingClientRect();
          candidates.push({ text, left: rect.left });
        }
      }
    }

    candidates.sort((a, b) => b.left - a.left || b.text.length - a.text.length);
    if (candidates[0]) return candidates[0].text;

    // LinkedIn's newer full-page job view no longer uses the old class names.
    // The visible main text still has stable "About the job" section boundaries.
    const mainText = document.querySelector("main")?.innerText;
    if (/\bAbout the job\b/i.test(mainText || "")) {
      const section = extractAboutTheJob(mainText);
      if (section.length >= 40) return section;
    }

    return "";
  }

  function textFromFirst(selectors) {
    for (const selector of selectors) {
      const text = document.querySelector(selector)?.innerText;
      if (normalize(text)) return normalize(text);
    }
    return "";
  }

  function getTitle() {
    const pageTitle = textFromFirst(TITLE_SELECTORS);
    if (pageTitle) return pageTitle;

    const documentTitle = normalize(document.title);
    return documentTitle.split(" | ")[0] || "";
  }

  function getCompany() {
    const company = textFromFirst(COMPANY_SELECTORS);
    if (company) return company;

    const parts = normalize(document.title).split(" | ");
    return parts.length >= 3 ? parts[1] : "";
  }

  function currentJobId() {
    const url = new URL(location.href);
    const fromQuery = url.searchParams.get("currentJobId");
    if (fromQuery) return fromQuery;
    return url.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] || "";
  }

  function findSelectedCard(title) {
    for (const selector of ACTIVE_CARD_SELECTORS) {
      const active = document.querySelector(selector);
      if (active) return active.closest("li") || active;
    }

    const jobId = currentJobId();
    if (jobId) {
      const matchingLinks = [...document.querySelectorAll("a[href*='/jobs/view/']")]
        .filter((link) => link.href.includes(`/jobs/view/${jobId}`))
        .filter((link) =>
          link.closest(
            ".scaffold-layout__list, .jobs-search-results-list, .jobs-search-results-list__list"
          )
        );
      if (matchingLinks[0]) return matchingLinks[0].closest("li") || matchingLinks[0];
    }

    const expected = normalize(title).toLowerCase();
    if (!expected) return null;
    for (const link of document.querySelectorAll("a[href*='/jobs/view/']")) {
      if (
        link.closest(
          ".scaffold-layout__list, .jobs-search-results-list, .jobs-search-results-list__list"
        ) &&
        normalize(link.innerText).toLowerCase().startsWith(expected)
      ) {
        return link.closest("li") || link;
      }
    }

    return null;
  }

  function findCardTitle(card) {
    if (!card) return null;
    return (
      card.querySelector(".job-card-list__title") ||
      card.querySelector(".job-card-container__link") ||
      card.querySelector("a[href*='/jobs/view/'] strong") ||
      card.querySelector("a[href*='/jobs/view/'] span[aria-hidden='true']") ||
      card.querySelector("a[href*='/jobs/view/']")
    );
  }

  function removeBadges() {
    for (const badge of document.querySelectorAll(".cc-clearance-ribbon")) {
      const host = badge.parentElement;
      badge.remove();
      host?.classList.remove("cc-listing-title-host");
    }
  }

  function updateBadge(result) {
    removeBadges();
    if (!["required", "obtainable"].includes(result.status)) return;

    const titleElement = findCardTitle(findSelectedCard(result.title));
    if (!titleElement) return;

    let label = "CLEARANCE";
    const critical = result.criticalMatches?.[0]?.toUpperCase() || "";
    if (critical.includes("POLY")) label = "POLYGRAPH";
    else if (critical.includes("TS") || critical.includes("TOP SECRET")) {
      label = "TS / SCI";
    }

    titleElement.classList.add("cc-listing-title-host");
    const badge = document.createElement("span");
    badge.className = "cc-clearance-ribbon";
    badge.textContent = label;
    badge.setAttribute("aria-label", "This job requires a security clearance.");
    if (critical) badge.classList.add("cc-clearance-ribbon--critical");
    titleElement.append(badge);
  }

  function buildResult() {
    const description = getDescription();
    const title = getTitle();
    const company = getCompany();

    if (!description) {
      return {
        status: "loading",
        title,
        company,
        matches: [],
        criticalMatches: [],
        message: "Waiting for the selected job description to load.",
        url: location.href
      };
    }

    return {
      ...globalThis.ClearanceDetector.analyze(description),
      title,
      company,
      url: location.href,
      scannedAt: new Date().toISOString()
    };
  }

  function runScan({ notify = false } = {}) {
    const result = buildResult();
    updateBadge(result);

    const signature = JSON.stringify({
      status: result.status,
      title: result.title,
      company: result.company,
      matches: result.matches,
      url: result.url
    });

    if (notify && signature !== lastSignature) {
      lastSignature = signature;
      try {
        chrome.runtime
          .sendMessage({ type: "CLEARANCE_RESULT", result })
          ?.catch?.(() => {});
      } catch {
        // The old page context can briefly outlive an extension reload.
      }
    }

    return result;
  }

  function scheduleScan(delay = 500) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => runScan({ notify: true }), delay);
  }

  function handleMessage(message, sender, sendResponse) {
    if (message?.type === "REQUEST_CLEARANCE_SCAN") {
      sendResponse(runScan());
    }
  }

  const observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  chrome.runtime.onMessage.addListener(handleMessage);
  window.addEventListener("popstate", scheduleScan);
  periodicTimer = setInterval(() => scheduleScan(100), 1500);

  globalThis.__clearanceCheckerTest = {
    extractAboutTheJob,
    getDescription,
    analyzeClearance: globalThis.ClearanceDetector.analyze
  };

  globalThis.__linkedinClearanceCheckerCleanup = () => {
    clearTimeout(scanTimer);
    clearInterval(periodicTimer);
    observer.disconnect();
    window.removeEventListener("popstate", scheduleScan);
    try {
      chrome.runtime.onMessage.removeListener(handleMessage);
    } catch {
      // The listener is already gone after an extension reload.
    }
    removeBadges();
  };

  scheduleScan(100);
})();
