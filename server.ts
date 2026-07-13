import express from "express";
import path from "path";
import fs from "fs";
import dns from "dns";
import https from "https";
const { Solar } = require("lunar-javascript");

dns.setDefaultResultOrder("ipv4first");

const app = express();
const root = process.cwd();
const places = new Map<string, { latitude: number; longitude: number; name: string }>();
const cache = new Map<string, { expires: number; data: unknown }>();
type Fortune = { sign: string; all: string; work: string; money: string; love: string; health: string; luck: string; date: string; source: string };
const fortuneFile = path.join(root, "data", "constellation.json");
let constellationCache: { sign: string; date: string; data: Fortune } | undefined;
try { constellationCache = JSON.parse(fs.readFileSync(fortuneFile, "utf8")); } catch {}

function saveConstellation(value: { sign: string; date: string; data: Fortune }) {
  fs.mkdirSync(path.dirname(fortuneFile), { recursive: true });
  fs.writeFileSync(fortuneFile, JSON.stringify(value));
}

function condition(code: number) {
  if (code === 0) return "晴";
  if (code <= 3) return "多云";
  if (code <= 48) return "雾";
  if (code <= 67) return "雨";
  if (code <= 77) return "雪";
  if (code <= 82) return "阵雨";
  if (code <= 86) return "阵雪";
  return "雷阵雨";
}

function windDirection(degrees: number) {
  return ["北", "东北", "东", "东南", "南", "西南", "西", "西北"][Math.round(degrees / 45) % 8];
}

function windLevel(kmh: number) {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62];
  let level = 0;
  while (level < limits.length && kmh >= limits[level]) level++;
  return level + "级";
}

function airQuality(aqi: number) {
  if (aqi <= 50) return "优";
  if (aqi <= 100) return "良";
  if (aqi <= 150) return "轻度污染";
  if (aqi <= 200) return "中度污染";
  return "重度污染";
}

function fortuneLevel(score: unknown) {
  const value = Number(score);
  if (value >= 85) return "极佳";
  if (value >= 70) return "较佳";
  if (value >= 55) return "平稳";
  if (value >= 40) return "留意";
  return "谨慎";
}

async function constellation(date: string): Promise<Fortune> {
  const sign = process.env.CONSTELLATION || "水瓶座";
  const saved = constellationCache?.sign === sign ? constellationCache : undefined;
  if (saved?.date === date) return saved.data;
  const fallback: Fortune = { sign, all: "较佳", work: "平稳", money: "有利", love: "顺遂", health: "良好", luck: "蓝 · 7", date, source: "默认" };
  const key = process.env.JUHE_CONSTELLATION_KEY;
  if (!key) return saved?.data || fallback;
  try {
    const data = await json(`https://web.juhe.cn/constellation/getAll?key=${encodeURIComponent(key)}&consName=${encodeURIComponent(sign)}&type=today`);
    if (Number(data.error_code || 0) !== 0) throw new Error(`constellation ${data.error_code}: ${data.reason || "unknown error"}`);
    const result: Fortune = {
      sign: data.name || sign, all: fortuneLevel(data.all), work: fortuneLevel(data.work), money: fortuneLevel(data.money),
      love: fortuneLevel(data.love), health: fortuneLevel(data.health), luck: `${String(data.color || "--").replace(/色$/, "")} · ${data.number ?? "--"}`,
      date: data.datetime || date, source: "聚合数据"
    };
    constellationCache = { sign, date, data: result };
    saveConstellation(constellationCache);
    return result;
  } catch (error) {
    console.error("constellation unavailable", error);
    return saved?.data || fallback;
  }
}

function almanac(date: Date) {
  const lunar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
  return {
    lunar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    suitable: lunar.getDayYi().slice(0, 5),
    avoid: lunar.getDayJi().slice(0, 5),
    clash: `冲${lunar.getDayChongDesc()} 煞${lunar.getDaySha()}`,
    fiveElements: lunar.getDayNaYin()
  };
}

function dressing(high: number, low: number, rain: number) {
  const clothes = high >= 30 ? "轻薄透气短袖" : high >= 22 ? "短袖或薄外套" : high >= 14 ? "长袖和薄外套" : "保暖外套";
  return `明日 ${low}–${high}°C，建议穿${clothes}${rain >= 40 ? "，并随身携带雨具" : ""}。`;
}

