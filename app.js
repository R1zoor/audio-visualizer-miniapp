const API_BASE = "https://authentic-size-anywhere-patches.trycloudflare.com";

const tg = window.Telegram?.WebApp || null;
let userId = null;
let telegramInitData = "";

const audioFileInput = document.getElementById("audioFile");
const styleSelect = document.getElementById("style");
const modeSelect = document.getElementById("mode");
const paletteSelect = document.getElementById("palette");
const renderButton = document.getElementById("renderButton");
const resetButton = document.getElementById("resetButton");
const statusBox = document.getElementById("statusBox");
const langToggle = document.getElementById("langToggle");
const historyList = document.getElementById("historyList");
const historyNote = document.getElementById("historyNote");
const historyRefreshButton = document.getElementById("historyRefreshButton");
const customTextField = document.getElementById("customTextField");
const customTextInput = document.getElementById("customTextInput");

let currentLang = "en";

const i18n = {
  en: {
    badge: "● MP3/WAV → MP4 visualizer",
    title: "Create audio visualization in Telegram",
    subtitle: "Upload your track, choose style and mode. In demo you get a short preview with watermark, in full — complete MP4 without restrictions.",
    sectionTitle: "New Render",
    fileLabel: "Audio file",
    fileHint: "MP3 and WAV are supported.",
    styleLabel: "Style",
    modeLabel: "Mode",
    paletteLabel: "Palette",
    styleWaveLine: "Wave Line",
    styleWaveFilled: "Wave Filled",
    styleBars: "Bars",
    styleSpectrogram: "Spectrogram",
    modeDemo: "Demo",
    modeFull: "Full",
    paletteDefault: "Default",
    paletteNeon: "Neon",
    paletteSunset: "Sunset",
    palettePastel: "Pastel",
    summaryDemo: "Demo",
    summaryDemoDesc: "Up to 30 seconds + watermark",
    summaryFull: "Full",
    summaryFullDesc: "Full track without watermark",
    renderButton: "Create Video",
    resetButton: "Reset",
    footerNote: "Rendering may take some time. Your video will be sent directly to Telegram chat.",
    noFile: "Please select an audio file.",
    checkingApi: "Checking API availability...",
    uploading: "Uploading file...",
    queued: "Task queued. Waiting for processing...",
    processing: "Processing audio",
    done: "Done! Video sent to Telegram.",
    doneDownload: "Done! Your video is ready:",
    failed: "Render failed",
    networkError: "Network error. Please check API_BASE, tunnel, and CORS.",
    badResponse: "Server returned an unexpected response.",
    healthFailed: "API health check failed.",
    resetDone: "Form reset.",
    download: "Download video",
    historyTitle: "Render History",
    historyRefresh: "Refresh",
    historyLoading: "Loading history...",
    historyEmpty: "No renders yet.",
    historyUnavailable: "History is available only inside Telegram Mini App.",
    historyFailed: "Failed to load history.",
    historyDownload: "Download",
    statusDone: "Done",
    statusQueued: "Queued",
    statusProcessing: "Processing",
    statusFailed: "Failed",
    styleLabelShort: "Style",
    modeLabelShort: "Mode",
    paletteLabelShort: "Palette",
    telegramMissingSoft: "Telegram user data was not detected. Render will continue, but history may be unavailable.",
    telegramDebug: "Telegram debug",
    customTextLabel: "Title for full video",
    customTextHint: "Shown at the top center only in Full mode. Up to 80 characters."
  },
  ru: {
    badge: "● MP3/WAV → MP4 визуализатор",
    title: "Создай аудио-визуализацию прямо в Telegram",
    subtitle: "Загрузи трек, выбери стиль и режим. В demo ты получишь короткое превью с watermark, а в full — полный MP4 без ограничений.",
    sectionTitle: "Новый рендер",
    fileLabel: "Аудиофайл",
    fileHint: "Поддерживаются MP3 и WAV.",
    styleLabel: "Стиль",
    modeLabel: "Режим",
    paletteLabel: "Палитра",
    styleWaveLine: "Линия волны",
    styleWaveFilled: "Заполненная волна",
    styleBars: "Столбцы",
    styleSpectrogram: "Спектрограмма",
    modeDemo: "Demo",
    modeFull: "Full",
    paletteDefault: "Стандартная",
    paletteNeon: "Неон",
    paletteSunset: "Закат",
    palettePastel: "Пастель",
    summaryDemo: "Демо",
    summaryDemoDesc: "До 30 секунд + watermark",
    summaryFull: "Full",
    summaryFullDesc: "Полный трек без watermark",
    renderButton: "Создать видео",
    resetButton: "Сбросить",
    footerNote: "Рендер может занять время. Видео будет отправлено прямо в Telegram чат.",
    noFile: "Пожалуйста, выбери аудиофайл.",
    checkingApi: "Проверка доступности API...",
    uploading: "Загрузка файла...",
    queued: "Задача в очереди. Ожидание обработки...",
    processing: "Обработка аудио",
    done: "Готово! Видео отправлено в Telegram.",
    doneDownload: "Готово! Твоё видео:",
    failed: "Ошибка рендера",
    networkError: "Сетевая ошибка. Проверь API_BASE, tunnel и CORS.",
    badResponse: "Сервер вернул неожиданный ответ.",
    healthFailed: "Проверка API не пройдена.",
    resetDone: "Форма сброшена.",
    download: "Скачать видео",
    historyTitle: "История рендеров",
    historyRefresh: "Обновить",
    historyLoading: "Загрузка истории...",
    historyEmpty: "Рендеров пока нет.",
    historyUnavailable: "История доступна только внутри Telegram Mini App.",
    historyFailed: "Не удалось загрузить историю.",
    historyDownload: "Скачать",
    statusDone: "Готово",
    statusQueued: "В очереди",
    statusProcessing: "Обработка",
    statusFailed: "Ошибка",
    styleLabelShort: "Стиль",
    modeLabelShort: "Режим",
    paletteLabelShort: "Палитра",
    telegramMissingSoft: "Данные пользователя Telegram не обнаружены. Рендер продолжится, но история может быть недоступна.",
    telegramDebug: "Telegram debug",
    customTextLabel: "Надпись для full‑видео",
    customTextHint: "Показывается сверху по центру только в режиме Full. До 80 символов."
  }
};

