(() => {
  "use strict";

  const STORAGE_KEY = "offWorkCountdown.v1";
  const THEME_KEY = "offWorkCountdown.theme";
  const SETTINGS_KEY = "offWorkCountdown.settings.v1";
  const FALLBACK_END_TIME = "18:00";
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
    dateLabel: document.querySelector("#dateLabel"),
    bubbleButton: document.querySelector("#bubbleButton"),
    bubbleButtonCount: document.querySelector("#bubbleButtonCount"),
    overtimeButton: document.querySelector("#overtimeButton"),
    overline: document.querySelector("#overline"),
    heroTitle: document.querySelector("#heroTitle"),
    countdown: document.querySelector("#countdown"),
    hours: document.querySelector("#hours"),
    minutes: document.querySelector("#minutes"),
    seconds: document.querySelector("#seconds"),
    clockInButton: document.querySelector("#clockInButton"),
    clockOutButton: document.querySelector("#clockOutButton"),
    slackingButton: document.querySelector("#slackingButton"),
    clockInLabel: document.querySelector("#clockInLabel"),
    clockInHint: document.querySelector("#clockInHint"),
    clockOutHint: document.querySelector("#clockOutHint"),
    slackingLabel: document.querySelector("#slackingLabel"),
    slackingHint: document.querySelector("#slackingHint"),
    clockInValue: document.querySelector("#clockInValue"),
    clockOutValue: document.querySelector("#clockOutValue"),
    statusValue: document.querySelector("#statusValue"),
    slackingValue: document.querySelector("#slackingValue"),
    slackingSummaryLabel: document.querySelector("#slackingSummaryLabel"),
    slackingSummaryButton: document.querySelector("#slackingSummaryButton"),
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
    selectedSlackingValue: document.querySelector("#selectedSlackingValue"),
    selectedWorkedValue: document.querySelector("#selectedWorkedValue"),
    selectedBubbleCount: document.querySelector("#selectedBubbleCount"),
    editSelectedRecord: document.querySelector("#editSelectedRecord"),
    toggleSelectedRest: document.querySelector("#toggleSelectedRest"),
    selectedAutoOvertime: document.querySelector("#selectedAutoOvertime"),
    viewSelectedBubbles: document.querySelector("#viewSelectedBubbles"),
    exportButton: document.querySelector("#exportButton"),
    importInput: document.querySelector("#importInput"),
    clearButton: document.querySelector("#clearButton"),
    recordEditDialog: document.querySelector("#recordEditDialog"),
    closeRecordEdit: document.querySelector("#closeRecordEdit"),
    cancelRecordEdit: document.querySelector("#cancelRecordEdit"),
    saveRecordEdit: document.querySelector("#saveRecordEdit"),
    recordEditDate: document.querySelector("#recordEditDate"),
    recordClockIn: document.querySelector("#recordClockIn"),
    recordClockOut: document.querySelector("#recordClockOut"),
    recordPlannedEnd: document.querySelector("#recordPlannedEnd"),
    deleteClockIn: document.querySelector("#deleteClockIn"),
    deleteClockOut: document.querySelector("#deleteClockOut"),
    addSlackingSession: document.querySelector("#addSlackingSession"),
    preciseSlackingDetails: document.querySelector("#preciseSlackingDetails"),
    quickSlackingTotal: document.querySelector("#quickSlackingTotal"),
    quickSlackingButtons: [...document.querySelectorAll("[data-quick-slacking]")],
    showCustomSlacking: document.querySelector("#showCustomSlacking"),
    customSlackingRow: document.querySelector("#customSlackingRow"),
    customSlackingMinutes: document.querySelector("#customSlackingMinutes"),
    addCustomSlacking: document.querySelector("#addCustomSlacking"),
    slackingSessionList: document.querySelector("#slackingSessionList"),
    slackingEmpty: document.querySelector("#slackingEmpty"),
    bubbleDialog: document.querySelector("#bubbleDialog"),
    closeBubble: document.querySelector("#closeBubble"),
    bubbleTitle: document.querySelector("#bubbleTitle"),
    bubbleDateLabel: document.querySelector("#bubbleDateLabel"),
    bubbleInput: document.querySelector("#bubbleInput"),
    addBubble: document.querySelector("#addBubble"),
    bubbleList: document.querySelector("#bubbleList"),
    bubbleEmpty: document.querySelector("#bubbleEmpty"),
    celebrationLayer: document.querySelector("#celebrationLayer"),
    toast: document.querySelector("#toast"),
    toastMessage: document.querySelector("#toastMessage"),
    toastUndo: document.querySelector("#toastUndo")
  };

  let state = loadState();
  let settings = loadSettings();
  let calendarCursor = startOfMonth(new Date());
  let selectedDateKey = getDateKey(new Date());
  let toastTimer = 0;
  let undoTimer = 0;
  let pendingUndo = null;
  let slackingActionLockedUntil = 0;
  let lastRenderedDate = selectedDateKey;
  let editingRecordDateKey = selectedDateKey;
  let bubbleDateKey = selectedDateKey;
  let companionRequestId = 0;
  let companionTargetSrc = elements.companionImage?.getAttribute("src") || "";
  const companionImageCache = new Map();

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

  function cloneRecord(record) {
    return JSON.parse(JSON.stringify(record));
  }

  function createRecordUndo(dateKey) {
    const existed = Object.prototype.hasOwnProperty.call(state.records, dateKey);
    const snapshot = existed ? cloneRecord(state.records[dateKey]) : null;
    return () => {
      if (existed) state.records[dateKey] = snapshot;
      else delete state.records[dateKey];
      saveState();
      renderToday();
      renderCalendar();
      if (elements.recordEditDialog.open && editingRecordDateKey === dateKey) populateRecordEditor(dateKey);
    };
  }

  function lockSlackingAction(duration = 450) {
    const now = Date.now();
    if (now < slackingActionLockedUntil) return false;
    slackingActionLockedUntil = now + duration;
    return true;
  }

  function loadSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return {
        defaultEndTime: isValidTime(parsed.defaultEndTime) ? parsed.defaultEndTime : FALLBACK_END_TIME
      };
    } catch (error) {
      console.warn("无法读取下班时间设置，已恢复为 18:00。", error);
      return { defaultEndTime: FALLBACK_END_TIME };
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function isValidTime(value) {
    if (!/^\d{2}:\d{2}$/.test(value || "")) return false;
    const [hours, minutes] = value.split(":").map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }

  function getPlannedEndTime(record) {
    return isValidTime(record.plannedEndTime) ? record.plannedEndTime : settings.defaultEndTime;
  }

  function getEndTarget(date, plannedEndTime) {
    const [hours, minutes] = plannedEndTime.split(":").map(Number);
    const target = new Date(date);
    target.setHours(hours, minutes, 0, 0);
    return target;
  }

  function getDateFromKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function getDateTimeFromKey(dateKey, time) {
    if (!isValidTime(time)) return null;
    const date = getDateFromKey(dateKey);
    const [hours, minutes] = time.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  function formatTimeInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function getBubbles(record) {
    return Array.isArray(record.bubbles) ? record.bubbles : [];
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

  function isRestDay(date, dateKey = getDateKey(date)) {
    const record = getRecord(dateKey);
    return record.restOverride === true;
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
    return formatTimeInput(value) || "未打卡";
  }

  function formatDuration(totalMinutes) {
    if (!Number.isFinite(totalMinutes)) return "等待记录";
    const safeMinutes = Math.max(0, Math.floor(totalMinutes));
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;
    return `${hours} 小时 ${minutes} 分钟`;
  }

  function formatCompactDuration(totalMinutes) {
    if (!Number.isFinite(totalMinutes)) return "等待记录";
    const safeMinutes = Math.max(0, Math.floor(totalMinutes));
    if (totalMinutes > 0 && safeMinutes === 0) return "少于 1 分钟";
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;
    return hours ? `${hours}小时 ${minutes}分钟` : `${minutes} 分钟`;
  }

  function formatStopwatch(totalMilliseconds) {
    const totalSeconds = Math.max(0, Math.floor(totalMilliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function getSlackingSessions(record) {
    return Array.isArray(record.slackingSessions) ? record.slackingSessions : [];
  }

  function getActiveSlackingSession(record) {
    const sessions = getSlackingSessions(record);
    for (let index = sessions.length - 1; index >= 0; index -= 1) {
      const session = sessions[index];
      if (session?.start && !session.end) return session;
    }
    return null;
  }

  function isSlacking(record) {
    return Boolean(record.clockIn && !record.clockOut && getActiveSlackingSession(record));
  }

  function calculateAttendanceMilliseconds(record) {
    if (!record.clockIn || !record.clockOut) return null;
    return Math.max(0, new Date(record.clockOut) - new Date(record.clockIn));
  }

  function calculateSlackingMilliseconds(record, until = new Date()) {
    if (!record.clockIn) return 0;
    const clockIn = new Date(record.clockIn).getTime();
    const limit = record.clockOut ? new Date(record.clockOut).getTime() : new Date(until).getTime();
    if (!Number.isFinite(clockIn) || !Number.isFinite(limit) || limit <= clockIn) return 0;

    return getSlackingSessions(record).reduce((total, session) => {
      const sessionStart = new Date(session?.start).getTime();
      const sessionEnd = session?.end ? new Date(session.end).getTime() : limit;
      if (!Number.isFinite(sessionStart) || !Number.isFinite(sessionEnd)) return total;
      const start = Math.max(clockIn, sessionStart);
      const end = Math.min(limit, sessionEnd);
      return total + Math.max(0, end - start);
    }, 0);
  }

  function calculateWorkedMilliseconds(record) {
    const attendance = calculateAttendanceMilliseconds(record);
    if (attendance === null) return null;
    return Math.max(0, attendance - calculateSlackingMilliseconds(record, new Date(record.clockOut)));
  }

  function calculateWorkedMinutes(record) {
    const worked = calculateWorkedMilliseconds(record);
    return worked === null ? null : worked / 60000;
  }

  function calculateCurrentWorkedMilliseconds(record, now = new Date()) {
    if (!record.clockIn || record.clockOut) return calculateWorkedMilliseconds(record);
    const start = new Date(record.clockIn).getTime();
    const end = new Date(now).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return Math.max(0, end - start - calculateSlackingMilliseconds(record, now));
  }

  function closeActiveSlackingAt(record, endDate) {
    const sessions = getSlackingSessions(record);
    const active = getActiveSlackingSession(record);
    if (!active) return;
    const start = new Date(active.start).getTime();
    if (Number.isFinite(start) && start < endDate.getTime()) active.end = endDate.toISOString();
    else record.slackingSessions = sessions.filter((session) => session !== active);
  }

  function autoCloseEligibleRecords(now = new Date()) {
    let changed = false;
    Object.entries(state.records).forEach(([dateKey, record]) => {
      if (!record?.clockIn || record.clockOut || record.overtimeOverride === true || record.restOverride === true) return;
      const date = getDateFromKey(dateKey);
      if (!Number.isFinite(date.getTime())) return;
      const target = getEndTarget(date, getPlannedEndTime(record));
      const clockIn = new Date(record.clockIn);
      if (!Number.isFinite(clockIn.getTime()) || target <= clockIn || now < target) return;
      closeActiveSlackingAt(record, target);
      record.clockOut = target.toISOString();
      record.clockOutSource = "auto";
      record.workedMinutes = calculateWorkedMinutes(record);
      changed = true;
    });
    if (changed) saveState();
    return changed;
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

  function preloadCompanionImage(src) {
    if (companionImageCache.has(src)) return companionImageCache.get(src);
    const promise = new Promise((resolve) => {
      const image = new Image();
      const finish = (loaded) => resolve(loaded);
      image.addEventListener("load", () => finish(true), { once: true });
      image.addEventListener("error", () => finish(false), { once: true });
      image.src = src;
      if (image.complete) finish(image.naturalWidth > 0);
    });
    companionImageCache.set(src, promise);
    return promise;
  }

  function waitForCompanionFade() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        elements.companionImage.removeEventListener("transitionend", onTransitionEnd);
        window.clearTimeout(fallbackTimer);
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.propertyName === "opacity") finish();
      };
      const fallbackTimer = window.setTimeout(finish, 220);
      elements.companionImage.addEventListener("transitionend", onTransitionEnd);
    });
  }

  async function setCompanion(src, alt, speech) {
    elements.speechBubble.textContent = speech;
    if (companionTargetSrc === src) return;

    companionTargetSrc = src;
    const requestId = ++companionRequestId;
    if (elements.companionImage.getAttribute("src") === src) {
      elements.companionImage.alt = alt;
      elements.stickerStage.dataset.companion = src.includes("slacking-fish") ? "slacking" : "default";
      elements.stickerStage.classList.remove("is-changing");
      return;
    }

    const loaded = await preloadCompanionImage(src);
    if (!loaded || requestId !== companionRequestId) return;

    elements.stickerStage.classList.add("is-changing");
    await waitForCompanionFade();
    if (requestId !== companionRequestId) return;

    elements.companionImage.src = src;
    elements.companionImage.alt = alt;
    elements.stickerStage.dataset.companion = src.includes("slacking-fish") ? "slacking" : "default";
    window.requestAnimationFrame(() => {
      if (requestId === companionRequestId) elements.stickerStage.classList.remove("is-changing");
    });
  }

  function renderToday(now = new Date()) {
    autoCloseEligibleRecords(now);
    const { dateKey, record, rest } = getTodayContext(now);
    if (dateKey !== lastRenderedDate) {
      lastRenderedDate = dateKey;
      selectedDateKey = dateKey;
      calendarCursor = startOfMonth(now);
    }

    elements.dateLabel.textContent = formatDateLong(now);
    const plannedEndTime = getPlannedEndTime(record);
    const target = getEndTarget(now, plannedEndTime);
    const untilEnd = target - now;
    const isOvertime = !rest && !record.clockOut && untilEnd <= 0;
    const slacking = isSlacking(record);
    const completedWork = calculateWorkedMilliseconds(record);
    const displayedDuration = rest ? 0 : completedWork ?? (isOvertime ? Math.abs(untilEnd) : Math.max(0, untilEnd));
    const hours = Math.floor(displayedDuration / 3600000);
    const minutes = Math.floor((displayedDuration % 3600000) / 60000);
    const seconds = Math.floor((displayedDuration % 60000) / 1000);
    elements.hours.textContent = String(hours).padStart(2, "0");
    elements.minutes.textContent = String(minutes).padStart(2, "0");
    elements.seconds.textContent = String(seconds).padStart(2, "0");

    elements.body.classList.toggle("is-resting", rest);
    elements.body.classList.toggle("is-complete", Boolean(record.clockOut));
    elements.body.classList.toggle("is-overtime", isOvertime);
    elements.body.classList.toggle("is-slacking", slacking);
    const canMarkOvertime = record.clockIn && !record.clockOut && !record.overtimeOverride && target - now <= 30 * 60000;
    const canUndoAutoClockOut = record.clockOut && record.clockOutSource === "auto";
    elements.overtimeButton.hidden = !(canMarkOvertime || canUndoAutoClockOut);
    elements.overtimeButton.textContent = canUndoAutoClockOut ? "今天其实加班了" : "还在加班";
    elements.countdown.hidden = Boolean(record.clockOut);

    if (rest) {
      elements.overline.textContent = "今天不用倒数";
      elements.heroTitle.textContent = "好好休息一下";
      elements.countdown.setAttribute("aria-label", "今天休息");
      const imageIndex = hashDate(dateKey) % REST_IMAGES.length;
      setCompanion(REST_IMAGES[imageIndex], "写着休字的可爱角色", "休息也是正经事");
    } else if (record.clockOut) {
      elements.overline.textContent = "今天收工";
      elements.heroTitle.textContent = "下班啦";
      elements.countdown.setAttribute("aria-label", "今天已经下班");
      const imageIndex = hashDate(`${dateKey}-${record.clockOut}`) % REST_IMAGES.length;
      setCompanion(REST_IMAGES[imageIndex], "写着休字的可爱角色", "正式进入休息模式！");
    } else if (slacking) {
      elements.overline.textContent = "正在摸鱼";
      elements.heroTitle.textContent = "忙里偷闲一下";
      elements.countdown.setAttribute("aria-label", "距离下班的剩余时间");
      setCompanion("assets/slacking-fish.png", "骑着大鱼摸鱼的可爱角色", "正在摸鱼…");
    } else if (isOvertime) {
      elements.overline.textContent = "今天已加班";
      elements.heroTitle.textContent = "辛苦了，记得下班打卡";
      elements.countdown.setAttribute("aria-label", "超过下班时间的时长");
      setCompanion("assets/record-pencil.png", "抱着铅笔记录的小动物", "坚持到现在，辛苦啦");
    } else if (record.clockIn) {
      elements.overline.textContent = "距离下班还有";
      elements.heroTitle.textContent = "稳稳度过今天";
      elements.countdown.setAttribute("aria-label", "距离下班的剩余时间");
      setCompanion("assets/record-pencil.png", "抱着铅笔记录的小动物", "You can do it！");
    } else {
      elements.overline.textContent = "距离下班还有";
      elements.heroTitle.textContent = "准备好就出发";
      elements.countdown.setAttribute("aria-label", "距离下班的剩余时间");
      setCompanion("assets/record-pencil.png", "抱着铅笔记录的小动物", "先打个上班卡吧");
    }

    elements.clockInValue.textContent = formatClock(record.clockIn);
    elements.clockOutValue.textContent = formatClock(record.clockOut);
    const slackingMilliseconds = calculateSlackingMilliseconds(record, now);
    const currentWorkedMilliseconds = calculateCurrentWorkedMilliseconds(record, now);
    const workedMinutes = record.clockOut
      ? (record.workedMinutes ?? calculateWorkedMinutes(record))
      : currentWorkedMilliseconds === null ? null : currentWorkedMilliseconds / 60000;
    const summaryStatus = rest
      ? "休息中"
      : record.clockOut
        ? "解放啦"
        : record.clockIn
          ? "进行中"
          : "未开始";
    elements.statusValue.textContent = summaryStatus;
    elements.slackingSummaryLabel.textContent = slacking
      ? "🐟 正在摸鱼"
      : record.clockOut
        ? "今天摸鱼"
        : "今日摸鱼";
    elements.slackingValue.textContent = rest
      ? "休息日"
      : slacking
        ? formatStopwatch(slackingMilliseconds)
        : formatCompactDuration(slackingMilliseconds / 60000);
    elements.durationValue.textContent = rest ? "休息日" : workedMinutes === null
      ? "等待记录"
      : formatCompactDuration(workedMinutes);

    elements.clockInButton.disabled = rest;
    elements.clockOutButton.disabled = rest || !record.clockIn;
    elements.slackingButton.disabled = rest || !record.clockIn || Boolean(record.clockOut);
    elements.clockInLabel.textContent = "上班打卡";
    elements.clockInHint.textContent = record.clockIn ? formatClock(record.clockIn) : rest ? "休息日无需打卡" : "记录这一刻";
    elements.clockOutHint.textContent = record.clockOut
      ? `${formatClock(record.clockOut)}${record.clockOutSource === "auto" ? " · 自动" : ""}`
      : !record.clockIn ? "上班后解锁" : `${plannedEndTime} 下班`;
    elements.slackingLabel.textContent = slacking ? "结束摸鱼" : "开始摸鱼";
    elements.slackingHint.textContent = rest
      ? "休息日无需记录"
      : !record.clockIn
        ? "上班后解锁"
      : record.clockOut
        ? `共摸鱼 ${formatCompactDuration(slackingMilliseconds / 60000)}`
        : slacking
          ? `已摸鱼 ${formatStopwatch(slackingMilliseconds)}`
          : slackingMilliseconds > 0
            ? `累计 ${formatCompactDuration(slackingMilliseconds / 60000)}`
            : "忙里偷闲一下";
    elements.slackingButton.setAttribute("aria-pressed", String(slacking));
    elements.slackingButton.setAttribute("aria-label", record.clockOut
      ? `今日已下班，共摸鱼 ${formatCompactDuration(slackingMilliseconds / 60000)}`
      : slacking
        ? `结束摸鱼，当前累计 ${formatStopwatch(slackingMilliseconds)}`
        : "开始摸鱼");
    elements.clockInButton.setAttribute("aria-label", record.clockIn ? `上班打卡时间 ${formatClock(record.clockIn)}；点击编辑` : "上班打卡");
    elements.clockOutButton.setAttribute("aria-label", record.clockOut
      ? `下班打卡时间 ${formatClock(record.clockOut)}${record.clockOutSource === "auto" ? "，自动补卡" : ""}；点击编辑`
      : `下班打卡；当前计划 ${plannedEndTime} 下班`);

    const bubbleCount = getBubbles(record).length;
    elements.bubbleButtonCount.textContent = bubbleCount ? ` · ${bubbleCount}` : "";

  }

  function hashDate(dateKey) {
    return [...dateKey].reduce((total, char) => total + char.charCodeAt(0), 0);
  }

  function clockIn() {
    const now = new Date();
    const { dateKey, record, rest } = getTodayContext(now);
    if (rest || record.clockIn) return;
    const target = ensureRecord(dateKey);
    target.clockIn = now.toISOString();
    delete target.clockOut;
    delete target.workedMinutes;
    delete target.slackingSessions;
    saveState();
    showToast(`今天 ${formatClock(target.clockIn)} 开始营业 ☕`);
    renderToday(now);
    renderCalendar();
  }

  function showDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    if (elements.toast.closest("dialog") === dialog) {
      const remainingDialogs = [...document.querySelectorAll("dialog[open]")];
      (remainingDialogs.at(-1) || document.body).append(elements.toast);
    }
  }

  function appendSlackingRow(start = "", end = "") {
    const row = document.createElement("div");
    row.className = "session-row";
    row.innerHTML = `
      <label>开始<input class="session-start" type="time" step="60" value="${start}"></label>
      <label>结束<input class="session-end" type="time" step="60" value="${end}"></label>
      <button class="session-delete" type="button" aria-label="删除这段摸鱼">删除</button>`;
    row.querySelector(".session-delete").addEventListener("click", () => {
      if (!window.confirm("确定删除这段摸鱼记录吗？")) return;
      row.remove();
      elements.slackingEmpty.hidden = Boolean(elements.slackingSessionList.children.length);
    });
    elements.slackingSessionList.append(row);
    elements.slackingEmpty.hidden = true;
  }

  function populateRecordEditor(dateKey) {
    const record = getRecord(dateKey);
    elements.recordClockIn.value = formatTimeInput(record.clockIn);
    elements.recordClockOut.value = formatTimeInput(record.clockOut);
    elements.recordPlannedEnd.value = getPlannedEndTime(record);
    elements.deleteClockIn.hidden = !record.clockIn;
    elements.deleteClockOut.hidden = !record.clockOut;
    elements.slackingSessionList.replaceChildren();
    getSlackingSessions(record).forEach((session) => {
      appendSlackingRow(formatTimeInput(session.start), formatTimeInput(session.end));
    });
    elements.slackingEmpty.hidden = Boolean(elements.slackingSessionList.children.length);
    const until = record.clockOut ? new Date(record.clockOut) : new Date();
    elements.quickSlackingTotal.textContent = `已记录 ${formatCompactDuration(calculateSlackingMilliseconds(record, until) / 60000)}`;
  }

  function openRecordEditor(dateKey = selectedDateKey, focusMode = "") {
    editingRecordDateKey = dateKey;
    const date = getDateFromKey(dateKey);
    elements.recordEditDate.textContent = new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "long", day: "numeric", weekday: "short"
    }).format(date);
    elements.preciseSlackingDetails.open = false;
    elements.customSlackingRow.hidden = true;
    elements.customSlackingMinutes.value = "";
    populateRecordEditor(dateKey);
    showDialog(elements.recordEditDialog);
    if (focusMode === "clockIn") elements.recordClockIn.focus();
    if (focusMode === "clockOut") elements.recordClockOut.focus();
  }

  function findQuickSlackingSlot(record, dateKey, minutes, now = new Date()) {
    if (!record.clockIn || record.restOverride === true || getActiveSlackingSession(record)) return null;
    const clockIn = new Date(record.clockIn);
    if (!Number.isFinite(clockIn.getTime())) return null;
    const today = dateKey === getDateKey(now);
    let limit = record.clockOut
      ? new Date(record.clockOut)
      : today
        ? now
        : getEndTarget(getDateFromKey(dateKey), getPlannedEndTime(record));
    if (!Number.isFinite(limit.getTime()) || limit <= clockIn) return null;

    const duration = minutes * 60000;
    let candidateEnd = limit.getTime();
    const sessions = getSlackingSessions(record)
      .filter((session) => session?.start && session?.end)
      .map((session) => ({ start: new Date(session.start).getTime(), end: new Date(session.end).getTime() }))
      .filter((session) => Number.isFinite(session.start) && Number.isFinite(session.end))
      .sort((a, b) => b.start - a.start);

    for (const session of sessions) {
      if (session.start >= candidateEnd || session.end <= clockIn.getTime()) continue;
      if (candidateEnd - Math.max(session.end, clockIn.getTime()) >= duration) break;
      candidateEnd = Math.min(candidateEnd, session.start);
    }
    if (candidateEnd - clockIn.getTime() < duration) return null;
    return {
      start: new Date(candidateEnd - duration).toISOString(),
      end: new Date(candidateEnd).toISOString()
    };
  }

  function addQuickSlacking(minutes) {
    if (!lockSlackingAction()) return;
    const safeMinutes = Math.floor(Number(minutes));
    if (!Number.isFinite(safeMinutes) || safeMinutes < 1 || safeMinutes > 720) {
      showToast("请输入 1～720 分钟");
      return;
    }
    const dateKey = editingRecordDateKey;
    const record = getRecord(dateKey);
    if (!record.clockIn) return showToast("请先保存上班时间，再快速补摸鱼");
    if (record.restOverride === true) return showToast("休息日不用补摸鱼");
    if (getActiveSlackingSession(record)) return showToast("先结束正在进行的摸鱼吧");
    const session = findQuickSlackingSlot(record, dateKey, safeMinutes);
    if (!session) return showToast("这一天没有足够的空档可补这段摸鱼");

    const undo = createRecordUndo(dateKey);
    const target = ensureRecord(dateKey);
    target.slackingSessions ||= [];
    target.slackingSessions.push(session);
    target.slackingSessions.sort((a, b) => new Date(a.start) - new Date(b.start));
    if (target.clockOut) target.workedMinutes = calculateWorkedMinutes(target);
    saveState();
    populateRecordEditor(dateKey);
    renderToday();
    renderCalendar();
    showToast(`已补摸鱼 ${safeMinutes} 分钟 🐟`, undo);
  }

  function deletePunchFromEditor(mode) {
    const label = mode === "clockIn" ? "上班" : "下班";
    const dateText = editingRecordDateKey === getDateKey(new Date()) ? "今天的" : "这一天的";
    if (!window.confirm(`确定取消${dateText}${label}打卡吗？`)) return;
    const record = ensureRecord(editingRecordDateKey);
    if (mode === "clockIn") {
      delete record.clockIn;
      delete record.clockOut;
      delete record.clockOutSource;
      delete record.workedMinutes;
      delete record.slackingSessions;
      elements.recordClockIn.value = "";
      elements.recordClockOut.value = "";
      elements.slackingSessionList.replaceChildren();
    } else {
      delete record.clockOut;
      delete record.clockOutSource;
      delete record.workedMinutes;
      elements.recordClockOut.value = "";
    }
    saveState();
    elements.deleteClockIn.hidden = !record.clockIn;
    elements.deleteClockOut.hidden = !record.clockOut;
    elements.slackingEmpty.hidden = Boolean(elements.slackingSessionList.children.length);
    renderToday();
    renderCalendar();
    showToast(`${label}打卡已删除`);
  }

  function collectSlackingSessions(dateKey, clockIn, clockOut) {
    const now = new Date();
    const todayKey = getDateKey(now);
    const rows = [...elements.slackingSessionList.querySelectorAll(".session-row")];
    const sessions = rows.map((row) => {
      const startValue = row.querySelector(".session-start").value;
      const endValue = row.querySelector(".session-end").value;
      const start = getDateTimeFromKey(dateKey, startValue);
      const end = endValue ? getDateTimeFromKey(dateKey, endValue) : null;
      if (!start || (endValue && !end)) throw new Error("请填写正确的摸鱼时间");
      if (end && start >= end) throw new Error("摸鱼的结束时间要晚于开始时间");
      if (!end && (dateKey !== todayKey || clockOut)) throw new Error("历史记录或已下班记录需要填写摸鱼结束时间");
      const effectiveEnd = end || now;
      if (clockIn && start < clockIn) throw new Error("摸鱼时间不能早于上班时间");
      if (clockOut && effectiveEnd > clockOut) throw new Error("摸鱼时间不能晚于下班时间");
      if (!clockOut && dateKey === todayKey && effectiveEnd > now) throw new Error("摸鱼结束时间不能晚于现在");
      return { start: start.toISOString(), ...(end ? { end: end.toISOString() } : {}) };
    }).sort((a, b) => new Date(a.start) - new Date(b.start));

    for (let index = 1; index < sessions.length; index += 1) {
      const previousEnd = sessions[index - 1].end ? new Date(sessions[index - 1].end) : now;
      if (new Date(sessions[index].start) < previousEnd) throw new Error("摸鱼记录不能互相重叠");
    }
    return sessions;
  }

  function saveRecordEditor() {
    const now = new Date();
    const dateKey = editingRecordDateKey;
    if (getDateFromKey(dateKey) > new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      showToast("未来日期暂时不能补打卡");
      return;
    }
    const clockIn = elements.recordClockIn.value ? getDateTimeFromKey(dateKey, elements.recordClockIn.value) : null;
    const clockOut = elements.recordClockOut.value ? getDateTimeFromKey(dateKey, elements.recordClockOut.value) : null;
    if (elements.recordClockIn.value && !clockIn || elements.recordClockOut.value && !clockOut) {
      showToast("请填写正确的打卡时间");
      return;
    }
    if (clockOut && !clockIn) {
      showToast("请先补上班时间");
      return;
    }
    if (clockIn && clockOut && clockOut <= clockIn) {
      showToast("下班时间需要晚于上班时间");
      return;
    }
    if (dateKey === getDateKey(now) && ((clockIn && clockIn > now) || (clockOut && clockOut > now))) {
      showToast("今天的打卡时间不能晚于现在");
      return;
    }
    try {
      const sessions = collectSlackingSessions(dateKey, clockIn, clockOut);
      const record = ensureRecord(dateKey);
      const wasRestDayWithoutClockIn = record.restOverride === true && !record.clockIn;
      const previousClockOut = record.clockOut;
      const previousSource = record.clockOutSource;
      if (clockIn) record.clockIn = clockIn.toISOString();
      else delete record.clockIn;
      if (clockIn && wasRestDayWithoutClockIn) delete record.restOverride;
      if (clockOut) {
        record.clockOut = clockOut.toISOString();
        const unchangedAutoTime = previousSource === "auto"
          && formatTimeInput(previousClockOut) === elements.recordClockOut.value;
        record.clockOutSource = unchangedAutoTime ? "auto" : "manual";
        delete record.overtimeOverride;
      } else {
        delete record.clockOut;
        delete record.clockOutSource;
        delete record.workedMinutes;
      }
      record.slackingSessions = sessions;
      if (!sessions.length) delete record.slackingSessions;
      const planned = elements.recordPlannedEnd.value;
      if (!isValidTime(planned)) throw new Error("请填写正确的计划下班时间");
      if (planned === settings.defaultEndTime) delete record.plannedEndTime;
      else record.plannedEndTime = planned;
      if (record.clockOut) record.workedMinutes = calculateWorkedMinutes(record);
      saveState();
      closeDialog(elements.recordEditDialog);
      renderToday();
      renderCalendar();
      showToast("当天记录已保存");
    } catch (error) {
      showToast(error.message || "记录没有保存，请检查时间");
    }
  }

  function openBubbles(dateKey = getDateKey(new Date())) {
    bubbleDateKey = dateKey;
    const date = getDateFromKey(dateKey);
    const today = dateKey === getDateKey(new Date());
    elements.bubbleTitle.textContent = today ? "今天的泡泡" : "那天的泡泡";
    elements.bubbleDateLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "long", day: "numeric", weekday: "short"
    }).format(date);
    elements.bubbleInput.value = "";
    renderBubbleList();
    showDialog(elements.bubbleDialog);
  }

  function renderBubbleList() {
    const record = getRecord(bubbleDateKey);
    const bubbles = getBubbles(record);
    elements.bubbleList.replaceChildren();
    bubbles.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach((bubble) => {
      const item = document.createElement("article");
      item.className = "bubble-item";
      const time = document.createElement("time");
      time.textContent = formatClock(bubble.createdAt).slice(0, 5);
      const textarea = document.createElement("textarea");
      textarea.maxLength = 500;
      textarea.value = String(bubble.text || "");
      const actions = document.createElement("div");
      const save = document.createElement("button");
      save.type = "button";
      save.textContent = "保存修改";
      save.addEventListener("click", () => {
        const text = textarea.value.trim();
        if (!text) return showToast("泡泡里还没有文字");
        bubble.text = text;
        saveState();
        renderSelectedDate(getDateFromKey(bubbleDateKey), getRecord(bubbleDateKey), isRestDay(getDateFromKey(bubbleDateKey), bubbleDateKey));
        showToast("泡泡已更新");
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "quiet-danger";
      remove.textContent = "删除";
      remove.addEventListener("click", () => {
        if (!window.confirm("确定删除这条泡泡吗？")) return;
        const target = ensureRecord(bubbleDateKey);
        target.bubbles = getBubbles(target).filter((entry) => entry.id !== bubble.id);
        if (!target.bubbles.length) delete target.bubbles;
        saveState();
        renderBubbleList();
        renderToday();
        renderCalendar();
      });
      actions.append(save, remove);
      item.append(time, textarea, actions);
      elements.bubbleList.append(item);
    });
    elements.bubbleEmpty.hidden = Boolean(bubbles.length);
  }

  function addBubble() {
    const text = elements.bubbleInput.value.trim();
    if (!text) return showToast("想吐槽什么就先写两句吧");
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const createdAt = getDateTimeFromKey(bubbleDateKey, time);
    const record = ensureRecord(bubbleDateKey);
    record.bubbles ||= [];
    record.bubbles.push({ id: makeId("bubble"), createdAt: createdAt.toISOString(), text });
    saveState();
    elements.bubbleInput.value = "";
    renderBubbleList();
    renderToday();
    renderCalendar();
    showToast("泡泡吹出去啦");
  }

  function handlePunchAction(mode) {
    const { record } = getTodayContext();
    if (record[mode]) return openRecordEditor(getDateKey(new Date()), mode);
    if (mode === "clockIn") clockIn();
    else clockOut();
  }

  function clockOut() {
    const now = new Date();
    const { dateKey, record, rest } = getTodayContext(now);
    if (rest || !record.clockIn || record.clockOut) return;
    const target = ensureRecord(dateKey);
    const activeSession = getActiveSlackingSession(target);
    if (activeSession) activeSession.end = now.toISOString();
    target.clockOut = now.toISOString();
    target.clockOutSource = "manual";
    target.workedMinutes = calculateWorkedMinutes(target);
    saveState();
    renderToday(now);
    renderCalendar();
    launchCelebration();
    showToast(`下班打卡成功 · 实际工作 ${formatDuration(target.workedMinutes)}`);
  }

  function toggleOvertimeOverride() {
    const now = new Date();
    const { dateKey, record } = getTodayContext(now);
    const target = ensureRecord(dateKey);
    if (record.clockOutSource === "auto" && record.clockOut) {
      delete target.clockOut;
      delete target.clockOutSource;
      delete target.workedMinutes;
      target.overtimeOverride = true;
      saveState();
      renderToday(now);
      renderCalendar();
      showToast("已撤销自动下班，继续加班中");
      return;
    }
    if (!record.clockIn || record.clockOut) return;
    target.overtimeOverride = true;
    saveState();
    renderToday(now);
    showToast("收到，今天继续加班");
  }

  function toggleSlacking() {
    if (!lockSlackingAction()) return;
    const now = new Date();
    const { dateKey, record, rest } = getTodayContext(now);
    if (rest || !record.clockIn || record.clockOut) return;
    const undo = createRecordUndo(dateKey);
    const target = ensureRecord(dateKey);
    const activeSession = getActiveSlackingSession(target);

    if (activeSession) {
      activeSession.end = now.toISOString();
      showToast(`摸鱼结束 · 今日累计 ${formatCompactDuration(calculateSlackingMilliseconds(target, now) / 60000)}`, undo);
    } else {
      target.slackingSessions ||= [];
      target.slackingSessions.push({ start: now.toISOString() });
      showToast("开始摸鱼 🐟", undo);
    }

    saveState();
    renderToday(now);
    renderCalendar();
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

  function showToast(message, undoAction = null) {
    window.clearTimeout(toastTimer);
    window.clearTimeout(undoTimer);
    const openDialogs = [...document.querySelectorAll("dialog[open]")];
    const activeDialog = openDialogs.at(-1);
    const toastHost = activeDialog || document.body;
    if (elements.toast.parentElement !== toastHost) toastHost.append(elements.toast);
    pendingUndo = typeof undoAction === "function" ? undoAction : null;
    elements.toastMessage.textContent = message;
    elements.toastUndo.hidden = !pendingUndo;
    elements.toast.classList.add("is-visible");
    const visibleDuration = pendingUndo ? 7000 : 3000;
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), visibleDuration);
    if (pendingUndo) {
      undoTimer = window.setTimeout(() => {
        pendingUndo = null;
        elements.toastUndo.hidden = true;
      }, 7000);
    }
  }

  function getMonthWorkCount(date) {
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return Object.entries(state.records).filter(([key, record]) => (
      key.startsWith(prefix) && record.clockIn && record.restOverride !== true
    )).length;
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
      const number = document.createElement("span");
      number.textContent = String(day);
      button.append(number);
      button.dataset.date = dateKey;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `${month + 1}月${day}日${rest ? "，休息日" : record.clockIn ? "，已上班打卡" : "，无记录"}`);
      button.classList.toggle("is-today", dateKey === todayKey);
      button.classList.toggle("is-worked", Boolean(record.clockIn) && !rest);
      button.classList.toggle("is-complete", Boolean(record.clockOut) && !rest);
      button.classList.toggle("is-rest", rest);
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

    const until = record.clockOut ? new Date(record.clockOut) : new Date();
    const slacking = rest ? null : calculateSlackingMilliseconds(record, until) / 60000;
    const workedMilliseconds = rest ? null : calculateCurrentWorkedMilliseconds(record, new Date());
    const worked = rest
      ? null
      : record.clockOut
        ? (record.workedMinutes ?? calculateWorkedMinutes(record))
        : workedMilliseconds === null ? null : workedMilliseconds / 60000;
    const target = getEndTarget(date, getPlannedEndTime(record));
    let status = rest ? "休息日" : "没有记录";
    if (!rest && record.clockIn && !record.clockOut) status = record.overtimeOverride ? "加班中" : "进行中";
    if (!rest && record.clockOut) {
      if (record.clockOutSource === "auto") status = "自动下班";
      else status = new Date(record.clockOut) > target ? "加班完成" : "正常下班";
    }
    elements.selectedDateStatus.textContent = status;
    elements.selectedDateTimes.textContent = `上班：${formatClock(record.clockIn)} · 下班：${formatClock(record.clockOut)}`;
    elements.selectedSlackingValue.textContent = rest ? "休息日" : formatCompactDuration(slacking);
    elements.selectedWorkedValue.textContent = rest ? "休息日" : worked === null ? "等待记录" : formatCompactDuration(worked);
    elements.selectedBubbleCount.textContent = `${getBubbles(record).length} 条`;
    elements.toggleSelectedRest.textContent = rest ? "✓ 休息日" : "🌙 设为休息日";
    elements.toggleSelectedRest.setAttribute("aria-pressed", String(rest));
    elements.toggleSelectedRest.classList.toggle("is-active", rest);
    const canUndoAuto = selectedDateKey === getDateKey(new Date())
      && record.clockOutSource === "auto"
      && Boolean(record.clockOut)
      && !rest;
    elements.selectedAutoOvertime.hidden = !canUndoAuto;
  }

  function toggleSelectedRest() {
    const record = ensureRecord(selectedDateKey);
    const undo = createRecordUndo(selectedDateKey);
    if (record.restOverride === true) {
      delete record.restOverride;
      if (record.clockOut) record.workedMinutes = calculateWorkedMinutes(record);
      saveState();
      renderToday();
      renderCalendar();
      showToast("已取消休息日", undo);
      return;
    }

    if ((record.clockIn || record.clockOut) && !window.confirm("这一天已经有打卡记录，标记为休息日后是否保留这些记录？")) return;
    record.restOverride = true;
    saveState();
    renderToday();
    renderCalendar();
    showToast("已标记为休息日", undo);
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
      records: state.records,
      settings
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
      if (parsed.settings && isValidTime(parsed.settings.defaultEndTime)) {
        settings.defaultEndTime = parsed.settings.defaultEndTime;
        saveSettings();
      }
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

  elements.themeButton?.addEventListener("click", () => {
    updateTheme(elements.body.dataset.theme === "cozy" ? "minimal" : "cozy");
  });
  elements.calendarButton?.addEventListener("click", openCalendar);
  elements.closeCalendar?.addEventListener("click", closeCalendar);
  elements.calendarDialog?.addEventListener("click", (event) => {
    if (event.target === elements.calendarDialog) closeCalendar();
  });
  elements.prevMonth?.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
    selectedDateKey = getDateKey(calendarCursor);
    renderCalendar();
  });
  elements.nextMonth?.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
    selectedDateKey = getDateKey(calendarCursor);
    renderCalendar();
  });
  elements.bubbleButton?.addEventListener("click", () => openBubbles(getDateKey(new Date())));
  elements.overtimeButton?.addEventListener("click", toggleOvertimeOverride);
  elements.clockInButton?.addEventListener("click", () => handlePunchAction("clockIn"));
  elements.clockOutButton?.addEventListener("click", () => handlePunchAction("clockOut"));
  elements.slackingButton?.addEventListener("click", toggleSlacking);
  elements.slackingSummaryButton?.addEventListener("click", () => openRecordEditor(getDateKey(new Date())));
  elements.exportButton?.addEventListener("click", exportData);
  elements.importInput?.addEventListener("change", importData);
  elements.clearButton?.addEventListener("click", clearData);
  elements.editSelectedRecord?.addEventListener("click", () => openRecordEditor(selectedDateKey));
  elements.toggleSelectedRest?.addEventListener("click", toggleSelectedRest);
  elements.selectedAutoOvertime?.addEventListener("click", toggleOvertimeOverride);
  elements.viewSelectedBubbles?.addEventListener("click", () => openBubbles(selectedDateKey));
  elements.closeRecordEdit?.addEventListener("click", () => closeDialog(elements.recordEditDialog));
  elements.cancelRecordEdit?.addEventListener("click", () => closeDialog(elements.recordEditDialog));
  elements.saveRecordEdit?.addEventListener("click", saveRecordEditor);
  elements.addSlackingSession?.addEventListener("click", () => appendSlackingRow());
  elements.quickSlackingButtons.forEach((button) => {
    button.addEventListener("click", () => addQuickSlacking(button.dataset.quickSlacking));
  });
  elements.showCustomSlacking?.addEventListener("click", () => {
    elements.customSlackingRow.hidden = !elements.customSlackingRow.hidden;
    if (!elements.customSlackingRow.hidden) elements.customSlackingMinutes.focus();
  });
  elements.addCustomSlacking?.addEventListener("click", () => {
    addQuickSlacking(elements.customSlackingMinutes.value);
    elements.customSlackingMinutes.value = "";
  });
  elements.customSlackingMinutes?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    elements.addCustomSlacking.click();
  });
  elements.deleteClockIn?.addEventListener("click", () => deletePunchFromEditor("clockIn"));
  elements.deleteClockOut?.addEventListener("click", () => deletePunchFromEditor("clockOut"));
  elements.recordEditDialog?.addEventListener("click", (event) => {
    if (event.target === elements.recordEditDialog) closeDialog(elements.recordEditDialog);
  });
  elements.closeBubble?.addEventListener("click", () => closeDialog(elements.bubbleDialog));
  elements.addBubble?.addEventListener("click", addBubble);
  elements.bubbleDialog?.addEventListener("click", (event) => {
    if (event.target === elements.bubbleDialog) closeDialog(elements.bubbleDialog);
  });
  elements.toastUndo?.addEventListener("click", () => {
    if (!pendingUndo) return;
    const undo = pendingUndo;
    pendingUndo = null;
    window.clearTimeout(undoTimer);
    undo();
    showToast("已撤销刚刚的操作");
  });

  updateTheme(localStorage.getItem(THEME_KEY) || "minimal", false);
  ["assets/record-pencil.png", "assets/slacking-fish.png", ...REST_IMAGES].forEach(preloadCompanionImage);
  autoCloseEligibleRecords();
  renderToday();
  renderCalendar();
  document.body.dataset.ready = "true";
  window.setInterval(() => renderToday(), 1000);
})();
