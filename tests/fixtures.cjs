function weather() {
  const start = Date.UTC(2026, 10, 20, 5) / 1000;
  return {
    current: { time: start + 12 * 3600, temperature_2m: 10, apparent_temperature: 7,
      weather_code: 3, relative_humidity_2m: 70, wind_speed_10m: 16.09344, wind_direction_10m: 270 },
    hourly: {
      time: Array.from({ length: 48 }, (_, i) => start + i * 3600),
      temperature_2m: Array(48).fill(10),
      weather_code: Array(48).fill(3)
    },
    daily: {
      time: [start, start + 86400, start + 172800],
      weather_code: [3, 61, 0],
      temperature_2m_max: [12, 14, 16],
      temperature_2m_min: [4, 5, 6],
      precipitation_probability_max: [30, 50, 0],
      uv_index_max: [2, 3, 2]
    }
  };
}
const boston = { name: "Boston", region: "Massachusetts", country: "United States",
  latitude: 42.36, longitude: -71.06, timezone: "America/New_York" };
module.exports = { weather, boston };
