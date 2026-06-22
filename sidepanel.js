const statusCard = document.querySelector("#statusCard");
const statusLabel = document.querySelector("#statusLabel");
const statusMessage = document.querySelector("#statusMessage");
const criticalAlert = document.querySelector("#criticalAlert");
const criticalMatches = document.querySelector("#criticalMatches");
const jobCard = document.querySelector("#jobCard");
const jobTitle = document.querySelector("#jobTitle");
const companyName = document.querySelector("#companyName");
const matchesCard = document.querySelector("#matchesCard");
const matchesList = document.querySelector("#matchesList");
const refreshButton = document.querySelector("#refreshButton");
const autofillRows = document.querySelector("#autofillRows");
const addAutofillRow = document.querySelector("#addAutofillRow");
const fillFormButton = document.querySelector("#fillFormButton");
const learnFormButton = document.querySelector("#learnFormButton");
const autofillResult = document.querySelector("#autofillResult");

const AUTOFILL_STORAGE_KEY = "autofillEntries";
const DEFAULT_AUTOFILL_ENTRIES = [
  { key: "First Name", value: "" },
  { key: "Last Name", value: "" },
  { key: "Email", value: "" },
  { key: "Phone", value: "" }
];

let autofillEntries = [];
let saveAutofillTimer;

const STATUS_COPY = {
  required: {
    label: "Clearance gerekiyor",
    message:
      "İlanda mevcut veya belirli seviyede security clearance şartı bulundu."
  },
  obtainable: {
    label: "Clearance alınabilmeli",
    message:
      "Başlangıçta aktif clearance şart olmayabilir; fakat adayın clearance alabilmesi veya uygun olması bekleniyor."
  },
  not_required: {
    label: "Clearance gerekmiyor",
    message: "İlanda clearance gerekmediğini açıkça söyleyen bir ifade bulundu."
  },
  review: {
    label: "Elle kontrol et",
    message:
      "Clearance veya benzer bir güvenlik incelemesi geçiyor, fakat şart olup olmadığı net değil."
  },
  not_mentioned: {
    label: "Clearance belirtilmemiş",
    message:
      "Açık ilan açıklamasında bilinen bir security clearance ifadesi bulunmadı."
  },
  no_job: {
    label: "LinkedIn ilanı aç",
    message:
      "Bir LinkedIn iş ilanı açtığında burada clearance sonucu görünecek."
  },
  loading: {
    label: "İlan okunuyor…",
    message: "Açık LinkedIn ilanındaki açıklamayı tarıyorum."
  },
  error: {
    label: "İlan okunamadı",
    message:
      "LinkedIn sayfasını yenile veya bir ilan açıp “Yeniden tara” düğmesine bas."
  }
};

function setStatus(status, customMessage) {
  const copy = STATUS_COPY[status] || STATUS_COPY.error;
  statusCard.className = `card state-${status.replace("_", "-")}`;
  statusLabel.textContent = copy.label;
  statusMessage.textContent = customMessage || copy.message;
}

function renderResult(result) {
  setStatus(result.status, result.message);

  criticalMatches.replaceChildren();
  if (Array.isArray(result.criticalMatches) && result.criticalMatches.length > 0) {
    for (const match of result.criticalMatches) {
      const item = document.createElement("li");
      item.textContent = match;
      criticalMatches.append(item);
    }
    criticalAlert.classList.remove("hidden");
  } else {
    criticalAlert.classList.add("hidden");
  }

  if (result.title || result.company) {
    jobTitle.textContent = result.title || "LinkedIn iş ilanı";
    companyName.textContent = result.company || "";
    jobCard.classList.remove("hidden");
  } else {
    jobCard.classList.add("hidden");
  }

  matchesList.replaceChildren();
  if (Array.isArray(result.matches) && result.matches.length > 0) {
    for (const match of result.matches) {
      const item = document.createElement("li");
      item.textContent = match;
      matchesList.append(item);
    }
    matchesCard.classList.remove("hidden");
  } else {
    matchesCard.classList.add("hidden");
  }
}

function setAutofillResult(message = "", type = "") {
  autofillResult.textContent = message;
  autofillResult.className = "autofill-result";
  if (type) {
    autofillResult.classList.add(`is-${type}`);
  }
}

function cleanAutofillEntries(entries) {
  return entries
    .map((entry) => ({
      key: String(entry?.key || "").trim(),
      value: String(entry?.value || "").trim()
    }))
    .filter((entry) => entry.key || entry.value);
}

async function persistAutofillEntries() {
  await chrome.storage.local.set({
    [AUTOFILL_STORAGE_KEY]: autofillEntries
  });
}

function saveAutofillEntries() {
  clearTimeout(saveAutofillTimer);
  saveAutofillTimer = setTimeout(async () => {
    await persistAutofillEntries();
    setAutofillResult("Cevaplar tarayıcıya kaydedildi.", "success");
  }, 350);
}

function createAutofillInput(value, placeholder, onInput) {
  const input = document.createElement("input");
  input.className = "autofill-input";
  input.type = "text";
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.addEventListener("input", onInput);
  return input;
}

function renderAutofillRows() {
  autofillRows.replaceChildren();

  autofillEntries.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "autofill-row";

    const keyInput = createAutofillInput(
      entry.key,
      "First Name",
      (event) => {
        autofillEntries[index].key = event.target.value;
        saveAutofillEntries();
      }
    );

    const valueInput = createAutofillInput(
      entry.value,
      "Cevabın",
      (event) => {
        autofillEntries[index].value = event.target.value;
        saveAutofillEntries();
      }
    );

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-row";
    deleteButton.type = "button";
    deleteButton.title = "Satırı sil";
    deleteButton.setAttribute("aria-label", "Satırı sil");
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => {
      autofillEntries.splice(index, 1);
      renderAutofillRows();
      saveAutofillEntries();
    });

    row.append(keyInput, valueInput, deleteButton);
    autofillRows.append(row);
  });
}