function t(key) {
  return i18n[currentLang][key] || key;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(currentLang === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function translateStatus(status) {
  if (status === "done") return t("statusDone");
  if (status === "queued") return t("statusQueued");
  if (status === "processing") return t("statusProcessing");
  if (status === "failed") return t("statusFailed");
  return status;
}

function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (i18n[currentLang][key]) {
      el.textContent = i18n[currentLang][key];
    }
  });

  document.querySelectorAll("[data-i18n-opt]").forEach((el) => {
    const key = el.dataset.i18nOpt;
    if (i18n[currentLang][key]) {
      el.textContent = i18n[currentLang][key];
    }
  });

  langToggle.textContent = currentLang === "en" ? "RU" : "EN";
}

function setStatus(message, type = "info") {
  statusBox.className = "status show";
  if (type === "success") statusBox.classList.add("success");
  if (type === "error") statusBox.classList.add("error");
  statusBox.innerHTML = `<p>${message}</p>`;
}

function setStatusHtml(html, type = "info") {
  statusBox.className = "status show";
  if (type === "success") statusBox.classList.add("success");
  if (type === "error") statusBox.classList.add("error");
  statusBox.innerHTML = html;
}

function hideStatus() {
  statusBox.className = "status";
  statusBox.innerHTML = "";
}

function initTelegramContext() {
  if (!tg) {
    console.log("Telegram WebApp object not found");
    return;
  }

  try {
    tg.ready();
  } catch (e) {
    console.log("tg.ready() failed", e);
  }

  try {
    tg.expand();
  } catch (e) {
    console.log("tg.expand() failed", e);
  }

  userId =
    tg.initDataUnsafe?.user?.id ||
    tg.initDataUnsafe?.receiver?.id ||
    null;

  telegramInitData = tg.initData || "";

  console.log("Telegram debug:", {
    hasTelegramObject: !!tg,
    platform: tg.platform,
    version: tg.version,
    initData: telegramInitData,
    initDataUnsafe: tg.initDataUnsafe,
    userId
  });
}

