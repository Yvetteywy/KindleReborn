(function () {
  "use strict";
  var core = window.KindleCore, moment = window.moment, lunar = window.KindlingLunar;
  var SETTINGS = "kindle_settings_v1", PLACE = "kindle_place_v1", CACHE = "kindle_weather_v1:";
  var options, place = null, data = null, air = null, generation = 0, searchGeneration = 0, requestGeneration = 0;
  var pending = false, lastAttempt = 0, lastSlot = "", lastDate = "", lastClean = "";
  var weatherError = "", airError = "", searchResults = [], notice = "", storageFailed = false;
  var labels = {
    en: {
      title: "Kindle calendar & weather", settings: "Settings", close: "Done", city: "City or postal code",
      search: "Search", choose: "Choose a location", language: "Language", units: "Units",
      orientation: "Layout", portrait: "Portrait", landscape: "Landscape", lunar: "Lunar calendar",
      almanac: "Chinese almanac", save: "Apply settings", bookmark: "Bookmark this configuration",
      metric: "Metric (°C, km/h)", us: "US (°F, mph)", humidity: "Humidity", feels: "Feels like",
      wind: "Wind", air: "US AQI", uv: "UV index", rain: "Rain chance", hourly: "Hourly forecast",
      weather: "Weather", suitable: "Suitable", avoid: "Avoid",
      traditional: "Traditional calendar; cultural reference only.", waiting: "Choose a city in Settings to load weather.",
      loading: "Loading weather…", searching: "Searching…", noResults: "No matching cities. Try another name or postal code.",
      weatherFailed: "Weather unavailable. Check Wi-Fi and retry.", airFailed: "Air quality unavailable.",
      stale: "Stale cached weather", refresh: "Refresh",
      storage: "Storage unavailable; settings/cache will not be saved.", badCache: "Saved weather was invalid and was ignored.",
      badSettings: "Saved settings were invalid and were ignored.", badURL: "Invalid URL settings.",
      timeError: "Location time zone unavailable. Choose another location.", searchFailed: "City search failed. Check Wi-Fi and retry.",
      lunarError: "Lunar calendar unavailable.", none: "None listed",
      leap: "leap month", month: "month", day: "day", clock: "Time uses your device clock.",
      locationRequired: "Choose a location before creating a bookmark.",
      days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    },
    zh: {
      title: "Kindle 日历天气屏", settings: "设置", close: "完成", city: "城市或邮政编码", search: "搜索",
      choose: "选择地点", language: "语言", units: "单位", orientation: "布局", portrait: "竖屏",
      landscape: "横屏", lunar: "农历", almanac: "黄历", save: "应用设置", bookmark: "将此配置加入书签",
      metric: "公制 (°C, km/h)", us: "美制 (°F, mph)", humidity: "湿度", feels: "体感",
      wind: "风速", air: "美国 AQI", uv: "紫外线", rain: "降水概率", hourly: "逐小时预报",
      weather: "天气", suitable: "宜", avoid: "忌", traditional: "传统日历，仅供文化参考。",
      waiting: "请在设置中选择城市以加载天气。", loading: "正在加载天气…", searching: "正在搜索…",
      noResults: "未找到城市，请尝试其他名称或邮政编码。", weatherFailed: "天气暂不可用，请检查网络后重试。",
      airFailed: "空气质量暂不可用。", stale: "缓存天气已过期",
      refresh: "刷新", storage: "无法使用本地存储，设置和天气缓存不会保存。",
      badCache: "天气缓存无效，已忽略。", badSettings: "已保存的设置无效，已忽略。", badURL: "网址设置无效。",
      timeError: "地点时区不可用，请选择其他地点。", searchFailed: "城市搜索失败，请检查网络后重试。",
      lunarError: "农历暂不可用。", none: "无", leap: "闰月", month: "月", day: "日",
      clock: "时间以设备时钟为准。", locationRequired: "请先选择地点再创建书签。",
      days: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
      months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
    }
  };
  function el(id) { return document.getElementById(id); }
  function t(key) { return labels[options.language][key]; }
  function text(node, value) {
    if (typeof node === "string") node = el(node);
    if (!node) return;
    if ("textContent" in node) node.textContent = String(value);
    else node.innerText = String(value);
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function report(error) { if (window.console && window.console.error) window.console.error(error); }
  function stored(key) {
    try { return window.localStorage.getItem(key); }
    catch (error) { storageFailed = true; report(error); return null; }
  }
  function store(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { storageFailed = true; report(error); status(); }
  }
  function readJSON(key) {
    var value = stored(key);
    if (!value) return null;
    try { return JSON.parse(value); }
    catch (error) { report(error); notice = key === SETTINGS || key === PLACE ? "badSettings" : "badCache"; return null; }
  }
  function xhr(url, done) {
    var request = new XMLHttpRequest(), finished = false, timer;
    function finish(error, response) {
      if (finished) return;
      finished = true; clearTimeout(timer); done(error, response);
    }
    request.onreadystatechange = function () {
      if (request.readyState !== 4 || finished) return;
      if (request.status < 200 || request.status >= 300) { finish(new Error("HTTP " + request.status)); return; }
      var response;
      try { response = JSON.parse(request.responseText); }
      catch (error) { finish(error); return; }
      finish(null, response);
    };
    request.onerror = function () { finish(new Error("Network request failed")); };
    try {
      request.open("GET", url, true);
      timer = setTimeout(function () {
        finish(new Error("Request timed out"));
        request.abort();
      }, 15000);
      request.send(null);
    } catch (error) { finish(error); }
  }
  function unit() { return options.units === "us" ? "°F" : "°C"; }
  function temp(value) { var result = core.temperature(value, options.units); return result === null ? "--" : result + unit(); }
  function rounded(value, suffix) { return core.number(value) ? Math.round(value) + (suffix || "") : "--"; }
  function image(node, code) {
    clear(node);
    var img = document.createElement("img");
    img.src = "assets/" + core.icon(code) + ".svg";
    img.alt = core.condition(code, options.language); node.appendChild(img);
  }
  function parts(timestamp) {
    if (place) return core.localParts(timestamp, place.timezone, moment);
    var date = new Date(timestamp);
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
      weekday: date.getDay(), hour: date.getHours(), minute: date.getMinutes() };
  }
  function locationName(value) {
    return value.name + (value.region ? ", " + value.region : "") + (value.country ? ", " + value.country : "");
  }
  function status() {
    if (!options) return;
    var messages = [];
    if (notice) messages.push(t(notice));
    if (storageFailed) messages.push(t("storage"));
    if (weatherError) messages.push(t(weatherError));
    else if (!data) messages.push(t(pending ? "loading" : "waiting"));
    if (data && (weatherError || lastSlot !== core.weatherSlot(Date.now(), place.timezone, moment))) messages.push(t("stale"));
    if (airError) messages.push(t(airError));
    text("weather-notice", messages.join(" · "));
    el("weather-notice").style.display = messages.length ? "block" : "none";
    resizeWeather();
  }
  function translate() {
    document.documentElement.lang = options.language === "zh" ? "zh-CN" : "en";
    document.title = t("title");
    var nodes = document.querySelectorAll("[data-label]"), i;
    for (i = 0; i < nodes.length; i++) text(nodes[i], t(nodes[i].getAttribute("data-label")));
    text("weather-city", place ? place.name : t("weather"));
    el("weather-city").title = place ? locationName(place) : t("weather");
    el("weather-city").setAttribute("aria-label", t("settings") + ": " + (place ? locationName(place) : t("weather")));
    text("location-details", place ? locationName(place) + " · " + place.timezone : "");
    el("language").value = options.language; el("units").value = options.units;
    el("orientation").value = options.orientation; el("show-lunar").checked = options.lunar; el("show-almanac").checked = options.almanac;
    lastDate = ""; resize(); tick(); renderWeather(); status();
  }
  function resize() {
    var width = document.documentElement.clientWidth || 560, height = document.documentElement.clientHeight || 780;
    var landscape = options.orientation === "landscape", board = el("board"), optionalHeight = (options.lunar ? 36 : 0) + (options.almanac ? 88 : 0);
    board.className = landscape ? "landscape" : "portrait";
    board.style.width = Math.min(width, landscape ? 780 : 560) + "px";
    board.style.height = Math.max((landscape ? 400 : 630) + optionalHeight + 16,
      Math.min(height, landscape ? 560 : 780)) + "px";
    el("core-panels").style.height = Math.max(100, parseInt(board.style.height, 10) - optionalHeight - 16) + "px";
    el("lunar-panel").style.display = options.lunar ? "block" : "none";
    el("almanac-panel").style.display = options.almanac ? "block" : "none";
    resizeWeather();
  }
  function resizeWeather() {
    el("weather-details").style.height = Math.max(140, el("weather-widget").clientHeight -
      el("weather-notice").offsetHeight) + "px";
  }
  function renderCalendar(local) {
    var year = local.year, month = local.month - 1, first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    var count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(), offset = first === 0 ? 6 : first - 1, day = 1, row, cell, i, j;
    text("month-title", options.language === "zh" ? year + "年 " + (month + 1) + "月" : t("months")[month] + " " + year);
    clear(el("weekdays")); row = document.createElement("tr");
    for (i = 0; i < 7; i++) {
      cell = document.createElement("th"); text(cell, options.language === "zh" ? ["一", "二", "三", "四", "五", "六", "日"][i] : ["M", "T", "W", "T", "F", "S", "S"][i]); row.appendChild(cell);
    }
    el("weekdays").appendChild(row); clear(el("calendar"));
    for (i = 0; i < 6; i++) {
      row = document.createElement("tr");
      for (j = 0; j < 7; j++) {
        cell = document.createElement("td");
        if (i * 7 + j >= offset && day <= count) {
          text(cell, day); if (day === local.day) cell.className = "active"; day++;
        }
        row.appendChild(cell);
      }
      el("calendar").appendChild(row);
      if (day > count) break;
    }
    if (!options.lunar && !options.almanac) return;
    try {
      lunar.I18n.setLanguage(options.language === "zh" ? "chs" : "en");
      var calendar = lunar.Solar.fromYmd(year, month + 1, local.day).getLunar();
      var lunarMonth = calendar.getMonth();
      text("lunar-date", options.language === "zh" ? (lunarMonth < 0 ? "闰" : "") + calendar.getMonthInChinese() + "月" + calendar.getDayInChinese() :
        t("month") + " " + Math.abs(lunarMonth) + (lunarMonth < 0 ? " (" + t("leap") + ")" : "") + ", " + t("day") + " " + calendar.getDay());
      text("suitable", calendar.getDayYi().slice(0, 5).join(" · ") || t("none"));
      text("avoid", calendar.getDayJi().slice(0, 5).join(" · ") || t("none"));
    } catch (error) { report(error); notice = "lunarError"; text("lunar-date", "--"); text("suitable", "--"); text("avoid", "--"); }
  }
  function tick() {
    var now = Date.now(), local, date;
    try { local = parts(now); }
    catch (error) { report(error); notice = "timeError"; status(); return; }
    text("time", core.pad(local.hour) + ":" + core.pad(local.minute)); date = core.dateKey(local);
    text("date", date.replace(/-/g, " / ")); text("weekday", t("days")[local.weekday]);
    if (date !== lastDate) { lastDate = date; renderCalendar(local); renderWeather(); }
    if (place) {
      var slot = core.weatherSlot(now, place.timezone, moment);
      if (!pending && lastSlot !== slot && now - lastAttempt >= 60000) loadWeather();
      if ((local.hour === 7 || local.hour === 17) && lastClean !== date + ":" + local.hour) {
        lastClean = date + ":" + local.hour; clean();
      }
    }
    status();
  }
  function renderWeather() {
    var fields = ["temp", "condition", "high-low", "humidity", "feels", "wind", "air", "uv", "rain"], i;
    if (!data || !place) {
      for (i = 0; i < fields.length; i++) text(fields[i], "--");
      clear(el("hourly")); clear(el("condition-icon")); return;
    }
    var local = parts(Date.now()), today = core.dailyFor(data, core.dateKey(local), moment);
    var current = data.current, article, value, localHour;
    text("temp", temp(current.temperature)); text("condition", core.condition(current.code, options.language));
    image(el("condition-icon"), current.code); text("high-low", today ? temp(today.high) + " / " + temp(today.low) : "--");
    text("humidity", rounded(current.humidity, "%")); text("feels", temp(current.feelsLike));
    value = core.wind(current.windSpeed, options.units);
    text("wind", value === null ? "--" : core.direction(current.windDirection, options.language) + " " + value + (options.units === "us" ? " mph" : " km/h"));
    text("air", air === null ? "--" : core.airLabel(air, options.language) + " (" + Math.round(air) + ")");
    text("uv", today ? rounded(today.uv) : "--"); text("rain", today ? rounded(today.rain, "%") : "--");
    clear(el("hourly"));
    for (i = 0; i < data.hourly.length; i++) {
      article = document.createElement("div"); article.className = "hour";
      localHour = parts(data.hourly[i].time); value = document.createElement("span");
      text(value, core.pad(localHour.hour) + ":" + core.pad(localHour.minute)); article.appendChild(value);
      value = document.createElement("div"); image(value, data.hourly[i].code); article.appendChild(value);
      value = document.createElement("b"); text(value, temp(data.hourly[i].temperature)); article.appendChild(value);
      el("hourly").appendChild(article);
    }
  }
  function loadCache() {
    var saved = readJSON(CACHE + core.placeKey(place));
    data = null; air = null; lastSlot = "";
    if (!saved) return;
    if (!core.validCache(saved, place)) { notice = "badCache"; report(new Error("Invalid weather cache")); return; }
    data = saved.data;
    air = core.number(saved.air) ? saved.air : null;
  }
  function saveCache() {
    if (data) store(CACHE + core.placeKey(place), { version: 1, data: data, air: air });
  }
  function loadWeather() {
    if (!place || pending) return;
    var token = generation, requestId = ++requestGeneration, selected = place;
    var coords = "latitude=" + selected.latitude + "&longitude=" + selected.longitude;
    var slot = core.weatherSlot(Date.now(), selected.timezone, moment);
    pending = true; lastAttempt = Date.now(); weatherError = ""; airError = ""; status();
    xhr("https://api.open-meteo.com/v1/forecast?" + coords +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m" +
      "&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max" +
      "&timezone=" + encodeURIComponent(selected.timezone) + "&timeformat=unixtime&forecast_days=3", function (error, response) {
      if (token !== generation || requestId !== requestGeneration) return;
      pending = false;
      if (!error) {
        try { data = core.normalize(response, selected, Date.now()); lastSlot = slot; saveCache(); }
        catch (invalid) { error = invalid; }
      }
      if (error) { weatherError = "weatherFailed"; report(error); }
      renderWeather(); status();
    });
    xhr("https://air-quality-api.open-meteo.com/v1/air-quality?" + coords +
      "&current=us_aqi&timezone=" + encodeURIComponent(selected.timezone), function (error, response) {
      if (token !== generation || requestId !== requestGeneration) return;
      if (!error && (!response || !response.current || !core.number(response.current.us_aqi))) error = new Error("Invalid air-quality response");
      if (error) { air = null; airError = "airFailed"; report(error); }
      else air = response.current.us_aqi;
      saveCache(); renderWeather(); status();
    });
  }
  function selectPlace(selected) {
    if (!core.validPlace(selected) || !moment.tz.zone(selected.timezone)) {
      notice = "timeError"; report(new Error("Unsupported location")); status(); return;
    }
    generation++; place = selected; pending = false; weatherError = ""; airError = ""; lastAttempt = 0;
    store(PLACE, place); loadCache(); translate(); loadWeather(); updateBookmark();
    closeSettings();
  }
  function searchCity(city) {
    var token = ++searchGeneration;
    clear(el("city-results")); text("search-status", t("searching"));
    xhr("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(city) +
      "&count=10&language=" + (options.language === "zh" ? "zh" : "en") + "&format=json", function (error, response) {
      if (token !== searchGeneration) return;
      if (!error) {
        try { searchResults = core.places(response); }
        catch (invalid) { error = invalid; }
      }
      if (error) { report(error); text("search-status", t("searchFailed")); return; }
      text("search-status", searchResults.length ? t("choose") : t("noResults"));
      var i, button, row;
      for (i = 0; i < searchResults.length; i++) {
        row = document.createElement("li"); button = document.createElement("button"); button.type = "button";
        text(button, locationName(searchResults[i]));
        button.setAttribute("data-place", i);
        button.onclick = function () { selectPlace(searchResults[parseInt(this.getAttribute("data-place"), 10)]); };
        row.appendChild(button); el("city-results").appendChild(row);
      }
    });
  }
  function updateBookmark() {
    if (!place) { el("bookmark").removeAttribute("href"); return; }
    el("bookmark").href = core.bookmark(place, options);
  }
  function openSettings() {
    el("settings-panel").style.display = "block";
    el("weather-city").setAttribute("aria-expanded", "true");
    el("city-input").focus();
  }
  function closeSettings() {
    el("settings-panel").style.display = "none";
    el("weather-city").setAttribute("aria-expanded", "false");
    el("weather-city").focus();
  }
  function clean() {
    var overlay = el("eink-refresh"); overlay.style.display = "block"; overlay.style.background = "#000";
    setTimeout(function () {
      overlay.style.background = "#fff";
      setTimeout(function () { overlay.style.display = "none"; }, 600);
    }, 600);
  }
  var parsed = core.query(location.search), savedSettings = readJSON(SETTINGS), raw = {}, key;
  if (savedSettings && (typeof savedSettings !== "object" || Object.prototype.toString.call(savedSettings) === "[object Array]")) {
    notice = "badSettings"; report(new Error("Invalid saved settings")); savedSettings = null;
  }
  for (key in core.defaults) if (Object.prototype.hasOwnProperty.call(core.defaults, key)) raw[key] = savedSettings ? savedSettings[key] : core.defaults[key];
  for (key in parsed.values) if (Object.prototype.hasOwnProperty.call(raw, key)) raw[key] = parsed.values[key];
  try { options = core.settings(raw); }
  catch (error) {
    report(error); notice = "badSettings";
    try { core.settings(parsed.values); }
    catch (invalid) { report(invalid); notice = "badURL"; }
    options = core.settings(core.defaults);
  }
  if (parsed.errors.length) { notice = "badURL"; report(new Error(parsed.errors.join("; "))); }
  var savedPlace = readJSON(PLACE), urlPlace;
  if (savedPlace) {
    if (core.validPlace(savedPlace) && moment.tz.zone(savedPlace.timezone)) place = savedPlace;
    else { notice = "badSettings"; report(new Error("Invalid saved location")); }
  }
  try { urlPlace = core.placeFromQuery(parsed.values); if (urlPlace && moment.tz.zone(urlPlace.timezone)) place = urlPlace; else if (urlPlace) throw new Error("Unsupported time zone"); }
  catch (error) { notice = "badURL"; report(error); }
  if (parsed.values.city && !urlPlace) place = null;
  if (place) loadCache();
  el("weather-city").onclick = openSettings;
  el("close-settings").onclick = closeSettings;
  el("city-search").onsubmit = function (event) {
    if (event && event.preventDefault) event.preventDefault();
    var city = el("city-input").value.replace(/^\s+|\s+$/g, "");
    if (city) searchCity(city); else text("search-status", t("noResults"));
    return false;
  };
  el("display-settings").onsubmit = function (event) {
    if (event && event.preventDefault) event.preventDefault();
    options = core.settings({ language: el("language").value, units: el("units").value,
      orientation: el("orientation").value, lunar: el("show-lunar").checked, almanac: el("show-almanac").checked });
    store(SETTINGS, options); translate(); updateBookmark(); return false;
  };
  el("bookmark").onclick = function () { if (!place) { text("search-status", t("locationRequired")); return false; } return true; };
  el("refresh-weather").onclick = function () { loadWeather(); };
  window.onresize = resize;
  window.onfocus = tick;
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); }, false);
  translate(); updateBookmark(); clean();
  if (place) loadWeather();
  else {
    openSettings();
    if (parsed.values.city) { el("city-input").value = parsed.values.city; searchCity(parsed.values.city); }
  }
  setInterval(tick, 60000);
}());
