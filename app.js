const API_BASE = "https://attorney-titanium-ward-summit.trycloudflare.com";

const tg = window.Telegram?.WebApp || null;
let userId = null;
let telegramInitData = "";

const audioFileInput = document.getElementById("audioFile");
const backgroundFileInput = document.getElementById("backgroundFile");
const backgroundControls = document.getElementById("backgroundControls");
const toggleDimButton = document.getElementById("toggleDimButton");
const backgroundDimPanel = document.getElementById("backgroundDimPanel");
const backgroundDimInput = document.getElementById("backgroundDim");
const backgroundDimValue = document.getElementById("backgroundDimValue");
const backgroundDimPreview = document.getElementById("backgroundDimPreview");
const backgroundDimSummary = document.getElementById("backgroundDimSummary");
const backgroundDimSummaryValue = document.getElementById("backgroundDimSummaryValue");

const engineSelect = document.getElementById("engine");
const styleField = document.getElementById("styleField");
const styleSelect = document.getElementById("style");
const milkPanel = document.getElementById("milkPanel");
const milkSearchInput = document.getElementById("milkSearchInput");
const milkShuffleButton = document.getElementById("milkShuffleButton");
const milkPresetGrid = document.getElementById("milkPresetGrid");
const milkPresetInput = document.getElementById("milkPresetInput");

const visualizerColorInput = document.getElementById("visualizerColor");
const visualizerColorText = document.getElementById("visualizerColorText");
const accentColorInput = document.getElementById("accentColor");
const accentColorText = document.getElementById("accentColorText");

const modeSelect = document.getElementById("mode");
const orientationSelect = document.getElementById("orientation");
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
let isDimPanelOpen = false;

const milkPresets = [
  { key: "neon_pulse", name: "Neon Pulse", family: "Pulse", desc: "Bright neon pulse with glowing energy." },
  { key: "orb_weaver", name: "Orb Weaver", family: "Orb", desc: "Circular center motion with layered glow." },
  { key: "dark_tunnel", name: "Dark Tunnel", family: "Tunnel", desc: "Deep tunnel feel with bass-driven motion." },
  { key: "retro_scope", name: "Retro Scope", family: "Scope", desc: "Retro oscilloscope look with soft bloom." },
  { key: "plasma_bloom", name: "Plasma Bloom", family: "Bloom", desc: "Hot plasma waves and smooth expansion." },
  { key: "aurora_ring", name: "Aurora Ring", family: "Orb", desc: "Colored ring with aurora-like gradients." },
  { key: "echo_grid", name: "Echo Grid", family: "Grid", desc: "Grid pulse with rhythmic audio glow." },
  { key: "voltage_flow", name: "Voltage Flow", family: "Pulse", desc: "Electric movement with sharp highlights." },
  { key: "crystal_beat", name: "Crystal Beat", family: "Glass", desc: "Cool crystal look with elegant motion." },
  { key: "solar_drift", name: "Solar Drift", family: "Drift", desc: "Warm drifting pulse with cinematic color." },
  { key: "night_reactor", name: "Night Reactor", family: "Reactor", desc: "Dark reactor core with intense center." },
  { key: "velvet_pulse", name: "Velvet Pulse", family: "Soft", desc: "Soft premium pulse with restrained glow." }
];

let visibleMilkPresets = [];

