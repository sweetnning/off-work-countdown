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
    dayToggle: document.querySelector("#dayToggle"),
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
    statusText: document.querySelector("#statusText"),
    statusIcon: document.querySelector("#statusIcon"),
    slackingValue: document.querySelector("#slackingValue"),
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
    timeEditDialog: document.querySelector("#timeEditDialog"),
    timeEditKicker: document.querySelector("#timeEditKicker"),
    timeEditDialogTitle: document.querySelector("#timeEditDialogTitle"),
    timeEditHelp: document.querySelector("#timeEditHelp"),
    timeEditLabel: document.querySelector("#timeEditLabel"),
    timeEditInput: document.querySelector("#timeEditInput"),
    timeSaveScope: document.querySelector("#timeSaveScope"),
    cancelTimeEdit: document.querySelector("#cancelTimeEdit"),
    saveTimeEdit: document.querySelector("#saveTimeEdit"),
    celebrationLayer: document.querySelector("#celebrationLayer"),
    toast: document.querySelector("#toast")
  };

  let state = loadState();
  let settings = loadSettings();
  let calendarCursor = startOfMonth(new Date());
  let selectedDateKey = getDateKey(new Date());
  let toastTimer = 0;
  let lastRenderedDate = selectedDateKey;
  let editMode = "clockIn";
  const tapTimers = { clockIn: 0, clockOut: 0 };

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
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date(value));
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
    const plannedEndTime = getPlannedEndTime(record);
    const target = getEndTarget(now, plannedEndTime);
    const untilEnd = target - now;
    const isOvertime = !rest && !record.clockOut && untilEnd <= 0;
    const slacking = isSlacking(record);
    const completedWork = calculateWorkedMilliseconds(record);
    const displayedDuration = completedWork ?? (isOvertime ? Math.abs(untilEnd) : Math.max(0, untilEnd));
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
    elements.dayToggle.textContent = rest ? "切换为工作日" : "今天休息";
    elements.dayToggle.setAttribute("aria-pressed", String(rest));

    if (rest) {
      elements.overline.textContent = "今天不用倒数";
      elements.heroTitle.textContent = "好好休息一下";
      elements.countdown.setAttribute("aria-label", "今天休息");
      const imageIndex = hashDate(dateKey) % REST_IMAGES.length;
      setCompanion(REST_IMAGES[imageIndex], "写着休字的可爱角色", "休息也是正经事");
    } else if (record.clockOut) {
      elements.overline.textContent = "今日实际工作";
      elements.heroTitle.textContent = "下班啦，辛苦了";
      elements.countdown.setAttribute("aria-label", "扣除摸鱼后的实际工作时长");
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
    const workedMinutes = record.clockOut ? (record.workedMinutes ?? calculateWorkedMinutes(record)) : null;
    const summaryStatus = rest
      ? { text: "休息中", icon: "" }
      : record.clockOut
        ? { text: "解放了", icon: "assets/status-free.png" }
        : record.clockIn
          ? { text: "进行中", icon: "assets/status-working.png" }
          : { text: "未开始", icon: "" };
    elements.statusText.textContent = summaryStatus.text;
    elements.statusValue.setAttribute("aria-label", summaryStatus.text);
    elements.statusIcon.hidden = !summaryStatus.icon;
    if (summaryStatus.icon) elements.statusIcon.src = summaryStatus.icon;
    else elements.statusIcon.removeAttribute("src");
    elements.slackingValue.textContent = formatCompactDuration(slackingMilliseconds / 60000);
    elements.durationValue.textContent = workedMinutes === null
      ? record.clockIn ? "等待下班" : "等待记录"
      : formatCompactDuration(workedMinutes);

    elements.clockInButton.disabled = rest;
    elements.clockOutButton.disabled = rest || !record.clockIn;
    elements.slackingButton.disabled = rest || !record.clockIn || Boolean(record.clockOut);
    elements.clockInLabel.textContent = "上班打卡";
    elements.clockInHint.textContent = record.clockIn ? formatClock(record.clockIn) : rest ? "休息日无需打卡" : "记录这一刻";
    elements.clockOutHint.textContent = record.clockOut ? formatClock(record.clockOut) : !record.clockIn ? "上班后解锁" : `${plannedEndTime} 下班`;
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
    elements.clockInButton.setAttribute("aria-label", record.clockIn ? `上班打卡时间 ${formatClock(record.clockIn)}；单击取消，双击修改` : "上班打卡");
    elements.clockOutButton.setAttribute("aria-label", record.clockOut
      ? `下班打卡时间 ${formatClock(record.clockOut)}；单击取消，双击修改`
      : `下班打卡；当前计划 ${plannedEndTime} 下班，单击打卡，双击调整计划时间`);

  }

  function hashDate(dateKey) {
    return [...dateKey].reduce((total, char) => total + char.charCodeAt(0), 0);
  }

  function toggleRestDay() {
    const now = new Date();
    const dateKey = getDateKey(now);
    const record = ensureRecord(dateKey);
    if (isRestDay(now, dateKey)) delete record.restOverride;
    else {
      record.restOverride = true;
      const activeSession = getActiveSlackingSession(record);
      if (activeSession) activeSession.end = now.toISOString();
    }
    saveState();
    showToast(record.restOverride ? "今天已标记为休息日" : "已恢复为工作日");
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
    delete target.slackingSessions;
    saveState();
    showToast(`上班打卡成功 · ${formatClock(target.clockIn)}`);
    renderToday(now);
    renderCalendar();
  }

  function openTimeEditor(mode) {
    const { record, rest } = getTodayContext();
    const value = record[mode];
    if (rest || !value) return;
    editMode = mode;
    const editingClockIn = mode === "clockIn";
    const punchDate = new Date(value);
    elements.timeEditKicker.textContent = "补录实际时间";
    elements.timeEditDialogTitle.textContent = editingClockIn ? "修改上班时间" : "修改下班时间";
    elements.timeEditHelp.textContent = editingClockIn
      ? "选择今天真正开始工作的时间，今日工作时长会自动更新。"
      : "选择今天真正结束工作的时间，今日工作时长会自动更新。";
    elements.timeEditLabel.textContent = editingClockIn ? "今天几点开始工作？" : "今天几点结束工作？";
    elements.timeEditInput.value = `${String(punchDate.getHours()).padStart(2, "0")}:${String(punchDate.getMinutes()).padStart(2, "0")}`;
    elements.timeSaveScope.hidden = true;
    if (typeof elements.timeEditDialog.showModal === "function") {
      elements.timeEditDialog.showModal();
    } else {
      elements.timeEditDialog.setAttribute("open", "");
    }
  }

  function openPlannedEndEditor() {
    const { record, rest } = getTodayContext();
    if (rest || !record.clockIn || record.clockOut) return;
    editMode = "plannedEnd";
    elements.timeEditKicker.textContent = "调整倒计时";
    elements.timeEditDialogTitle.textContent = "调整计划下班时间";
    elements.timeEditHelp.textContent = "只改变倒计时目标，不会生成下班打卡，也不会修改已有记录。";
    elements.timeEditLabel.textContent = "今天计划几点下班？";
    elements.timeEditInput.value = getPlannedEndTime(record);
    elements.timeSaveScope.hidden = false;
    const todayScope = elements.timeSaveScope.querySelector('input[value="today"]');
    if (todayScope) todayScope.checked = true;
    if (typeof elements.timeEditDialog.showModal === "function") {
      elements.timeEditDialog.showModal();
    } else {
      elements.timeEditDialog.setAttribute("open", "");
    }
  }

  function closeTimeEditor() {
    if (typeof elements.timeEditDialog.close === "function") elements.timeEditDialog.close();
    else elements.timeEditDialog.removeAttribute("open");
  }

  function saveEditedTime() {
    const value = elements.timeEditInput.value;
    if (!isValidTime(value)) {
      showToast("请先选择打卡时间");
      return;
    }

    const now = new Date();
    const dateKey = getDateKey(now);
    const record = ensureRecord(dateKey);

    if (editMode === "plannedEnd") {
      const scope = elements.timeSaveScope.querySelector('input[name="endTimeScope"]:checked')?.value || "today";
      if (scope === "default") {
        settings.defaultEndTime = value;
        saveSettings();
        delete record.plannedEndTime;
        showToast(`默认下班时间已改为 ${value}`);
      } else {
        record.plannedEndTime = value;
        showToast(`今天改为 ${value} 下班`);
      }
      saveState();
      closeTimeEditor();
      renderToday(now);
      renderCalendar();
      return;
    }

    const [hours, minutes] = value.split(":").map(Number);
    const revisedTime = new Date(now);
    revisedTime.setHours(hours, minutes, 0, 0);

    if (revisedTime > now) {
      showToast("打卡时间不能晚于现在");
      return;
    }
    if (editMode === "clockIn" && record.clockOut && revisedTime >= new Date(record.clockOut)) {
      showToast("上班时间需要早于下班时间");
      return;
    }
    if (editMode === "clockOut" && record.clockIn && revisedTime <= new Date(record.clockIn)) {
      showToast("下班时间需要晚于上班时间");
      return;
    }

    record[editMode] = revisedTime.toISOString();
    if (record.clockOut) record.workedMinutes = calculateWorkedMinutes(record);
    saveState();
    closeTimeEditor();
    renderToday(now);
    renderCalendar();
    showToast(`${editMode === "clockIn" ? "上班" : "下班"}时间已修改为 ${formatClock(record[editMode]).slice(0, 5)}`);
  }

  function cancelPunch(mode) {
    const { dateKey, record } = getTodayContext();
    if (!record[mode]) return;
    const label = mode === "clockIn" ? "上班" : "下班";
    const extra = mode === "clockIn" && record.clockOut ? "，下班打卡也会一并取消" : "";
    if (!window.confirm(`确定取消今天的${label}打卡吗${extra}？`)) return;
    const target = ensureRecord(dateKey);
    if (mode === "clockIn") {
      delete target.clockIn;
      delete target.clockOut;
      delete target.slackingSessions;
    } else {
      delete target.clockOut;
    }
    delete target.workedMinutes;
    saveState();
    renderToday();
    renderCalendar();
    showToast(`${label}打卡已取消`);
  }

  function handlePunchAction(mode) {
    const { record } = getTodayContext();
    if (!record[mode]) {
      if (mode === "clockIn") {
        clockIn();
        return;
      }

      if (tapTimers.clockOut) {
        window.clearTimeout(tapTimers.clockOut);
        tapTimers.clockOut = 0;
        openPlannedEndEditor();
        return;
      }

      tapTimers.clockOut = window.setTimeout(() => {
        tapTimers.clockOut = 0;
        clockOut();
      }, 280);
      return;
    }

    if (tapTimers[mode]) {
      window.clearTimeout(tapTimers[mode]);
      tapTimers[mode] = 0;
      openTimeEditor(mode);
      return;
    }

    tapTimers[mode] = window.setTimeout(() => {
      tapTimers[mode] = 0;
      cancelPunch(mode);
    }, 280);
  }

  function clockOut() {
    const now = new Date();
    const { dateKey, record, rest } = getTodayContext(now);
    if (rest || !record.clockIn || record.clockOut) return;
    const target = ensureRecord(dateKey);
    const activeSession = getActiveSlackingSession(target);
    if (activeSession) activeSession.end = now.toISOString();
    target.clockOut = now.toISOString();
    target.workedMinutes = calculateWorkedMinutes(target);
    saveState();
    renderToday(now);
    renderCalendar();
    launchCelebration();
    showToast(`下班打卡成功 · 实际工作 ${formatDuration(target.workedMinutes)}`);
  }

  function toggleSlacking() {
    const now = new Date();
    const { dateKey, record, rest } = getTodayContext(now);
    if (rest || !record.clockIn || record.clockOut) return;
    const target = ensureRecord(dateKey);
    const activeSession = getActiveSlackingSession(target);

    if (activeSession) {
      activeSession.end = now.toISOString();
      showToast(`摸鱼结束 · 今日累计 ${formatCompactDuration(calculateSlackingMilliseconds(target, now) / 60000)}`);
    } else {
      target.slackingSessions ||= [];
      target.slackingSessions.push({ start: now.toISOString() });
      showToast("开始摸鱼，放松一下吧");
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
      const attendance = calculateAttendanceMilliseconds(record) / 60000;
      const slacking = calculateSlackingMilliseconds(record, new Date(record.clockOut)) / 60000;
      const worked = record.workedMinutes ?? calculateWorkedMinutes(record);
      elements.selectedDateStatus.textContent = `实际工作 ${formatDuration(worked)} · 摸鱼 ${formatCompactDuration(slacking)}`;
      elements.selectedDateTimes.textContent = `${formatClock(record.clockIn)} 上班 · ${formatClock(record.clockOut)} 下班 · 总时长 ${formatCompactDuration(attendance)}`;
    } else if (record.clockIn) {
      const slacking = calculateSlackingMilliseconds(record) / 60000;
      elements.selectedDateStatus.textContent = isSlacking(record) ? `摸鱼中 · 已累计 ${formatCompactDuration(slacking)}` : "已上班打卡";
      elements.selectedDateTimes.textContent = `${formatClock(record.clockIn)} 开始 · 尚未下班打卡 · 摸鱼 ${formatCompactDuration(slacking)}`;
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
  elements.dayToggle?.addEventListener("click", toggleRestDay);
  elements.clockInButton?.addEventListener("click", () => handlePunchAction("clockIn"));
  elements.clockOutButton?.addEventListener("click", () => handlePunchAction("clockOut"));
  elements.slackingButton?.addEventListener("click", toggleSlacking);
  elements.clockInButton?.addEventListener("dblclick", (event) => event.preventDefault());
  elements.clockOutButton?.addEventListener("dblclick", (event) => event.preventDefault());
  elements.cancelTimeEdit?.addEventListener("click", closeTimeEditor);
  elements.saveTimeEdit?.addEventListener("click", saveEditedTime);
  elements.timeEditDialog?.addEventListener("click", (event) => {
    if (event.target === elements.timeEditDialog) closeTimeEditor();
  });
  elements.exportButton?.addEventListener("click", exportData);
  elements.importInput?.addEventListener("change", importData);
  elements.clearButton?.addEventListener("click", clearData);

  updateTheme(localStorage.getItem(THEME_KEY) || "minimal", false);
  renderToday();
  renderCalendar();
  document.body.dataset.ready = "true";
  window.setInterval(() => renderToday(), 1000);
})();
