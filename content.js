(function initializeClearanceChecker() {
try {
  globalThis.__linkedinClearanceCheckerCleanup?.();
} catch {
  // Eski uzantı context'i geçersizse temizleme çağrısı başarısız olabilir.
}

const DESCRIPTION_SELECTORS = [
  ".jobs-description-content__text",
  ".jobs-description__content",
  ".jobs-box__html-content",
  ".jobs-description",
  "#job-details",
  ".job-details-module"
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

function normalizedComparisonText(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function textFromFirst(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element?.innerText?.trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function findActiveListingCard() {
  for (const selector of ACTIVE_LISTING_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) {
      return element.closest("li") || element;
    }
  }
  return null;
}

function findListingByTitle(title) {
  const expectedTitle = normalizedComparisonText(title);
  if (!expectedTitle) {
    return null;
  }

  const links = document.querySelectorAll(
    "a[href*='/jobs/view/'], .job-card-list__title"
  );

  for (const link of links) {
    const candidate = normalizedComparisonText(link.innerText);
    if (
      candidate === expectedTitle ||
      candidate.startsWith(`${expectedTitle} `)
    ) {
      return link.closest("li") || link;
    }
  }

  return null;
}

function findListingTitleElement(card) {
  if (!card) {
    return null;
  }

  for (const selector of LISTING_TITLE_SELECTORS) {
    if (card.matches?.(selector)) {
      return card;
    }

    const title = card.querySelector?.(selector);
    if (title) {
      return title;
    }
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

  let badgeText = "CLEARANCE";
  let isCritical = false;
  if (Array.isArray(result.criticalMatches) && result.criticalMatches.length > 0) {
    isCritical = true;
    const firstCritical = result.criticalMatches[0].toUpperCase();
    badgeText = firstCritical.includes("POLY")
      ? "POLYGRAPH"
      : firstCritical.includes("TS") || firstCritical.includes("TOP SECRET")
        ? "TS / SCI"
        : "CLEARANCE";
  }

  const currentBadge = titleElement.querySelector(":scope > .cc-clearance-ribbon");
  const currentIsCritical = currentBadge?.classList.contains(
    "cc-clearance-ribbon--critical"
  );
  if (
    currentBadge &&
    currentBadge.textContent === badgeText &&
    currentIsCritical === isCritical
  ) {
    return;
  }

  removeListingBadges();
  titleElement.classList.add("cc-listing-title-host");

  const badge = document.createElement("span");
  badge.className = "cc-clearance-ribbon";
  badge.textContent = badgeText;
  badge.setAttribute("aria-label", "Bu ilan security clearance istiyor");
  if (isCritical) {
    badge.classList.add("cc-clearance-ribbon--critical");
  }

  titleElement.append(badge);
}

function getJobDescription() {
  const preferred = textFromFirst(DESCRIPTION_SELECTORS);
  if (preferred.length >= 120) {
    return preferred;
  }

  const mainText = document.querySelector("main")?.innerText?.trim() || "";
  return mainText.length >= 120 ? mainText : "";
}

function normalize(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findMatches(text, patterns) {
  const matches = [];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let result;
    while ((result = pattern.exec(text)) !== null) {
      const clean = result[0].replace(/\s+/g, " ").trim();
      if (clean && !matches.some((item) => item.toLowerCase() === clean.toLowerCase())) {
        matches.push(clean);
      }
      if (matches.length >= 6) {
        return matches;
      }
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
  if (notRequiredMatches.length > 0) {
    return {
      status: "not_required",
      matches: notRequiredMatches,
      criticalMatches: []
    };
  }

  const obtainableMatches = findMatches(text, RULES.obtainable);
  const textWithoutObtainablePhrases = removeMatches(text, RULES.obtainable);
  const requiredMatches = findMatches(
    textWithoutObtainablePhrases,
    RULES.required
  );

  if (requiredMatches.length > 0) {
    return {
      status: "required",
      matches: [...requiredMatches, ...obtainableMatches].slice(0, 6),
      criticalMatches
    };
  }

  if (obtainableMatches.length > 0) {
    return {
      status: "obtainable",
      matches: obtainableMatches,
      criticalMatches
    };
  }

  const reviewMatches = findMatches(text, RULES.review);
  if (reviewMatches.length > 0) {
    return {
      status: "review",
      matches: reviewMatches,
      criticalMatches
    };
  }

  return {
    status: "not_mentioned",
    matches: [],
    criticalMatches
  };
}

function buildResult() {
  const description = normalize(getJobDescription());
  const title = normalize(textFromFirst(TITLE_SELECTORS));
  const company = normalize(textFromFirst(COMPANY_SELECTORS));

  if (!description) {
    return {
      status: "error",
      title,
      company,
      matches: [],
      criticalMatches: [],
      message:
        "İlan açıklaması henüz görünmüyor. İlanı aç, açıklama yüklendikten sonra yeniden tara."
    };
  }

  return {
    ...analyzeClearance(description),
    title,
    company,
    url: location.href,
    scannedAt: new Date().toISOString()
  };
}

function runScan({ notify = false } = {}) {
  const result = buildResult();
  updateListingBadge(result);
  const signature = JSON.stringify({
    status: result.status,
    title: result.title,
    company: result.company,
    matches: result.matches,
    criticalMatches: result.criticalMatches,
    url: result.url
  });

  if (notify && signature !== lastSignature) {
    lastSignature = signature;
    try {
      const pendingMessage = chrome.runtime.sendMessage({
        type: "CLEARANCE_RESULT",
        result
      });
      pendingMessage?.catch?.(() => {
        // Side panel kapalıysa veya uzantı yenilendiyse alıcı olmayabilir.
      });
    } catch {
      // Uzantı context'i yenilenirken eski sayfa kodu kısa süre çalışabilir.
    }
  }

  return result;
}

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => runScan({ notify: true }), 700);
}

function normalizeFieldText(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fieldDescriptor(field) {
  const parts = [
    field.name,
    field.id,
    field.getAttribute("aria-label"),
    field.getAttribute("placeholder"),
    field.getAttribute("autocomplete")
  ];

  if (field.id) {
    const explicitLabel = document.querySelector(
      `label[for="${CSS.escape(field.id)}"]`
    );
    parts.push(explicitLabel?.innerText);
  }

  parts.push(field.closest("label")?.innerText);

  const labelledBy = field.getAttribute("aria-labelledby");
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      parts.push(document.getElementById(id)?.innerText);
    }
  }

  const container = field.closest(
    ".fb-dash-form-element, .jobs-easy-apply-form-element, fieldset"
  );
  parts.push(
    container?.querySelector("label, legend, .fb-dash-form-element__label")
      ?.innerText
  );

  return normalizeFieldText(parts.filter(Boolean).join(" "));
}

function fieldDisplayName(field) {
  const candidates = [];

  if (field.id) {
    const explicitLabel = document.querySelector(
      `label[for="${CSS.escape(field.id)}"]`
    );
    candidates.push(explicitLabel?.innerText);
  }

  candidates.push(field.closest("label")?.innerText);

  const labelledBy = field.getAttribute("aria-labelledby");
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      candidates.push(document.getElementById(id)?.innerText);
    }
  }

  const container = field.closest(
    ".fb-dash-form-element, .jobs-easy-apply-form-element, fieldset"
  );
  candidates.push(
    container?.querySelector("label, legend, .fb-dash-form-element__label")
      ?.innerText
  );

  candidates.push(
    field.getAttribute("aria-label"),
    field.getAttribute("placeholder"),
    field.name,
    field.id
  );

  for (const candidate of candidates) {
    const clean = String(candidate || "")
      .replace(/\s+/g, " ")
      .replace(/\s*[*:]\s*$/, "")
      .trim();
    if (clean) {
      return clean.slice(0, 100);
    }
  }

  return "";
}

function isSensitiveOrUnsupportedField(field) {
  const type = (field.type || "").toLowerCase();
  const autocomplete = (field.getAttribute("autocomplete") || "").toLowerCase();
  const descriptor = fieldDescriptor(field);

  return (
    field.disabled ||
    !field.offsetParent ||
    ["password", "file", "hidden", "submit", "button", "reset"].includes(type) ||
    autocomplete.includes("password") ||
    /\b(?:password|passcode|otp|one time code|cvv|cvc|security code|credit card|card number|ssn|social security)\b/.test(
      descriptor
    )
  );
}

function learnedFieldValue(field) {
  if (field instanceof HTMLSelectElement) {
    const selected = field.selectedOptions[0];
    if (!selected || !field.value) {
      return "";
    }
    return selected.textContent?.trim() || selected.value;
  }

  const type = (field.type || "").toLowerCase();
  if (["checkbox", "radio"].includes(type)) {
    return "";
  }

  return String(field.value || "").trim();
}

function learnFormEntries() {
  const fields = Array.from(
    document.querySelectorAll("input, textarea, select")
  );
  const byKey = new Map();

  for (const field of fields) {
    if (isSensitiveOrUnsupportedField(field)) {
      continue;
    }

    const key = fieldDisplayName(field);
    const value = learnedFieldValue(field);
    const normalizedKey = normalizeFieldText(key);

    if (key && value && normalizedKey) {
      byKey.set(normalizedKey, { key, value });
    }
  }

  return {
    entries: Array.from(byKey.values())
  };
}

function entryMatchesField(entryKey, descriptor) {
  const key = normalizeFieldText(entryKey);
  if (!key || !descriptor) {
    return false;
  }

  if (descriptor === key || descriptor.includes(key)) {
    return true;
  }

  const keyTokens = key.split(" ").filter((token) => token.length > 1);
  return (
    keyTokens.length > 0 &&
    keyTokens.every((token) => descriptor.split(" ").includes(token))
  );
}

function setNativeValue(field, value) {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) {
    setter.call(field, value);
  } else {
    field.value = value;
  }
}

function dispatchFieldEvents(field) {
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  field.dispatchEvent(new Event("blur", { bubbles: true }));
}

function fillTextField(field, value) {
  if (
    field.disabled ||
    field.readOnly ||
    !field.offsetParent
  ) {
    return false;
  }

  const type = (field.type || "text").toLowerCase();
  if (
    ["hidden", "password", "file", "submit", "button", "reset", "checkbox", "radio"]
      .includes(type)
  ) {
    return false;
  }

  setNativeValue(field, value);
  dispatchFieldEvents(field);
  return true;
}

function fillSelectField(select, value) {
  if (
    select.disabled ||
    !select.offsetParent
  ) {
    return false;
  }

  const wanted = normalizeFieldText(value);
  const options = Array.from(select.options);
  const option =
    options.find(
      (item) =>
        normalizeFieldText(item.textContent) === wanted ||
        normalizeFieldText(item.value) === wanted
    ) ||
    options.find(
      (item) =>
        normalizeFieldText(item.textContent).includes(wanted) ||
        wanted.includes(normalizeFieldText(item.textContent))
    );

  if (!option || option.disabled) {
    return false;
  }

  select.value = option.value;
  dispatchFieldEvents(select);
  return true;
}

function optionLabelForChoice(field) {
  if (field.id) {
    const label = document.querySelector(
      `label[for="${CSS.escape(field.id)}"]`
    );
    if (label?.innerText) {
      return label.innerText;
    }
  }
  return field.closest("label")?.innerText || field.value || "";
}

function fillChoiceField(field, value) {
  if (field.disabled || !field.offsetParent) {
    return false;
  }

  const wanted = normalizeFieldText(value);
  const type = (field.type || "").toLowerCase();

  if (type === "radio") {
    const optionText = normalizeFieldText(optionLabelForChoice(field));
    const optionValue = normalizeFieldText(field.value);
    if (
      optionText !== wanted &&
      optionValue !== wanted &&
      !optionText.includes(wanted)
    ) {
      return false;
    }
    field.click();
    dispatchFieldEvents(field);
    return field.checked;
  }

  if (type === "checkbox") {
    const shouldCheck = /^(yes|true|checked|check|1|evet)$/.test(wanted);
    const shouldUncheck = /^(no|false|unchecked|uncheck|0|hayir)$/.test(wanted);
    if (!shouldCheck && !shouldUncheck) {
      return false;
    }
    const desired = shouldCheck;
    if (field.checked !== desired) {
      field.click();
    }
    dispatchFieldEvents(field);
    return field.checked === desired;
  }

  return false;
}

function autofillForm(entries) {
  const fields = Array.from(
    document.querySelectorAll("input, textarea, select")
  );
  const matchedKeys = new Set();
  let filledCount = 0;

  for (const field of fields) {
    const descriptor = fieldDescriptor(field);
    const entry = entries.find(
      (candidate) =>
        candidate?.key &&
        candidate?.value &&
        entryMatchesField(candidate.key, descriptor)
    );

    if (!entry) {
      continue;
    }

    const type = (field.type || "").toLowerCase();
    const filled = field instanceof HTMLSelectElement
      ? fillSelectField(field, entry.value)
      : ["radio", "checkbox"].includes(type)
        ? fillChoiceField(field, entry.value)
        : fillTextField(field, entry.value);

    if (filled) {
      filledCount += 1;
      matchedKeys.add(entry.key);
    }
  }

  return {
    filledCount,
    matchedKeys: Array.from(matchedKeys)
  };
}

globalThis.__clearanceCheckerTest = {
  analyzeClearance,
  autofillForm,
  learnFormEntries
};

function handleRuntimeMessage(message, sender, sendResponse) {
  if (message?.type === "REQUEST_CLEARANCE_SCAN") {
    sendResponse(runScan());
  }

  if (message?.type === "AUTOFILL_FORM") {
    sendResponse(autofillForm(message.entries || []));
  }

  if (message?.type === "LEARN_FORM") {
    sendResponse(learnFormEntries());
  }
}

const observer = new MutationObserver(scheduleScan);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true
});

chrome.runtime.onMessage.addListener(handleRuntimeMessage);
window.addEventListener("popstate", scheduleScan);

globalThis.__linkedinClearanceCheckerCleanup = () => {
  clearTimeout(scanTimer);
  observer.disconnect();
  window.removeEventListener("popstate", scheduleScan);
  try {
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  } catch {
    // Uzantı yenilenmişse eski runtime listener zaten kullanılamaz.
  }
};

scheduleScan();
})();