const i18n = {
  en: {
    badge: "● MP3/WAV → MP4 visualizer",
    title: "Create audio visualization in Telegram",
    subtitle: "Upload your track, choose style and mode. In demo you get a short preview with watermark, in full — complete MP4 without restrictions.",
    sectionTitle: "New Render",
    fileLabel: "Audio file",
    fileHint: "MP3 and WAV are supported.",
    backgroundLabel: "Background image / GIF / video",
    backgroundHint: "Optional. If empty, default dark background will be used.",
    toggleDimButton: "Adjust dimming",
    backgroundDimLabel: "Background dim",
    backgroundDimHint: "0% = original background, 100% = fully black.",
    engineLabel: "Engine",
    engineClassic: "Classic",
    engineMilk: "MILK",
    styleLabel: "Style",
    modeLabel: "Mode",
    orientationLabel: "Orientation",
    orientationPortrait: "Portrait (phone)",
    orientationLandscape: "Landscape",
    styleWaveLine: "Wave Line",
    styleWaveFilled: "Wave Filled",
    styleBars: "Bars",
    styleSpectrogram: "Spectrogram",
    modeDemo: "Demo",
    modeFull: "Full",
    milkHint: "Showing a few random presets. Search by name or shuffle to discover more.",
    shuffleButton: "Shuffle",
    visualizerColorLabel: "Visualizer color",
    visualizerColorHint: "Main color for wave, bars or core visualizer.",
    accentColorLabel: "Accent color",
    accentColorHint: "Secondary glow / accent color, especially useful for MILK.",
    summaryDemo: "Demo",
    summaryDemoDesc: "Up to 30 seconds + watermark",
    summaryFull: "Full",
    summaryFullDesc: "Full track without watermark",
    summaryBackgroundDim: "Background dim",
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
    telegramMissingSoft: "Telegram user data was not detected. Render will continue, but history may be unavailable.",
    customTextLabel: "Title for full video",
    customTextHint: "Shown at the top center only in Full mode. Up to 80 characters.",
    invalidColor: "Invalid HEX color. Use format like #28c7e0."
  },
  ru: {
    badge: "● MP3/WAV → MP4 визуализатор",
    title: "Создай аудио-визуализацию прямо в Telegram",
    subtitle: "Загрузи трек, выбери стиль и режим. В demo ты получишь короткое превью с watermark, а в full — полный MP4 без ограничений.",
    sectionTitle: "Новый рендер",
    fileLabel: "Аудиофайл",
    fileHint: "Поддерживаются MP3 и WAV.",
    backgroundLabel: "Фон: картинка / GIF / видео",
    backgroundHint: "Необязательно. Если не выбрать, будет использован стандартный тёмный фон.",
    toggleDimButton: "Настроить затемнение",
    backgroundDimLabel: "Затемнение фона",
    backgroundDimHint: "0% = исходный фон, 100% = полностью чёрный.",
    engineLabel: "Движок",
    engineClassic: "Classic",
    engineMilk: "MILK",
    styleLabel: "Стиль",
    modeLabel: "Режим",
    orientationLabel: "Ориентация",
    orientationPortrait: "Портрет (телефон)",
    orientationLandscape: "Альбомная",
    styleWaveLine: "Линия волны",
    styleWaveFilled: "Заполненная волна",
    styleBars: "Столбцы",
    styleSpectrogram: "Спектрограмма",
    modeDemo: "Demo",
    modeFull: "Full",
    milkHint: "Показывается несколько случайных пресетов. Ищи по имени или перемешай список.",
    shuffleButton: "Перемешать",
    visualizerColorLabel: "Цвет визуализатора",
    visualizerColorHint: "Основной цвет волны, столбцов или центрального визуализатора.",
    accentColorLabel: "Акцентный цвет",
    accentColorHint: "Вторичный цвет свечения / акцента, особенно полезен для MILK.",
    summaryDemo: "Демо",
    summaryDemoDesc: "До 30 секунд + watermark",
    summaryFull: "Full",
    summaryFullDesc: "Полный трек без watermark",
    summaryBackgroundDim: "Затемнение фона",
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
    telegramMissingSoft: "Данные пользователя Telegram не обнаружены. Рендер продолжится, но история может быть недоступна.",
    customTextLabel: "Надпись для full‑видео",
    customTextHint: "Показывается сверху по центру только в режиме Full. До 80 символов.",
    invalidColor: "Неверный HEX-цвет. Используй формат вроде #28c7e0."
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
  if (Number.isNaN(date.getTime())) return value;
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
    if (i18n[currentLang][key]) el.textContent = i18n[currentLang][key];
  });

  document.querySelectorAll("[data-i18n-opt]").forEach((el) => {
    const key = el.dataset.i18nOpt;
    if (i18n[currentLang][key]) el.textContent = i18n[currentLang][key];
  });

  if (customTextInput) {
    customTextInput.placeholder =
      currentLang === "ru"
        ? "Необязательный текст для full режима"
        : "Optional text for full mode";
  }

  if (milkSearchInput) {
    milkSearchInput.placeholder =
      currentLang === "ru"
        ? "Поиск пресета по имени"
        : "Search preset by name";
  }

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
  if (!tg) return;
  try { tg.ready(); } catch (_) {}
  try { tg.expand(); } catch (_) {}

  userId = tg.initDataUnsafe?.user?.id || tg.initDataUnsafe?.receiver?.id || null;
  telegramInitData = tg.initData || "";
}