function json(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { family: 4, timeout: 8000 }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => body += chunk);
      response.on("end", () => response.statusCode && response.statusCode < 400 ? resolve(JSON.parse(body)) : reject(new Error(`upstream ${response.statusCode}`)));
    });
    request.on("timeout", () => request.destroy(new Error("upstream timeout")));
    request.on("error", reject);
  });
}

async function locate(city: string) {
  if (places.has(city)) return places.get(city)!;
  const data = await json(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`);
  if (!data.results?.length) throw new Error("city not found");
  const place = { latitude: data.results[0].latitude, longitude: data.results[0].longitude, name: data.results[0].name };
  places.set(city, place);
  return place;
}

async function display(city: string, date: string) {
  const place = await locate(city);
  const key = `${place.latitude},${place.longitude},${date}`;
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.data;
  const coordinates = `latitude=${place.latitude}&longitude=${place.longitude}`;
  const [weather, air, fortune] = await Promise.all([
    json(`https://api.open-meteo.com/v1/forecast?${coordinates}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=6`),
    json(`https://air-quality-api.open-meteo.com/v1/air-quality?${coordinates}&current=us_aqi&timezone=auto`),
    constellation(date)
  ]);
  const currentHour = weather.current.time.slice(0, 13);
  const start = Math.max(0, weather.hourly.time.findIndex((time: string) => time.slice(0, 13) >= currentHour));
  const hourly = [0, 3, 6, 9].map(offset => {
    const i = Math.min(start + offset, weather.hourly.time.length - 1);
    return { time: weather.hourly.time[i].slice(11, 16), temperature: Math.round(weather.hourly.temperature_2m[i]), condition: condition(weather.hourly.weather_code[i]) };
  });
  const forecast = weather.daily.time.slice(1).map((day: string, i: number) => ({
    date: day,
    weekday: new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: weather.timezone }).format(new Date(day + "T12:00:00")),
    condition: condition(weather.daily.weather_code[i + 1]),
    high: Math.round(weather.daily.temperature_2m_max[i + 1]),
    low: Math.round(weather.daily.temperature_2m_min[i + 1]),
    rain: weather.daily.precipitation_probability_max[i + 1]
  }));
  const localDate = new Date(date + "T12:00:00+08:00");
  const calendar = almanac(localDate);
  const aqi = Math.round(air.current.us_aqi);
  const updated = new Date();
  const result = {
    location: { name: place.name, timezone: weather.timezone },
    date: { gregorian: date, weekday: new Intl.DateTimeFormat("zh-CN", { weekday: "long", timeZone: "Asia/Shanghai" }).format(localDate), lunar: "农历" + calendar.lunar, solarTerm: "" },
    weather: {
      condition: condition(weather.current.weather_code), temperature: Math.round(weather.current.temperature_2m), feelsLike: Math.round(weather.current.apparent_temperature),
      high: Math.round(weather.daily.temperature_2m_max[0]), low: Math.round(weather.daily.temperature_2m_min[0]), humidity: weather.current.relative_humidity_2m,
      windDirection: windDirection(weather.current.wind_direction_10m), windLevel: windLevel(weather.current.wind_speed_10m), airQuality: airQuality(aqi), aqi,
      uvIndex: String(Math.round(weather.daily.uv_index_max[0])), precipitation: weather.daily.precipitation_probability_max[0] + "%"
    },
    hourly, forecast,
    almanac: { suitable: calendar.suitable, avoid: calendar.avoid }, fortune,
    dressing: dressing(forecast[0].high, forecast[0].low, forecast[0].rain),
    updatedAt: updated.toISOString(), source: "Open-Meteo"
  };
  cache.set(key, { expires: Date.now() + 29 * 60_000, data: result });
  return result;
}

app.use(express.static(root));
app.get("/api/display", async (req, res) => {
  try {
    const city = String(req.query.city || "南京");
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    res.json(await display(city, date));
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: "实时数据暂不可用" });
  }
});
app.get("*", (_req, res) => res.sendFile(path.join(root, "index.html")));
const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => console.log(`Kindle display: http://localhost:${port}`));
