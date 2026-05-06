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
const styleSelect = document.getElementById("style");
const modeSelect = document.getElementById("mode");
const paletteSelect = document.getElementById("palette");
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
const previewEmptyState = document.getElementById("previewEmptyState");

const previewCanvases = {
  wave_line: document.getElementById("preview-wave_line"),
  wave_filled: document.getElementById("preview-wave_filled"),
  bars: document.getElementById("preview-bars"),
  spectrogram: document.getElementById("preview-spectrogram")
};

let currentLang = "en";
let isDimPanelOpen = false;

let previewAudioContext = null;
let previewAnalyser = null;
let previewSource = null;
let previewAudioElement = null;
let previewAnimationId = null;
let previewStarted = false;

const i18n = {
  en: {
    badge: "● MP3/WAV → MP4 visualizer",
    title: "Create audio visualization in Telegram",
    subtitle: "Upload your track, choose style and mode. In demo you get a short preview with watermark, in full — complete MP4 without restrictions.",
    previewSectionTitle: "Visualizer Preview",
    previewSectionHint: "Select an audio file and compare styles before rendering the final MP4.",
    previewTapToUse: "Tap to use",
    previewEmptyState: "Preview will become active after you choose an audio file.",
    sectionTitle: "New Render",
    fileLabel: "Audio file",
    fileHint: "MP3 and WAV are supported.",
    backgroundLabel: "Background image / GIF / video",
    backgroundHint: "Optional. If empty, default dark background will be used.",
    toggleDimButton: "Adjust dimming",
    backgroundDimLabel: "Background dim",
    backgroundDimHint: "0% = original background, 100% = fully black.",
    styleLabel: "Style",
    modeLabel: "Mode",
    paletteLabel: "Palette",
    orientationLabel: "Orientation",
    orientationPortrait: "Portrait (phone)",
    orientationLandscape: "Landscape",
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
    previewStartedMessage: "Preview is active. Tap any card to choose the style.",
    previewFailed: "Preview could not be initialized for this file.",
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
    customTextLabel: "Title for full video",
    customTextHint: "Shown at the top center only in Full mode. Up to 80 characters."
  },
  ru: {
    badge: "● MP3/WAV → MP4 визуализатор",
    title: "Создай аудио-визуализацию прямо в Telegram",
    subtitle: "Загрузи трек, выбери стиль и режим. В demo ты получишь короткое превью с watermark, а в full — полный MP4 без ограничений.",
    previewSectionTitle: "Предпросмотр визуализаторов",
    previewSectionHint: "Выбери аудиофайл и сравни стили до финального рендера MP4.",
    previewTapToUse: "Нажми, чтобы выбрать",
    previewEmptyState: "Предпросмотр включится после выбора аудиофайла.",
    sectionTitle: "Новый рендер",
    fileLabel: "Аудиофайл",
    fileHint: "Поддерживаются MP3 и WAV.",
    backgroundLabel: "Фон: картинка / GIF / видео",
    backgroundHint: "Необязательно. Если не выбрать, будет использован стандартный тёмный фон.",
    toggleDimButton: "Настроить затемнение",
    backgroundDimLabel: "Затемнение фона",
    backgroundDimHint: "0% = исходный фон, 100% = полностью чёрный.",
    styleLabel: "Стиль",
    modeLabel: "Режим",
    paletteLabel: "Палитра",
    orientationLabel: "Ориентация",
    orientationPortrait: "Портрет (телефон)",
    orientationLandscape: "Альбомная",
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
    previewStartedMessage: "Предпросмотр активен. Нажми на любую карточку, чтобы выбрать стиль.",
    previewFailed: "Не удалось запустить предпросмотр для этого файла.",
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

  if (customTextInput) {
    customTextInput.placeholder =
      currentLang === "ru"
        ? "Необязательный текст для full режима"
        : "Optional text for full mode";
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

function updateBackgroundDimUi() {
  const hasBackground = Boolean(backgroundFileInput?.files?.[0]);
  const dimValue = `${backgroundDimInput.value}%`;

  if (backgroundDimValue) {
    backgroundDimValue.textContent = dimValue;
  }

  if (backgroundDimPreview) {
    backgroundDimPreview.textContent = dimValue;
  }

  if (backgroundDimSummaryValue) {
    backgroundDimSummaryValue.textContent = dimValue;
  }

  if (backgroundControls) {
    backgroundControls.style.display = hasBackground ? "flex" : "none";
  }

  if (backgroundDimSummary) {
    backgroundDimSummary.style.display = hasBackground ? "flex" : "none";
  }

  if (!hasBackground) {
    isDimPanelOpen = false;
  }

  if (backgroundDimPanel) {
    backgroundDimPanel.classList.toggle("show", hasBackground && isDimPanelOpen);
  }
}

function markActivePreview(style) {
  document.querySelectorAll("[data-style-card]").forEach((card) => {
    card.classList.toggle("active", card.dataset.styleCard === style);
  });
}

function getPaletteColors() {
  const palette = paletteSelect.value;

  if (palette === "neon") {
    return {
      primary: "#00ffe5",
      secondary: "#7c4dff",
      backgroundTop: "#050514",
      backgroundBottom: "#0e1630"
    };
  }

  if (palette === "sunset") {
    return {
      primary: "#ffb347",
      secondary: "#ff6f61",
      backgroundTop: "#1b0b29",
      backgroundBottom: "#33142d"
    };
  }

  if (palette === "pastel") {
    return {
      primary: "#aad4ff",
      secondary: "#f9a8d4",
      backgroundTop: "#101621",
      backgroundBottom: "#192336"
    };
  }

  return {
    primary: "#28c7e0",
    secondary: "#7de3ff",
    backgroundTop: "#0a0e13",
    backgroundBottom: "#141c27"
  };
}

function clearCanvas(ctx, width, height, colors) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colors.backgroundTop);
  gradient.addColorStop(1, colors.backgroundBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawWaveLine(ctx, width, height, waveform, colors) {
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();

  const centerY = height / 2;
  const slice = width / waveform.length;

  for (let i = 0; i < waveform.length; i += 2) {
    const x = i * slice;
    const y = centerY + ((waveform[i] - 128) / 128) * (height * 0.32);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
}

function drawWaveFilled(ctx, width, height, waveform, colors) {
  const centerY = height / 2;
  const slice = width / waveform.length;

  ctx.beginPath();
  ctx.moveTo(0, centerY);

  for (let i = 0; i < waveform.length; i += 2) {
    const x = i * slice;
    const y = centerY + ((waveform[i] - 128) / 128) * (height * 0.34);
    ctx.lineTo(x, y);
  }

  ctx.lineTo(width, centerY);
  ctx.closePath();

  const fill = ctx.createLinearGradient(0, 0, 0, height);
  fill.addColorStop(0, colors.primary);
  fill.addColorStop(1, "rgba(255,255,255,0.04)");
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawBars(ctx, width, height, frequency, colors) {
  const barCount = 42;
  const step = Math.floor(frequency.length / barCount);
  const barWidth = width / barCount - 2;

  for (let i = 0; i < barCount; i++) {
    const value = frequency[i * step] / 255;
    const barHeight = Math.max(6, value * (height - 18));
    const x = i * (barWidth + 2);
    const y = height - barHeight - 6;

    const gradient = ctx.createLinearGradient(0, y, 0, height);
    gradient.addColorStop(0, colors.primary);
    gradient.addColorStop(1, colors.secondary);

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

function drawSpectrogram(ctx, width, height, frequency) {
  const imageData = ctx.getImageData(1, 0, width - 1, height);
  ctx.putImageData(imageData, 0, 0);

  for (let y = 0; y < height; y++) {
    const freqIndex = Math.floor((1 - y / height) * (frequency.length - 1));
    const value = frequency[freqIndex] / 255;

    const r = Math.floor(255 * Math.min(1, value * 1.8));
    const g = Math.floor(255 * Math.pow(value, 1.2));
    const b = Math.floor(255 * (1 - value * 0.4));

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(width - 1, y, 1, 1);
  }
}

function drawIdlePreview(canvas, style) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const colors = getPaletteColors();

  clearCanvas(ctx, width, height, colors);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText(style, 12, 20);
}

function drawAllIdlePreviews() {
  Object.entries(previewCanvases).forEach(([style, canvas]) => {
    drawIdlePreview(canvas, style);
  });
}

function stopPreview() {
  if (previewAnimationId) {
    cancelAnimationFrame(previewAnimationId);
    previewAnimationId = null;
  }

  if (previewAudioElement) {
    previewAudioElement.pause();
    previewAudioElement.src = "";
    previewAudioElement = null;
  }

  if (previewSource) {
    try {
      previewSource.disconnect();
    } catch (_) {}
    previewSource = null;
  }

  if (previewAnalyser) {
    try {
      previewAnalyser.disconnect();
    } catch (_) {}
    previewAnalyser = null;
  }

  previewStarted = false;
  drawAllIdlePreviews();
}

function renderPreviewFrame() {
  if (!previewAnalyser) return;

  const waveform = new Uint8Array(previewAnalyser.fftSize);
  const frequency = new Uint8Array(previewAnalyser.frequencyBinCount);

  previewAnalyser.getByteTimeDomainData(waveform);
  previewAnalyser.getByteFrequencyData(frequency);

  const colors = getPaletteColors();

  Object.entries(previewCanvases).forEach(([style, canvas]) => {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    clearCanvas(ctx, width, height, colors);

    if (style === "wave_line") {
      drawWaveLine(ctx, width, height, waveform, colors);
    } else if (style === "wave_filled") {
      drawWaveFilled(ctx, width, height, waveform, colors);
    } else if (style === "bars") {
      drawBars(ctx, width, height, frequency, colors);
    } else if (style === "spectrogram") {
      drawSpectrogram(ctx, width, height, frequency);
    }
  });

  previewAnimationId = requestAnimationFrame(renderPreviewFrame);
}

async function startPreviewFromFile(file) {
  stopPreview();

  if (!file) {
    previewEmptyState.textContent = t("previewEmptyState");
    return;
  }

  try {
    const objectUrl = URL.createObjectURL(file);

    if (!previewAudioContext) {
      previewAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (previewAudioContext.state === "suspended") {
      await previewAudioContext.resume();
    }

    previewAudioElement = new Audio();
    previewAudioElement.src = objectUrl;
    previewAudioElement.loop = true;
    previewAudioElement.muted = true;
    previewAudioElement.playsInline = true;
    previewAudioElement.crossOrigin = "anonymous";

    previewSource = previewAudioContext.createMediaElementSource(previewAudioElement);
    previewAnalyser = previewAudioContext.createAnalyser();
    previewAnalyser.fftSize = 1024;
    previewAnalyser.smoothingTimeConstant = 0.82;

    previewSource.connect(previewAnalyser);
    previewAnalyser.connect(previewAudioContext.destination);

    await previewAudioElement.play();

    previewStarted = true;
    previewEmptyState.textContent = t("previewStartedMessage");
    renderPreviewFrame();
  } catch (error) {
    console.error(error);
    previewEmptyState.textContent = t("previewFailed");
    drawAllIdlePreviews();
  }
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
  const backgroundFile = backgroundFileInput?.files?.[0] || null;

  if (!file) {
    setStatus(t("noFile"), "error");
    return;
  }

  const style = styleSelect.value;
  const mode = modeSelect.value;
  const palette = paletteSelect.value;
  const orientation = orientationSelect ? orientationSelect.value : "portrait";
  const customText = customTextInput ? customTextInput.value.trim() : "";
  const backgroundDim = backgroundDimInput ? Number(backgroundDimInput.value || 35) : 35;

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
    formData.append("style", style);
    formData.append("mode", mode);
    formData.append("palette", palette);
    formData.append("orientation", orientation);
    formData.append("background_dim", String(backgroundDim));

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
  if (backgroundFileInput) backgroundFileInput.value = "";
  if (backgroundDimInput) backgroundDimInput.value = "35";
  isDimPanelOpen = false;
  styleSelect.value = "wave_line";
  paletteSelect.value = "default";
  modeSelect.value = "demo";
  if (orientationSelect) orientationSelect.value = "portrait";
  if (customTextInput) customTextInput.value = "";
  stopPreview();
  previewEmptyState.textContent = t("previewEmptyState");
  markActivePreview("wave_line");
  updateCustomTextVisibility();
  updateBackgroundDimUi();
  hideStatus();
  setStatus(t("resetDone"), "info");
  setTimeout(hideStatus, 2000);
}

langToggle.addEventListener("click", () => {
  currentLang = currentLang === "en" ? "ru" : "en";
  applyTranslations();
  updateCustomTextVisibility();
  updateBackgroundDimUi();
  loadHistory();
});

modeSelect.addEventListener("change", updateCustomTextVisibility);

paletteSelect.addEventListener("change", () => {
  if (!previewStarted) {
    drawAllIdlePreviews();
  }
});

styleSelect.addEventListener("change", () => {
  markActivePreview(styleSelect.value);
});

if (audioFileInput) {
  audioFileInput.addEventListener("change", async () => {
    const file = audioFileInput.files?.[0] || null;
    await startPreviewFromFile(file);
  });
}

document.querySelectorAll("[data-style-card]").forEach((card) => {
  card.addEventListener("click", () => {
    const style = card.dataset.styleCard;
    styleSelect.value = style;
    markActivePreview(style);
  });
});

if (backgroundFileInput) {
  backgroundFileInput.addEventListener("change", () => {
    if (!backgroundFileInput.files?.[0]) {
      isDimPanelOpen = false;
      if (backgroundDimInput) backgroundDimInput.value = "35";
    }
    updateBackgroundDimUi();
  });
}

if (toggleDimButton) {
  toggleDimButton.addEventListener("click", () => {
    isDimPanelOpen = !isDimPanelOpen;
    updateBackgroundDimUi();
  });
}

if (backgroundDimInput) {
  backgroundDimInput.addEventListener("input", updateBackgroundDimUi);
}

renderButton.addEventListener("click", uploadAndRender);
resetButton.addEventListener("click", resetForm);
historyRefreshButton.addEventListener("click", loadHistory);

if (orientationSelect) {
  orientationSelect.value = "portrait";
}

initTelegramContext();
applyTranslations();
updateCustomTextVisibility();
updateBackgroundDimUi();
drawAllIdlePreviews();
markActivePreview("wave_line");
loadHistory();