function updateBackgroundDimUi() {
  const hasBackground = Boolean(backgroundFileInput?.files?.[0]);
  const dimValue = `${backgroundDimInput.value}%`;

  backgroundDimValue.textContent = dimValue;
  backgroundDimPreview.textContent = dimValue;
  backgroundDimSummaryValue.textContent = dimValue;

  backgroundControls.style.display = hasBackground ? "flex" : "none";
  backgroundDimSummary.style.display = hasBackground ? "flex" : "none";

  if (!hasBackground) isDimPanelOpen = false;
  backgroundDimPanel.classList.toggle("show", hasBackground && isDimPanelOpen);
}

function normalizeHexColor(value, fallback) {
  if (!value) return fallback;
  let color = value.trim();

  if (!color.startsWith("#")) color = `#${color}`;

  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toLowerCase();
  }

  return fallback;
}

function syncColorInputs(colorInput, textInput, fallback) {
  const normalized = normalizeHexColor(textInput.value || colorInput.value, fallback);
  colorInput.value = normalized;
  textInput.value = normalized;
  return normalized;
}

function bindColorPair(colorInput, textInput, fallback) {
  colorInput.addEventListener("input", () => {
    textInput.value = colorInput.value.toLowerCase();
  });

  textInput.addEventListener("blur", () => {
    const normalized = normalizeHexColor(textInput.value, fallback);
    colorInput.value = normalized;
    textInput.value = normalized;
  });
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderMilkPresets(list) {
  milkPresetGrid.innerHTML = "";

  if (!list.length) {
    milkPresetGrid.innerHTML = `<div class="hint">${currentLang === "ru" ? "Ничего не найдено." : "Nothing found."}</div>`;
    return;
  }

  list.forEach((preset) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `preset-card ${milkPresetInput.value === preset.key ? "active" : ""}`;
    card.innerHTML = `
      <div class="preset-name">${escapeHtml(preset.name)}</div>
      <div class="preset-meta">${escapeHtml(preset.family)}</div>
      <p class="preset-desc">${escapeHtml(preset.desc)}</p>
    `;
    card.addEventListener("click", () => {
      milkPresetInput.value = preset.key;
      renderMilkPresets(list);
    });
    milkPresetGrid.appendChild(card);
  });
}

function refreshMilkRandom() {
  const shuffled = shuffleArray(milkPresets).slice(0, 4);
  visibleMilkPresets = shuffled;
  if (!shuffled.find((x) => x.key === milkPresetInput.value)) {
    milkPresetInput.value = shuffled[0]?.key || "neon_pulse";
  }
  renderMilkPresets(shuffled);
}

function filterMilkPresets() {
  const query = milkSearchInput.value.trim().toLowerCase();

  if (!query) {
    renderMilkPresets(visibleMilkPresets);
    return;
  }

  const filtered = milkPresets.filter((preset) =>
    preset.name.toLowerCase().includes(query) ||
    preset.key.toLowerCase().includes(query) ||
    preset.family.toLowerCase().includes(query)
  );

  if (filtered.length && !filtered.find((x) => x.key === milkPresetInput.value)) {
    milkPresetInput.value = filtered[0].key;
  }

  renderMilkPresets(filtered);
}

function updateEngineUi() {
  const isMilk = engineSelect.value === "milk";
  styleField.style.display = isMilk ? "none" : "block";
  milkPanel.classList.toggle("show", isMilk);

  if (isMilk && !visibleMilkPresets.length) {
    refreshMilkRandom();
  }
}

