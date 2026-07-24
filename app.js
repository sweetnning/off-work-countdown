(() => {
  "use strict";

  const STORAGE_KEY = "offWorkCountdown.v1";
  const THEME_KEY = "offWorkCountdown.theme";
  const END_HOUR = 18;
  const END_MINUTE = 0;
  const REST_IMAGES = [
    "assets/rest-pink.png",
    "assets/rest-yellow.png",
    "assets/rest-blue.png",
    "assets/rest-purple.png",
    "assets/rest-pudding.png",
    "assets/rest-sushi.png"
  ];

  const elements = {
    body: document.body,
    themeButton: document.querySelector("#themeButton"),
    themeIcon: document.querySelector(".theme-icon"),
    themeLabel: document.querySelector(".theme-button .button-label"),
    calendarButton: document.querySelector("#calendarButton"),
    monthCountBadge: document.querySelector("#monthCountBadge"),
    dateLabel: document.querySelector("#dateLabel"),
    dayToggle: document.querySelector("#dayToggle"),
    overline: document.querySelector("#overline"),
    heroTitle: document.querySelector("#heroTitle"),
    countdown: document.querySelector("#countdown"),
    hours: document.querySelector("#hours"),
    minutes: document.querySelector("#minutes"),
    seconds: document.querySelector("#seconds"),
    currentTime: document.querySelector("#currentTime"),
    clockInButton: document.querySelector("#clockInButton"),
    clockOutButton: document.querySelector("#clockOutButton"),
    clockInLabel: document.querySelector("#clockInLabel"),
    clockInHint: document.querySelector("#clockInHint"),
    clockOutHint: document.querySelector("#clockOutHint"),
    clockInValue: document.querySelector("#clockInValue"),
    clockOutValue: document.querySelector("#clockOutValue"),
    durationValue: document.querySelector("#durationValue"),
    speechBubble: document.querySelector("#speechBubble"),
    companionImage: document.querySelector("#companionImage"),
    stickerStage: document.querySelector("#stickerStage"),
    calendarDialog: document.querySelector("#calendarDialog"),
    closeCalendar: document.querySelector("#closeCalendar"),
    prevMonth: document.querySelector("#prevMonth"),
    nextMonth: document.querySelector("#nextMonth"),
    calendarMonth: document.querySelector("#calendarMonth"),
    calendarGrid: document.querySelector("#calendarGrid"),
    monthWorkCount: document.querySelector("#monthWorkCount"),
    selectedDateLabel: document.querySelector("#selectedDateLabel"),
    selectedDateStatus: document.querySelector("#selectedDateStatus"),
    selectedDateTimes: document.querySelector("#selectedDateTimes"),
    exportButton: document.querySelector("#exportButton"),
    importInput: document.querySelector("#importInput"),
    clearButton: document.querySelector("#clearButton"),
    clockInDialog: document.querySelector("#clockInDialog"),
    clockInTimeInput: document.querySelector("#clockInTimeInput"),
    cancelClockInEdit: document.querySelector("#cancelClockInEdit"),
    saveClockInEdit: document.querySelector("#saveClockInEdit"),
    celebrationLayer: document.querySelector("#celebrationLayer"),
    toast: document.querySelector("#toast")
  };

  let state = loadState();
  let calendarCursor = startOfMonth(new Date());
  let selectedDateKey = getDateKey(new Date());
  let toastTimer = 0;
  let lastRenderedDate = selectedDateKey;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        version: 1,
        records: parsed && typeof parsed.records === "object" ? parsed.records : {}
      };
    } catch (error) {
      console.warn("无法读取本地打卡数据，已使用空记录。", error);
      return { version: 1, records: {} };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function getRecord(dateKey) {
    return state.records[dateKey] || {};
  }

  function ensureRecord(dateKey) {
    state.records[dateKey] ||= {};
    return state.records[dateKey];
  }

  function defaultRestFor(date) {
    return date.getDay() === 1;
  }

  function isRestDay(date, dateKey = getDateKey(date)) {
    const record = getRecord(dateKey);
    return typeof record.restOverride === "boolean" ? record.restOverride : defaultRestFor(date);
  }

  function formatDateLong(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "long"
    }).format(date);
  }

  function formatClock(value) {
    if (!value) return "未打卡";
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date(value));
  }

  function formatDuration(totalMinutes) {
    if (!Number.isFinite(totalMinutes)) return "等待记录";
    const safeMinutes = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;
    return `${hours} 小时 ${minutes} 分钟`;
  }

  function calculateWorkedMinutes(record) {
    if (!record.clockIn || !record.clockOut) return null;
    return Math.max(0, (new Date(record.clockOut) - new Date(record.clockIn)) / 60000);
  }

  function getTodayContext(now = new Date()) {
    const dateKey = getDateKey(now);
    const record = getRecord(dateKey);
    return { now, dateKey, record, rest: isRestDay(now, dateKey) };
  }

  function updateTheme(theme, persist = true) {
    const nextTheme = theme === "cozy" ? "cozy" : "minimal";
    elements.body.dataset.theme = nextTheme;
    const cozy = nextTheme === "cozy";
    elements.themeIcon.textContent = cozy ? "C" : "A";
    elements.themeLabel.textContent = cozy ? "治愈" : "清爽";
    elements.themeButton.setAttribute("aria-label", cozy ? "切换到清爽极简主题" : "切换到轻松治愈主题");
    document.querySelector('meta[name="theme-color"]').setAttribute("content", cozy ? "#fff8ee" : "#f7f8f7");
    if (persist) localStorage.setItem(THEME_KEY, nextTheme);
  }

  function setCompanion(src, alt, speech) {
    if (elements.companionImage.getAttribute("src") === src) {
      elements.speechBubble.textContent = speech;
      return;
    }
    elements.stickerStage.classList.add("is-changing");
    window.setTimeout(() => {
      elements.companionImage.src = src;
      elements.companionImage.alt = alt;
      elements.speechBubble.textContent = speech;
      elements.stickerStage.classList.remove("is-changing");
    }, 170);
  }

  function renderToday(now = new Date()) {
    const { dateKey, record, rest } = getTodayContext(now);
    if (dateKey !== lastRenderedDate) {
      lastRenderedDate = dateKey;
      selectedDateKey = dateKey;
      calendarCursor = startOfMonth(now);
    }

    elements.dateLabel.textContent = formatDateLong(now);
    elements.currentTime.textContent = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now);

    const target = new Date(now);
    target.setHours(END_HOUR, END_MINUTE, 0, 0);
    const remaining = Math.max(0, target - now);
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    elements.hours.textContent = String(hours).padStart(2, "0");
    elements.minutes.textContent = String(minutes).padStart(2, "0");
    elements.seconds.textContent = String(seconds).padStart(2, "0");

    elements.body.classList.toggle("is-resting", rest);
    elements.body.classList.toggle("is-complete", Boolean(record.clockOut));
    elements.dayToggle.textContent = rest ? "切换为工作日" : "今天休息";
    elements.dayToggle.setAttribute("aria-pressed", String(rest));

    if (rest) {
      elements.overline.textContent = "今天不用倒数";
      elements.heroTitle.textContent = "好好休息一下";
      const imageIndex = hashDate(dateKey) % REST_IMAGES.length;
      setCompanion(REST_IMAGES[imageIndex], "写着休字的可爱角色", "休息也是正经事");
    } else if (record.clockOut) {
      elements.overline.textContent = "今日任务完成";
      elements.heroTitle.textContent = "下班啦，辛苦了";
      setCompanion("assets/celebrate.png", "拿着礼炮庆祝下班的可爱角色", "今天也顺利收工！");
    } else if (remaining === 0) {
      elements.overline.textContent = "下班时间到了";
      elements.heroTitle.textContent = "可以准备收工了";
      setCompanion("assets/celebrate.png", "拿着礼炮庆祝的可爱角色", "18:00 到啦！");
    } else if (record.clockIn) {
      elements.overline.textContent = "距离下班还有";
      elements.heroTitle.textContent = "稳稳度过今天";
      setCompanion("assets/record-pencil.png", "抱着铅笔记录的小动物", "You can do it！");
    } else {
      elements.overline.textContent = "距离下班还有";
      elements.heroTitle.textContent = "准备好就出发";
      setCompanion("assets/record-pencil.png", "抱着铅笔记录的小动物", "先打个上班卡吧");
    }

    elements.clockInValue.textContent = formatClock(record.clockIn);
    elements.clockOutValue.textContent = formatClock(record.clockOut);
    const workedMinutes = record.workedMinutes ?? calculateWorkedMinutes(record);
    elements.durationValue.textContent = formatDuration(workedMinutes);

    elements.clockInButton.disabled = rest;
    elements.clockOutButton.disabled = rest || !record.clockIn || Boolean(record.clockOut);
    elements.clockInLabel.textContent = record.clockIn ? "修改上班时间" : "上班打卡";
    elements.clockInHint.textContent = record.clockIn ? formatClock(record.clockIn) : rest ? "休息日无需打卡" : "记录这一刻";
    elements.clockOutHint.textContent = record.clockOut ? formatClock(record.clockOut) : !record.clockIn ? "上班后解锁" : "结束今天工作";

    updateMonthCounts(now);
  }

  function hashDate(dateKey) {
    return [...dateKey].reduce((total, char) => total + char.charCodeAt(0), 0);
  }

  function toggleRestDay() {
    const now = new Date();
    const dateKey = getDateKey(now);
    const record = ensureRecord(dateKey);
    record.restOverride = !isRestDay(now, dateKey);
    saveState();
    showToast(record.restOverride ? "今天切换为休息日" : "今天切换为工作日");
    renderToday(now);
    renderCalendar();
  }

  function clockIn() {
    const now = new Date();
    const { dateKey, record, rest } = getTodayContext(now);
    if (rest || record.clockIn) return;
    const target = ensureRecord(dateKey);
    target.clockIn = now.toISOString();
    delete target.clockOut;
    delete target.workedMinutes;
    saveState();
    showToast(`上班打卡成功 · ${formatClock(target.clockIn)}`);
    renderToday(now);
    renderCalendar();
  }

  function openClockInEditor() {
    const { record, rest } = getTodayContext();
    if (rest || !record.clockIn) return;
    const clockInDate = new Date(record.clockIn);
    elements.clockInTimeInput.value = `${String(clockInDate.getHours()).padStart(2, "0")}:${String(clockInDate.getMinutes()).padStart(2, "0")}`;
    if (typeof elements.clockInDialog.showModal === "function") {
      elements.clockInDialog.showModal();
    } else {
      elements.clockInDialog.setAttribute("open", "");
    }
  }

  function closeClockInEditor() {
    if (typeof elements.clockInDialog.close === "function") elements.clockInDialog.close();
    else elements.clockInDialog.removeAttribute("open");
  }

  function saveClockInTime() {
    const value = elements.clockInTimeInput.value;
    if (!/^\d{2}:\d{2}$/.test(value)) {
      showToast("请先选择上班时间");
      return;
    }

    const now = new Date();
    const dateKey = getDateKey(now);
    const record = ensureRecord(dateKey);
    const [hours, minutes] = value.split(":").map(Number);
    const revisedClockIn = new Date(now);
    revisedClockIn.setHours(hours, minutes, 0, 0);

    if (revisedClockIn > now) {
      showToast("上班时间不能晚于现在");
      return;
    }
    if (record.clockOut && revisedClockIn >= new Date(record.clockOut)) {
      showToast("上班时间需要早于下班时间");
      return;
    }

    record.clockIn = revisedClockIn.toISOString();
    if (record.clockOut) record.workedMinutes = calculateWorkedMinutes(record);
    saveState();
    closeClockInEditor();
    renderToday(now);
    renderCalendar();
    showToast(`上班时间已修改为 ${formatClock(record.clockIn).slice(0, 5)}`);
  }

  function handleClockInAction() {
    const { record } = getTodayContext();
    if (record.clockIn) openClockInEditor();
    else clockIn();
  }

  function clockOut() {
    const now = new Date();
    const { dateKey, record, rest } = getTodayContext(now);
    if (rest || !record.clockIn || record.clockOut) return;
    const target = ensureRecord(dateKey);
    target.clockOut = now.toISOString();
    target.workedMinutes = calculateWorkedMinutes(target);
    saveState();
    renderToday(now);
    renderCalendar();
    launchCelebration();
    showToast(`下班打卡成功 · 今日 ${formatDuration(target.workedMinutes)}`);
  }

  function launchCelebration() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#ef7e9f", "#a9ddd0", "#f7d979", "#78bfe9", "#b9a3db"];
    elements.celebrationLayer.replaceChildren();
    for (let index = 0; index < 52; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty("--fall-time", `${2.5 + Math.random() * 2}s`);
      piece.style.setProperty("--drift", `${-120 + Math.random() * 240}px`);
      piece.style.setProperty("--spin", `${360 + Math.random() * 900}deg`);
      piece.style.animationDelay = `${Math.random() * 0.45}s`;
      elements.celebrationLayer.append(piece);
    }
    window.setTimeout(() => elements.celebrationLayer.replaceChildren(), 5000);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3000);
  }

  function getMonthWorkCount(date) {
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return Object.entries(state.records).filter(([key, record]) => key.startsWith(prefix) && record.clockIn).length;
  }

  function updateMonthCounts(now = new Date()) {
    elements.monthCountBadge.textContent = String(getMonthWorkCount(now));
  }

  function renderCalendar() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = getDateKey(new Date());
    const fragment = document.createDocumentFragment();

    elements.calendarMonth.textContent = `${year} 年 ${month + 1} 月`;
    const monthCount = getMonthWorkCount(calendarCursor);
    elements.monthWorkCount.textContent = String(monthCount);

    for (let blank = 0; blank < firstWeekday; blank += 1) {
      const empty = document.createElement("span");
      empty.className = "calendar-day empty";
      empty.setAttribute("aria-hidden", "true");
      fragment.append(empty);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const dateKey = getDateKey(date);
      const record = getRecord(dateKey);
      const rest = isRestDay(date, dateKey);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.textContent = String(day);
      button.dataset.date = dateKey;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `${month + 1}月${day}日${record.clockIn ? "，已上班打卡" : rest ? "，休息日" : "，无记录"}`);
      button.classList.toggle("is-today", dateKey === todayKey);
      button.classList.toggle("is-worked", Boolean(record.clockIn));
      button.classList.toggle("is-complete", Boolean(record.clockOut));
      button.classList.toggle("is-rest", rest && !record.clockIn);
      button.classList.toggle("is-selected", dateKey === selectedDateKey);
      button.addEventListener("click", () => {
        selectedDateKey = dateKey;
        renderCalendar();
        renderSelectedDate(date, record, rest);
      });
      fragment.append(button);
    }

    elements.calendarGrid.replaceChildren(fragment);
    const selectedParts = selectedDateKey.split("-").map(Number);
    const selectedDate = new Date(selectedParts[0], selectedParts[1] - 1, selectedParts[2]);
    renderSelectedDate(selectedDate, getRecord(selectedDateKey), isRestDay(selectedDate, selectedDateKey));
  }

  function renderSelectedDate(date, record, rest) {
    elements.selectedDateLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short"
    }).format(date);

    if (record.clockIn && record.clockOut) {
      elements.selectedDateStatus.textContent = `工作 ${formatDuration(record.workedMinutes ?? calculateWorkedMinutes(record))}`;
      elements.selectedDateTimes.textContent = `${formatClock(record.clockIn)} 上班 · ${formatClock(record.clockOut)} 下班`;
    } else if (record.clockIn) {
      elements.selectedDateStatus.textContent = "已上班打卡";
      elements.selectedDateTimes.textContent = `${formatClock(record.clockIn)} 开始 · 尚未下班打卡`;
    } else if (rest) {
      elements.selectedDateStatus.textContent = "休息日";
      elements.selectedDateTimes.textContent = "今天没有打卡记录";
    } else {
      elements.selectedDateStatus.textContent = "没有记录";
      elements.selectedDateTimes.textContent = "这一天还没有留下打卡时间";
    }
  }

  function openCalendar() {
    calendarCursor = startOfMonth(new Date());
    selectedDateKey = getDateKey(new Date());
    renderCalendar();
    if (typeof elements.calendarDialog.showModal === "function") {
      elements.calendarDialog.showModal();
    } else {
      elements.calendarDialog.setAttribute("open", "");
    }
  }

  function closeCalendar() {
    if (typeof elements.calendarDialog.close === "function") elements.calendarDialog.close();
    else elements.calendarDialog.removeAttribute("open");
  }

  function exportData() {
    const payload = {
      app: "off-work-countdown",
      exportedAt: new Date().toISOString(),
      version: 1,
      records: state.records
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `下班倒计时-备份-${getDateKey(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("备份已导出");
  }

  async function importData(event) {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed.records !== "object" || Array.isArray(parsed.records)) {
        throw new Error("备份格式不正确");
      }
      state = { version: 1, records: parsed.records };
      saveState();
      renderToday();
      renderCalendar();
      showToast("备份已恢复");
    } catch (error) {
      console.warn(error);
      showToast("无法导入：请选择正确的备份文件");
    } finally {
      event.target.value = "";
    }
  }

  function clearData() {
    const confirmed = window.confirm("确定清空这台浏览器里的全部打卡记录吗？此操作无法撤销。建议先导出备份。");
    if (!confirmed) return;
    state = { version: 1, records: {} };
    saveState();
    selectedDateKey = getDateKey(new Date());
    renderToday();
    renderCalendar();
    showToast("本机打卡数据已清空");
  }

  elements.themeButton.addEventListener("click", () => {
    updateTheme(elements.body.dataset.theme === "cozy" ? "minimal" : "cozy");
  });
  elements.calendarButton.addEventListener("click", openCalendar);
  elements.closeCalendar.addEventListener("click", closeCalendar);
  elements.calendarDialog.addEventListener("click", (event) => {
    if (event.target === elements.calendarDialog) closeCalendar();
  });
  elements.prevMonth.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
    selectedDateKey = getDateKey(calendarCursor);
    renderCalendar();
  });
  elements.nextMonth.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
    selectedDateKey = getDateKey(calendarCursor);
    renderCalendar();
  });
  elements.dayToggle.addEventListener("click", toggleRestDay);
  elements.clockInButton.addEventListener("click", handleClockInAction);
  elements.clockOutButton.addEventListener("click", clockOut);
  elements.cancelClockInEdit.addEventListener("click", closeClockInEditor);
  elements.saveClockInEdit.addEventListener("click", saveClockInTime);
  elements.clockInDialog.addEventListener("click", (event) => {
    if (event.target === elements.clockInDialog) closeClockInEditor();
  });
  elements.exportButton.addEventListener("click", exportData);
  elements.importInput.addEventListener("change", importData);
  elements.clearButton.addEventListener("click", clearData);

  updateTheme(localStorage.getItem(THEME_KEY) || "minimal", false);
  renderToday();
  renderCalendar();
  window.setInterval(() => renderToday(), 1000);
})();
