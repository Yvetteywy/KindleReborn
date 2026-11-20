(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KindleCore = factory();
}(this, function () {
  "use strict";
  var defaults = { language: "en", units: "us", orientation: "portrait", lunar: false, almanac: false };
  var conditions = {
    en: ["Clear", "Partly cloudy", "Fog", "Rain", "Snow", "Rain showers", "Snow showers", "Thunderstorm", "Unknown"],
    zh: ["晴", "多云", "雾", "雨", "雪", "阵雨", "阵雪", "雷阵雨", "未知"]
  };
  function number(value) { return typeof value === "number" && isFinite(value); }
  function pad(value) { return ("0" + value).slice(-2); }
  function dateKey(parts) { return parts.year + "-" + pad(parts.month) + "-" + pad(parts.day); }
  function settings(input) {
    input = input || {};
    if (typeof input !== "object" || array(input)) throw new Error("Invalid display settings");
    var allowed = { language: ["en", "zh"], units: ["us", "metric"], orientation: ["portrait", "landscape"],
      lunar: [true, false, "0", "1"], almanac: [true, false, "0", "1"] }, key, i, valid;
    for (key in allowed) {
      if (!Object.prototype.hasOwnProperty.call(allowed, key) || input[key] === undefined) continue;
      valid = false;
      for (i = 0; i < allowed[key].length; i++) if (input[key] === allowed[key][i]) valid = true;
      if (!valid) throw new Error("Invalid setting: " + key);
    }
    return {
      language: input.language === "zh" ? "zh" : "en",
      units: input.units === "metric" ? "metric" : "us",
      orientation: input.orientation === "landscape" ? "landscape" : "portrait",
      lunar: input.lunar === true || input.lunar === "1",
      almanac: input.almanac === true || input.almanac === "1"
    };
  }
  function query(search) {
    var result = {}, errors = [], pairs = search.replace(/^\?/, "").split("&"), i, pair, key, value;
    for (i = 0; i < pairs.length; i++) {
      if (!pairs[i]) continue;
      pair = pairs[i].split("=");
      try {
        key = decodeURIComponent(pair[0]);
        value = decodeURIComponent(pair.slice(1).join("=").replace(/\+/g, " "));
        if (/^(city|language|units|orientation|lunar|almanac|latitude|longitude|timezone|name|country|region)$/.test(key)) result[key] = value;
      } catch (error) { errors.push("Invalid URL setting: " + pair[0]); }
    }
    return { values: result, errors: errors };
  }
  function validPlace(place) {
    return !!place && typeof place.name === "string" && place.name.length > 0 &&
      number(place.latitude) && Math.abs(place.latitude) <= 90 &&
      number(place.longitude) && Math.abs(place.longitude) <= 180 &&
      typeof place.timezone === "string" && place.timezone.length > 0;
  }
  function placeFromQuery(values) {
    if (values.latitude === undefined && values.longitude === undefined) return null;
    if (!values.latitude || !values.longitude) throw new Error("Both latitude and longitude are required");
    var place = {
      name: values.name || values.city || "Location",
      latitude: Number(values.latitude), longitude: Number(values.longitude),
      timezone: values.timezone || "", country: values.country || "", region: values.region || ""
    };
    if (!validPlace(place)) throw new Error("Invalid location URL settings");
    return place;
  }
  function places(response) {
    if (!response || typeof response !== "object" || response.error) throw new Error("Invalid geocoding response");
    if (response.results === undefined) return [];
    if (Object.prototype.toString.call(response.results) !== "[object Array]") throw new Error("Invalid geocoding results");
    var result = [], i, source, place;
    for (i = 0; i < response.results.length; i++) {
      source = response.results[i];
      place = { name: source.name, latitude: source.latitude, longitude: source.longitude,
        timezone: source.timezone, country: source.country || "", region: source.admin1 || "" };
      if (!validPlace(place)) throw new Error("Invalid geocoding location");
      result.push(place);
    }
    return result;
  }
  function placeKey(place) { return place.latitude + "," + place.longitude + "," + place.timezone; }
  function localParts(timestamp, timezone, moment) {
    if (!moment.tz.zone(timezone)) throw new Error("Unsupported time zone: " + timezone);
    var local = moment.tz(timestamp, timezone);
    return { year: local.year(), month: local.month() + 1, day: local.date(), weekday: local.day(),
      hour: local.hour(), minute: local.minute(), offset: local.utcOffset() };
  }
  function weatherSlot(timestamp, timezone, moment) {
    var parts = localParts(timestamp, timezone, moment), slot = Math.floor((parts.hour * 60 + parts.minute - 10) / 180);
    if (slot < 0) {
      var previous = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - 1));
      parts.year = previous.getUTCFullYear(); parts.month = previous.getUTCMonth() + 1; parts.day = previous.getUTCDate(); slot = 7;
    }
    return dateKey(parts) + ":" + slot + ":" + parts.offset;
  }
  function conditionIndex(code) {
    if (!number(code)) return 8;
    if (code === 0) return 0;
    if (code >= 1 && code <= 3) return 1;
    if (code === 45 || code === 48) return 2;
    if (code >= 51 && code <= 67) return 3;
    if (code >= 71 && code <= 77) return 4;
    if (code >= 80 && code <= 82) return 5;
    if (code === 85 || code === 86) return 6;
    if (code === 95 || code === 96 || code === 99) return 7;
    return 8;
  }
  function condition(code, language) { return conditions[language][conditionIndex(code)]; }
  function icon(code) {
    return ["sun", "cloud", "cloud", "rain", "snow", "rain", "snow", "thunder", "cloud"][conditionIndex(code)];
  }
  function temperature(value, units) { return number(value) ? Math.round(units === "us" ? value * 9 / 5 + 32 : value) : null; }
  function wind(value, units) { return number(value) ? Math.round(units === "us" ? value / 1.609344 : value) : null; }
  function direction(value, language) {
    if (!number(value)) return "--";
    return (language === "zh" ? ["北", "东北", "东", "东南", "南", "西南", "西", "西北"] :
      ["N", "NE", "E", "SE", "S", "SW", "W", "NW"])[Math.round(((value % 360) + 360) % 360 / 45) % 8];
  }
  function airLabel(value, language) {
    if (!number(value)) return "--";
    var index = value <= 50 ? 0 : value <= 100 ? 1 : value <= 150 ? 2 : value <= 200 ? 3 : value <= 300 ? 4 : 5;
    return (language === "zh" ? ["优", "良", "敏感人群不健康", "不健康", "非常不健康", "危险"] :
      ["Good", "Moderate", "Sensitive groups", "Unhealthy", "Very unhealthy", "Hazardous"])[index];
  }
  function array(value) { return Object.prototype.toString.call(value) === "[object Array]"; }
  function normalize(weather, place, fetchedAt) {
    if (!validPlace(place) || !weather || weather.error || !weather.current || !weather.hourly || !weather.daily) throw new Error("Invalid weather response");
    var current = weather.current, hourly = weather.hourly, daily = weather.daily;
    if (!number(current.time) || !number(current.temperature_2m) || !number(current.weather_code) ||
      !array(hourly.time) || !hourly.time.length || !array(hourly.temperature_2m) || !array(hourly.weather_code) ||
      !array(daily.time) || daily.time.length < 2) throw new Error("Incomplete weather response");
    var result = { place: place, fetchedAt: fetchedAt, current: {
      time: current.time * 1000, temperature: current.temperature_2m, feelsLike: current.apparent_temperature,
      code: current.weather_code, humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m, windDirection: current.wind_direction_10m
    }, hourly: [], daily: [] }, i, start = 0, offset, fields;
    for (i = 0; i < hourly.time.length; i++) {
      if (hourly.time[i] <= current.time) start = i;
      else break;
    }
    for (offset = 0; offset < 12; offset += 3) {
      i = start + offset;
      if (i >= hourly.time.length) break;
      if (!number(hourly.time[i]) || !number(hourly.temperature_2m[i]) || !number(hourly.weather_code[i])) throw new Error("Incomplete hourly weather");
      result.hourly.push({ time: hourly.time[i] * 1000, temperature: hourly.temperature_2m[i], code: hourly.weather_code[i] });
    }
    fields = ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_probability_max", "uv_index_max"];
    for (i = 0; i < fields.length; i++) {
      if (!array(daily[fields[i]]) || daily[fields[i]].length !== daily.time.length) throw new Error("Incomplete daily weather");
    }
    for (i = 0; i < daily.time.length; i++) {
      if (!number(daily.time[i]) || !number(daily.weather_code[i]) ||
        !number(daily.temperature_2m_max[i]) || !number(daily.temperature_2m_min[i])) throw new Error("Invalid daily weather");
      result.daily.push({ time: daily.time[i] * 1000, code: daily.weather_code[i],
        high: daily.temperature_2m_max[i], low: daily.temperature_2m_min[i],
        rain: daily.precipitation_probability_max[i], uv: daily.uv_index_max[i] });
    }
    return result;
  }
  function dailyFor(data, date, moment) {
    var i;
    for (i = 0; i < data.daily.length; i++) {
      if (dateKey(localParts(data.daily[i].time, data.place.timezone, moment)) === date) return data.daily[i];
    }
    return null;
  }
  function validCache(value, place) {
    if (!value || value.version !== 1 || !value.data || !validPlace(value.data.place) ||
      placeKey(value.data.place) !== placeKey(place) || !number(value.data.fetchedAt) ||
      !value.data.current || !number(value.data.current.time) || !number(value.data.current.code) ||
      !number(value.data.current.temperature) || !array(value.data.hourly) ||
      !array(value.data.daily) || value.data.daily.length < 2) return false;
    var i, item;
    for (i = 0; i < value.data.daily.length; i++) {
      item = value.data.daily[i];
      if (!item || !number(item.time) || !number(item.high) || !number(item.low) || !number(item.code)) return false;
    }
    for (i = 0; i < value.data.hourly.length; i++) {
      item = value.data.hourly[i];
      if (!item || !number(item.time) || !number(item.temperature) || !number(item.code)) return false;
    }
    return true;
  }
  function advice(day, language) {
    if (!day) return language === "zh" ? "暂无明日预报" : "Tomorrow's forecast unavailable";
    var level = day.high >= 30 ? 0 : day.high >= 22 ? 1 : day.high >= 14 ? 2 : 3;
    var value = (language === "zh" ? ["轻薄透气短袖", "短袖或薄外套", "长袖和薄外套", "保暖外套"] :
      ["Light, breathable clothing", "Short sleeves or a light jacket", "Long sleeves and a light jacket", "A warm coat"])[level];
    return value + (number(day.rain) && day.rain >= 40 ? (language === "zh" ? "，带上雨具。" : "; take an umbrella.") : (language === "zh" ? "。" : "."));
  }
  function bookmark(place, options) {
    var pairs = [], key, values = { latitude: place.latitude, longitude: place.longitude,
      timezone: place.timezone, name: place.name, country: place.country || "", region: place.region || "",
      language: options.language, units: options.units, orientation: options.orientation,
      lunar: options.lunar ? "1" : "0", almanac: options.almanac ? "1" : "0" };
    for (key in values) if (Object.prototype.hasOwnProperty.call(values, key)) pairs.push(key + "=" + encodeURIComponent(values[key]));
    return "?" + pairs.join("&");
  }
  return { defaults: defaults, number: number, pad: pad, dateKey: dateKey, settings: settings, query: query,
    validPlace: validPlace, placeFromQuery: placeFromQuery, places: places, placeKey: placeKey,
    localParts: localParts, weatherSlot: weatherSlot, condition: condition, icon: icon,
    temperature: temperature, wind: wind, direction: direction, airLabel: airLabel,
    normalize: normalize, dailyFor: dailyFor, validCache: validCache, advice: advice, bookmark: bookmark };
}));