function renderHistoryItems(items) {
  if (!items.length) {
    historyNote.textContent = t("historyEmpty");
    historyList.innerHTML = "";
    return;
  }

  historyNote.textContent = "";

  historyList.innerHTML = items.map((item) => {
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
        </div>

        <div class="history-actions">
          ${canDownload ? `<a class="history-link" href="${downloadUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("historyDownload"))}</a>` : ""}
        </div>
      </article>
    `;
  }).join("");
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
  const response = await fetch(`${API_BASE}/`, { method: "GET" });
  if (!response.ok) throw new Error(t("healthFailed"));

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error(t("badResponse"));

  return response.json();
}

function updateCustomTextVisibility() {
  customTextField.style.display = modeSelect.value === "full" ? "block" : "none";
}

async function uploadAndRender() {
  const file = audioFileInput.files[0];
  const backgroundFile = backgroundFileInput?.files?.[0] || null;

  if (!file) {
    setStatus(t("noFile"), "error");
    return;
  }

  const visualizerColor = syncColorInputs(visualizerColorInput, visualizerColorText, "#28c7e0");
  const accentColor = syncColorInputs(accentColorInput, accentColorText, "#7c4dff");

  if (!/^#[0-9a-f]{6}$/i.test(visualizerColor) || !/^#[0-9a-f]{6}$/i.test(accentColor)) {
    setStatus(t("invalidColor"), "error");
    return;
  }

  const engine = engineSelect.value;
  const style = engine === "milk" ? milkPresetInput.value : styleSelect.value;
  const mode = modeSelect.value;
  const orientation = orientationSelect.value || "portrait";
  const customText = customTextInput.value.trim();
  const backgroundDim = Number(backgroundDimInput.value || 35);
  const milkPreset = engine === "milk" ? milkPresetInput.value : "";

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
    formData.append("engine", engine);
    formData.append("style", style);
    formData.append("mode", mode);
    formData.append("orientation", orientation);
    formData.append("background_dim", String(backgroundDim));
    formData.append("visualizer_color", visualizerColor);
    formData.append("accent_color", accentColor);

    if (milkPreset) {
      formData.append("milk_preset", milkPreset);
    }

    if (backgroundFile) {
      formData.append("background_file", backgroundFile);
    }

    if (customText) {
      formData.append("custom_text", customText);
    }

    if (userId) {
      formData.append("user_id", String(userId));
    }

    if (telegramInitData) {
      formData.append("init_data", telegramInitData);
    }

    const uploadResponse = await fetch(`${API_BASE}/upload`, {
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
          const downloadUrl = statusData.download_url ? `${API_BASE}${statusData.download_url}` : null;
          if (!downloadUrl) throw new Error(t("badResponse"));

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
  backgroundFileInput.value = "";
  backgroundDimInput.value = "35";
  isDimPanelOpen = false;
  engineSelect.value = "classic";
  styleSelect.value = "wave_line";
  milkPresetInput.value = "neon_pulse";
  modeSelect.value = "demo";
  orientationSelect.value = "portrait";
  customTextInput.value = "";
  milkSearchInput.value = "";
  visualizerColorInput.value = "#28c7e0";
  visualizerColorText.value = "#28c7e0";
  accentColorInput.value = "#7c4dff";
  accentColorText.value = "#7c4dff";
  refreshMilkRandom();
  updateEngineUi();
  updateCustomTextVisibility();
  updateBackgroundDimUi();
  hideStatus();
  setStatus(t("resetDone"), "info");
  setTimeout(hideStatus, 2000);
}

langToggle.addEventListener("click", () => {
  currentLang = currentLang === "en" ? "ru" : "en";
  applyTranslations();
  loadHistory();
});

engineSelect.addEventListener("change", updateEngineUi);
modeSelect.addEventListener("change", updateCustomTextVisibility);

backgroundFileInput.addEventListener("change", () => {
  if (!backgroundFileInput.files?.[0]) {
    isDimPanelOpen = false;
    backgroundDimInput.value = "35";
  }
  updateBackgroundDimUi();
});

toggleDimButton.addEventListener("click", () => {
  isDimPanelOpen = !isDimPanelOpen;
  updateBackgroundDimUi();
});

backgroundDimInput.addEventListener("input", updateBackgroundDimUi);
milkShuffleButton.addEventListener("click", refreshMilkRandom);
milkSearchInput.addEventListener("input", filterMilkPresets);

bindColorPair(visualizerColorInput, visualizerColorText, "#28c7e0");
bindColorPair(accentColorInput, accentColorText, "#7c4dff");

renderButton.addEventListener("click", uploadAndRender);
resetButton.addEventListener("click", resetForm);
historyRefreshButton.addEventListener("click", loadHistory);

orientationSelect.value = "portrait";

initTelegramContext();
applyTranslations();
refreshMilkRandom();
updateEngineUi();
updateCustomTextVisibility();
updateBackgroundDimUi();
loadHistory();