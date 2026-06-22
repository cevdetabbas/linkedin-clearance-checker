(function initializeClearanceChecker() {
  try {
    globalThis.__linkedinClearanceCheckerCleanup?.();
  } catch {
    // The previous extension context may already be invalid.
  }

  const DESCRIPTION_SELECTORS = [
    ".jobs-description-content__text",
    ".jobs-description__content",
    ".jobs-box__html-content",
    ".jobs-description",
    ".jobs-description__container",
    "[data-job-details]",
    "[data-view-name*='job-description']",
    "[class*='jobs-description']",
    "#job-details",
    ".job-details-module"
  ];

  const DETAIL_PANE_SELECTORS = [
    ".jobs-search__job-details--container",
    ".jobs-search__job-details",
    ".scaffold-layout__detail",
    ".job-view-layout",
    "[data-view-name*='job-details']",
    "#job-details"
  ];

  const TITLE_SELECTORS = [
    ".job-details-jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title",
    "[data-view-name*='job-title']",
    "a[href*='/jobs/view/'][aria-label] h1",
    "main h1"
  ];

  const COMPANY_SELECTORS = [
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    ".job-details-jobs-unified-top-card__primary-description-container a",
    "[data-view-name*='job-company']"
  ];

  const ACTIVE_LISTING_SELECTORS = [
    ".jobs-search-results-list__list-item--active",
    ".job-card-container--active",
    ".jobs-search-results__list-item:has(.job-card-container--active)",
    ".scaffold-layout__list-item:has(.job-card-container--active)",
    "[aria-current='true'][href*='/jobs/view/']"
  ];

  const LISTING_TITLE_SELECTORS = [
    ".job-card-list__title",
    ".job-card-container__link",
    "a[href*='/jobs/view/'] strong",
    "a[href*='/jobs/view/'] span[aria-hidden='true']",
    "a[href*='/jobs/view/']"
  ];

  const RULES = {
    critical: [
      /\bts\s*\/\s*sci\b/gi,
      /\bts[\s-]?sci\b/gi,
      /\btop secret(?:\/sci)?\b/gi,
      /\b(?:full scope|lifestyle|counterintelligence|ci)\s+poly(?:graph)?\b/gi,
      /\bpolygraph\b/gi,
      /\b(?:active|current)\s+(?:dod\s+)?secret clearance\b/gi,
      /\b(?:secret|top secret)\s+clearance\b/gi
    ],
    notRequired: [
      /\bno (?:(?:secret|top secret|ts\/sci|ts sci|security) )?clearance (?:is )?required\b/gi,
      /\b(?:(?:secret|top secret|ts\/sci|ts sci|security) )?clearance (?:is )?not required\b/gi,
      /\bdoes not require (?:a |an )?(?:security )?clearance\b/gi,
      /\bwithout (?:a |an )?(?:security )?clearance\b/gi
    ],
    obtainable: [
      /\bability to obtain(?: and maintain)? (?:a |an )?(?:[a-z/-]+\s+){0,3}(?:security )?clearance\b/gi,
      /\bable to obtain(?: and maintain)? (?:a |an )?(?:[a-z/-]+\s+){0,3}(?:security )?clearance\b/gi,
      /\beligib(?:le|ility) (?:for|to obtain)(?: and maintain)? (?:a |an )?(?:[a-z/-]+\s+){0,3}(?:security )?clearance\b/gi,
      /\bmust be (?:clearance )?eligible\b/gi,
      /\bwilling(?:ness)? to (?:obtain|undergo)(?: and maintain)? (?:a |an )?(?:[a-z/-]+\s+){0,3}(?:security )?clearance\b/gi,
      /\bclearance sponsorship\b/gi
    ],
    required: [
      /\bactive (?:u\.?s\.? )?(?:dod )?(?:secret|top secret|ts\/sci|security) clearance\b/gi,
      /\bcurrent(?:ly)? (?:hold|possess|maintain)(?:s|ing)? (?:a |an )?(?:active )?(?:[a-z/-]+\s+){0,3}(?:security )?clearance\b/gi,
      /\bmust (?:have|hold|possess|maintain)(?: a| an)? (?:active )?(?:[a-z/-]+\s+){0,3}(?:security )?clearance\b/gi,
      /\b(?:security )?clearance (?:is )?required\b/gi,
      /\brequires? (?:a |an )?(?:active )?(?:[a-z/-]+\s+){0,3}(?:security )?clearance\b/gi,
      /\b(?:minimum|required) clearance(?: level)?:?\s*(?:secret|top secret|ts\/sci|confidential)\b/gi,
      /\b(?:secret|top secret|ts\/sci|ts sci) clearance\b/gi,
      /\bactive (?:secret|top secret|ts\/sci|ts sci)\b/gi,
      /\b(?:secret|top secret|ts\/sci|ts sci) (?:is )?required\b/gi,
      /\bpolygraph (?:is )?required\b/gi
    ],
    review: [
      /\bsecurity clearance\b/gi,
      /\bpublic trust\b/gi,
      /\bbackground investigation\b/gi,
      /\bgovernment clearance\b/gi,
      /\bclearable\b/gi,
      /\b(?:secret|top secret|ts\/sci|ts sci)\b/gi
    ]
  };

  let lastSignature = "";
  let scanTimer;
  let lastUrl = location.href;

  function normalize(text) {
    return (text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizedComparisonText(text) {
    return normalize(text).toLocaleLowerCase("en-US");
  }

  function textFromFirst(selectors) {
    for (const selector of selectors) {
      const text = document.querySelector(selector)?.innerText?.trim();
      if (text) return text;
    }
    return "";
  }

  function textFromFirstWithin(root, selectors) {
    if (!root) return "";
    for (const selector of selectors) {
      const text = normalize(root.querySelector(selector)?.innerText);
      if (text) return text;
    }
    return "";
  }

  function textFromBestWithin(root, selectors) {
    if (!root) return "";
    const candidates = [];
    for (const selector of selectors) {
      root.querySelectorAll(selector).forEach((element) => {
        const text = normalize(element.innerText);
        if (text.length >= 120) candidates.push(text);
      });
    }
    return candidates.sort((left, right) => right.length - left.length)[0] || "";
  }

  function getCurrentJobId() {
    const url = new URL(location.href);
    return (
      url.searchParams.get("currentJobId") ||
      url.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ||
      ""
    );
  }

  function jobIdFromLink(link) {
    if (!link) return "";
    try {
      const url = new URL(link.href, location.origin);
      return (
        url.searchParams.get("currentJobId") ||
        url.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ||
        ""
      );
    } catch {
      return "";
    }
  }

  function getDetailPane() {
    for (const selector of DETAIL_PANE_SELECTORS) {
      const candidates = [...document.querySelectorAll(selector)].filter(
        (element) => normalize(element.innerText).length >= 120
      );
      if (candidates.length) {
        return candidates.sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          return rightRect.left - leftRect.left;
        })[0];
      }
    }

    return null;
  }

  function findMatches(text, patterns) {
    const matches = [];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let result;
      while ((result = pattern.exec(text)) !== null) {
        const clean = result[0].replace(/\s+/g, " ").trim();
        if (
          clean &&
          !matches.some((item) => item.toLowerCase() === clean.toLowerCase())
        ) {
          matches.push(clean);
        }
        if (matches.length >= 6) return matches;
      }
    }
    return matches;
  }

  function removeMatches(text, patterns) {
    let cleaned = text;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      cleaned = cleaned.replace(pattern, " ");
    }
    return cleaned;
  }

  function analyzeClearance(text) {
    const criticalMatches = findMatches(text, RULES.critical);
    const notRequiredMatches = findMatches(text, RULES.notRequired);
    if (notRequiredMatches.length) {
      return {
        status: "not_required",
        matches: notRequiredMatches,
        criticalMatches: []
      };
    }

    if (criticalMatches.length) {
      return {
        status: "required",
        matches: criticalMatches,
        criticalMatches
      };
    }

    const obtainableMatches = findMatches(text, RULES.obtainable);
    const requiredMatches = findMatches(
      removeMatches(text, RULES.obtainable),
      RULES.required
    );

    if (requiredMatches.length) {
      return {
        status: "required",
        matches: [...requiredMatches, ...obtainableMatches].slice(0, 6),
        criticalMatches
      };
    }

    if (obtainableMatches.length) {
      return {
        status: "obtainable",
        matches: obtainableMatches,
        criticalMatches
      };
    }

    const reviewMatches = findMatches(text, RULES.review);
    if (reviewMatches.length) {
      return {
        status: "review",
        matches: reviewMatches,
        criticalMatches
      };
    }

    return {
      status: "not_mentioned",
      matches: [],
      criticalMatches: []
    };
  }

  function getJobDescription() {
    const detailPane = getDetailPane();
    if (!detailPane) return "";

    const preferred = textFromBestWithin(detailPane, DESCRIPTION_SELECTORS);
    if (preferred.length >= 120) return preferred;

    const paneText = normalize(detailPane.innerText);
    return paneText.length >= 120 ? paneText : "";
  }

  function findActiveListingCard() {
    const jobId = getCurrentJobId();
    if (jobId) {
      for (const link of document.querySelectorAll("a[href*='/jobs/']")) {
        if (jobIdFromLink(link) === jobId) {
          return (
            link.closest(
              ".jobs-search-results__list-item, .scaffold-layout__list-item, li"
            ) || link
          );
        }
      }
    }

    for (const selector of ACTIVE_LISTING_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) return element.closest("li") || element;
    }
    return null;
  }

  function findListingByTitle(title) {
    const expected = normalizedComparisonText(title);
    if (!expected) return null;

    const links = document.querySelectorAll(
      "a[href*='/jobs/view/'], .job-card-list__title"
    );
    for (const link of links) {
      const candidate = normalizedComparisonText(link.innerText);
      if (candidate === expected || candidate.startsWith(`${expected} `)) {
        return link.closest("li") || link;
      }
    }
    return null;
  }

  function findListingTitleElement(card) {
    if (!card) return null;
    for (const selector of LISTING_TITLE_SELECTORS) {
      if (card.matches?.(selector)) return card;
      const title = card.querySelector?.(selector);
      if (title) return title;
    }
    return null;
  }

  function removeListingBadges() {
    document.querySelectorAll(".cc-clearance-ribbon").forEach((badge) => {
      const host = badge.parentElement;
      badge.remove();
      host?.classList.remove("cc-listing-title-host");
    });
  }

  function updateListingBadge(result) {
    if (!["required", "obtainable"].includes(result.status)) {
      removeListingBadges();
      return;
    }

    const card = findActiveListingCard() || findListingByTitle(result.title);
    const titleElement = findListingTitleElement(card);
    if (!titleElement) {
      removeListingBadges();
      return;
    }

    const badgeText = "CLEARANCE";
    const isCritical = result.criticalMatches.length > 0;

    const current = titleElement.querySelector(
      ":scope > .cc-clearance-ribbon"
    );
    if (
      current?.textContent === badgeText &&
      current.classList.contains("cc-clearance-ribbon--critical") === isCritical
    ) {
      return;
    }

    removeListingBadges();
    titleElement.classList.add("cc-listing-title-host");
    const badge = document.createElement("span");
    badge.className = "cc-clearance-ribbon";
    badge.textContent = badgeText;
    badge.setAttribute("aria-label", "This job requires security clearance");
    if (isCritical) badge.classList.add("cc-clearance-ribbon--critical");
    titleElement.append(badge);
  }

  function buildResult() {
    const detailPane = getDetailPane();
    const description = normalize(getJobDescription());
    const title = normalize(
      textFromFirstWithin(detailPane, TITLE_SELECTORS) ||
        textFromFirst(TITLE_SELECTORS)
    );
    const company = normalize(
      textFromFirstWithin(detailPane, COMPANY_SELECTORS) ||
        textFromFirst(COMPANY_SELECTORS)
    );

    if (!description) {
      return {
        status: "error",
        title,
        company,
        matches: [],
        criticalMatches: [],
        message:
          "The job description is not visible yet. Scan again after it loads."
      };
    }

    return {
      ...analyzeClearance(description),
      title,
      company,
      jobId: getCurrentJobId(),
      url: location.href,
      scannedAt: new Date().toISOString()
    };
  }

  function runScan({ notify = false } = {}) {
    const result = buildResult();
    updateListingBadge(result);
    const signature = JSON.stringify(result);

    if (notify && signature !== lastSignature) {
      lastSignature = signature;
      try {
        chrome.runtime
          .sendMessage({ type: "CLEARANCE_RESULT", result })
          ?.catch?.(() => {});
      } catch {
        // The previous context may briefly remain active during an extension reload.
      }
    }
    return result;
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => runScan({ notify: true }), 700);
  }

  function checkForNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSignature = "";
      scheduleScan();
    }
  }

  function handleRuntimeMessage(message, sender, sendResponse) {
    if (message?.type === "REQUEST_CLEARANCE_SCAN") {
      sendResponse(runScan());
    }
  }

  globalThis.__clearanceCheckerTest = { analyzeClearance };

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("hashchange", scheduleScan);
  document.addEventListener("click", checkForNavigation, true);
  const navigationTimer = setInterval(checkForNavigation, 500);

  globalThis.__linkedinClearanceCheckerCleanup = () => {
    clearTimeout(scanTimer);
    observer.disconnect();
    window.removeEventListener("popstate", scheduleScan);
    window.removeEventListener("hashchange", scheduleScan);
    document.removeEventListener("click", checkForNavigation, true);
    clearInterval(navigationTimer);
    try {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    } catch {
      // The previous runtime listener may no longer be available.
    }
  };

  scheduleScan();
})();