function renderHistoryItems(items) {
  if (!items.length) {
    historyNote.textContent = t("historyEmpty");
    historyList.innerHTML = "";
    return;
  }

  historyNote.textContent = "";

  historyList.innerHTML = items
    .map((item) => {
      const resultFile = item.result_file || "";
      const downloadUrl = resultFile ? `${API_BASE}/download/${encodeURIComponent(resultFile)}` : "";
      const statusClass = `chip-status-${item.status}`;
      const canDownload = item.status === "done" && resultFile;

      return `
      <article class="history-item">
        <div class="history-item-top">
          <div class="history-file">${escapeHtml(item.original_filename)}</div>
          <div class="history-date">${escapeHtml(formatDate(item.created_at))}</div>
        </div>

        <div class="history-meta">
          <span class="chip ${statusClass}">${escapeHtml(translateStatus(item.status))}</span>
          <span class="chip">${escapeHtml(t("styleLabelShort"))}: ${escapeHtml(item.style)}</span>
          <span class="chip">${escapeHtml(t("modeLabelShort"))}: ${escapeHtml(item.mode)}</span>
          <span class="chip">${escapeHtml(t("paletteLabelShort"))}: ${escapeHtml(item.palette)}</span>
        </div>

        <div class="history-actions">
          ${canDownload ? `<a class="history-link" href="${downloadUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("historyDownload"))}</a>` : ""}
        </div>
      </article>
    `;
    })
    .join("");
}

async function loadHistory() {
  initTelegramContext();

  if (!userId) {
    historyNote.textContent = t("historyUnavailable");
    historyList.innerHTML = "";
    return;
  }

  historyNote.textContent = t("historyLoading");
  historyList.innerHTML = "";

  try {
    const response = await fetch(`${API_BASE}/history/${userId}?limit=20`);
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(t("badResponse"));
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || t("historyFailed"));
    }

    renderHistoryItems(Array.isArray(data.items) ? data.items : []);
  } catch (error) {
    console.error(error);
    historyNote.textContent = error.message || t("historyFailed");
    historyList.innerHTML = "";
  }
}

async function checkHealth() {
  const response = await fetch(`${API_BASE}/`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(t("healthFailed"));
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(t("badResponse"));
  }

  return response.json();
}

function updateCustomTextVisibility() {
  if (!customTextField) return;
  if (modeSelect.value === "full") {
    customTextField.style.display = "block";
  } else {
    customTextField.style.display = "none";
  }
}

async function uploadAndRender() {
  const file = audioFileInput.files[0];
  if (!file) {
    setStatus(t("noFile"), "error");
    return;
  }

  const style = styleSelect.value;
  const mode = modeSelect.value;
  const palette = paletteSelect.value;
  const customText = customTextInput ? customTextInput.value.trim() : "";

  try {
    renderButton.disabled = true;

    initTelegramContext();

    if (!userId && !telegramInitData) {
      setStatus(t("telegramMissingSoft"), "error");
    }

    setStatus(t("checkingApi"), "info");
    await checkHealth();

    setStatus(t("uploading"), "info");

    const formData = new FormData();
    formData.append("file", file);

    const params = new URLSearchParams();
    params.set("style", style);
    params.set("mode", mode);
    params.set("palette", palette);
    if (customText) {
      params.set("custom_text", customText);
    }

    if (userId) {
      params.set("user_id", String(userId));
    }

    if (telegramInitData) {
      params.set("init_data", telegramInitData);
    }

    const uploadUrl = `${API_BASE}/upload?${params.toString()}`;

    console.log("Upload debug:", {
      uploadUrl,
      userId,
      hasInitData: Boolean(telegramInitData),
      initDataLength: telegramInitData.length,
      mode,
      customText
    });

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      body: formData
    });

    const uploadContentType = uploadResponse.headers.get("content-type") || "";
    let uploadData;

    if (uploadContentType.includes("application/json")) {
      uploadData = await uploadResponse.json();
    } else {
      const text = await uploadResponse.text();
      throw new Error(text || t("badResponse"));
    }

    if (!uploadResponse.ok) {
      throw new Error(uploadData.detail || t("badResponse"));
    }

    const taskId = uploadData.task_id;
    setStatus(t("queued"), "info");
    await loadHistory();

    let attempts = 0;
    const maxAttempts = 180;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await fetch(`${API_BASE}/status/${taskId}`);
      const statusContentType = statusResponse.headers.get("content-type") || "";
      let statusData;

      if (statusContentType.includes("application/json")) {
        statusData = await statusResponse.json();
      } else {
        const text = await statusResponse.text();
        throw new Error(text || t("badResponse"));
      }

      if (!statusResponse.ok) {
        throw new Error(statusData.detail || t("badResponse"));
      }

      if (statusData.status === "queued") {
        setStatus(t("queued"), "info");
      } else if (statusData.status === "processing") {
        const percent = statusData.percent || 0;
        setStatus(`${t("processing")}: ${percent}%`, "info");
      } else if (statusData.status === "failed") {
        const errorText = statusData.error || t("failed");
        setStatus(`${t("failed")}: ${errorText}`, "error");
        await loadHistory();
        return;
      } else if (statusData.status === "done") {
        if (userId) {
          setStatus(t("done"), "success");
        } else {
          const downloadUrl = statusData.download_url
            ? `${API_BASE}${statusData.download_url}`
            : null;

          if (!downloadUrl) {
            throw new Error(t("badResponse"));
          }

          setStatusHtml(
            `<p>${t("doneDownload")}</p><p><a href="${downloadUrl}" class="download-link" target="_blank" rel="noopener noreferrer">${t("download")}</a></p>`,
            "success"
          );
        }

        await loadHistory();
        return;
      }

      attempts += 1;
    }

    setStatus(t("failed"), "error");
    await loadHistory();
  } catch (error) {
    console.error(error);
    setStatus(error.message || t("networkError"), "error");
  } finally {
    renderButton.disabled = false;
  }
}

function resetForm() {
  audioFileInput.value = "";
  styleSelect.value = "wave_line";
  modeSelect.value = "demo";
  paletteSelect.value = "default";
  if (customTextInput) customTextInput.value = "";
  updateCustomTextVisibility();
  hideStatus();
  setStatus(t("resetDone"), "info");
  setTimeout(hideStatus, 2000);
}

langToggle.addEventListener("click", () => {
  currentLang = currentLang === "en" ? "ru" : "en";
  applyTranslations();
  updateCustomTextVisibility();
  loadHistory();
});

modeSelect.addEventListener("change", updateCustomTextVisibility);

renderButton.addEventListener("click", uploadAndRender);
resetButton.addEventListener("click", resetForm);
historyRefreshButton.addEventListener("click", loadHistory);

initTelegramContext();
applyTranslations();
updateCustomTextVisibility();
loadHistory();