async function loadAutofillEntries() {
  const stored = await chrome.storage.local.get(AUTOFILL_STORAGE_KEY);
  const savedEntries = stored[AUTOFILL_STORAGE_KEY];
  autofillEntries =
    Array.isArray(savedEntries) && savedEntries.length > 0
      ? savedEntries
      : structuredClone(DEFAULT_AUTOFILL_ENTRIES);
  renderAutofillRows();
}

async function fillOpenForm() {
  const entries = cleanAutofillEntries(autofillEntries);
  if (entries.length === 0) {
    setAutofillResult("Önce en az bir alan ve cevap ekle.", "error");
    return;
  }

  fillFormButton.disabled = true;
  setAutofillResult("Form alanları aranıyor…");

  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error("Aktif sekme bulunamadı.");
    }

    const result = await sendMessageWithInjection(tab, {
      type: "AUTOFILL_FORM",
      entries
    });

    if (!result) {
      throw new Error("Bu sayfadaki forma erişilemedi.");
    }

    const detail = result.matchedKeys?.length
      ? ` Eşleşenler: ${result.matchedKeys.join(", ")}`
      : "";

    if (result.filledCount > 0) {
      setAutofillResult(
        `${result.filledCount} alan dolduruldu.${detail}`,
        "success"
      );
    } else {
      setAutofillResult(
        "Cevap bankasıyla eşleşen boş bir alan bulunamadı.",
        "error"
      );
    }
  } catch (error) {
    console.error(error);
    setAutofillResult(
      "Form doldurulamadı. Sayfayı yenileyip tekrar dene.",
      "error"
    );
  } finally {
    fillFormButton.disabled = false;
  }
}

function normalizeEntryKey(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mergeLearnedEntries(learnedEntries) {
  let added = 0;
  let updated = 0;

  for (const learned of learnedEntries) {
    const normalizedKey = normalizeEntryKey(learned.key);
    if (!normalizedKey || !String(learned.value || "").trim()) {
      continue;
    }

    const existing = autofillEntries.find(
      (entry) => normalizeEntryKey(entry.key) === normalizedKey
    );

    if (existing) {
      if (existing.value !== learned.value) {
        existing.value = learned.value;
        updated += 1;
      }
    } else {
      autofillEntries.push({
        key: learned.key,
        value: learned.value
      });
      added += 1;
    }
  }

  return { added, updated };
}

async function learnOpenForm() {
  learnFormButton.disabled = true;
  fillFormButton.disabled = true;
  setAutofillResult("Doldurulmuş alanlar okunuyor…");

  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error("Aktif sekme bulunamadı.");
    }

    const result = await sendMessageWithInjection(tab, {
      type: "LEARN_FORM"
    });

    if (!result || !Array.isArray(result.entries)) {
      throw new Error("Bu sayfadaki forma erişilemedi.");
    }

    if (result.entries.length === 0) {
      setAutofillResult(
        "Kaydedilebilecek dolu bir form alanı bulunamadı.",
        "error"
      );
      return;
    }

    const { added, updated } = mergeLearnedEntries(result.entries);
    renderAutofillRows();
    await persistAutofillEntries();

    const unchanged = result.entries.length - added - updated;
    const parts = [];
    if (added) parts.push(`${added} yeni`);
    if (updated) parts.push(`${updated} güncellendi`);
    if (unchanged) parts.push(`${unchanged} zaten kayıtlı`);

    setAutofillResult(
      `${result.entries.length} cevap öğrenildi: ${parts.join(", ")}.`,
      "success"
    );
  } catch (error) {
    console.error(error);
    setAutofillResult(
      "Form okunamadı. Sayfayı yenileyip tekrar dene.",
      "error"
    );
  } finally {
    learnFormButton.disabled = false;
    fillFormButton.disabled = false;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return tab;
}

async function sendMessageWithInjection(tab, message) {
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (firstError) {
    if (!tab.url?.startsWith("https://www.linkedin.com/")) {
      throw firstError;
    }

    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["linkedin.css"]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

async function requestScan() {
  refreshButton.disabled = true;
  setStatus("loading");

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url?.startsWith("https://www.linkedin.com/jobs/")) {
      renderResult({ status: "no_job", matches: [] });
      return;
    }

    const result = await sendMessageWithInjection(tab, {
      type: "REQUEST_CLEARANCE_SCAN"
    });

    if (result) {
      renderResult(result);
    } else {
      setStatus("error");
    }
  } catch (error) {
    console.error(error);
    setStatus("error");
  } finally {
    refreshButton.disabled = false;
  }
}

chrome.runtime.onMessage?.addListener((message) => {
  if (message?.type === "CLEARANCE_RESULT" && message.result) {
    renderResult(message.result);
  }
});

chrome.tabs.onActivated?.addListener(requestScan);
chrome.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === "complete" || changeInfo.url)) {
    requestScan();
  }
});

refreshButton.addEventListener("click", requestScan);
addAutofillRow.addEventListener("click", () => {
  autofillEntries.push({ key: "", value: "" });
  renderAutofillRows();
  saveAutofillEntries();
  const inputs = autofillRows.querySelectorAll(".autofill-input");
  inputs[inputs.length - 2]?.focus();
});
fillFormButton.addEventListener("click", fillOpenForm);
learnFormButton.addEventListener("click", learnOpenForm);

loadAutofillEntries().catch(console.error);
requestScan();
