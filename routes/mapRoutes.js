const express = require("express");
const { searchPlaces, reverseGeocode, getRoute } = require("../services/stadiaMaps");

const router = express.Router();
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isCoordinate = value => Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180;

router.get("/search", asyncRoute(async (req, res) => {
  const query = String(req.query.q || "").trim().slice(0, 200);
  if (query.length < 2) return res.status(400).json({ error: "Enter at least 2 characters to search." });
  res.set("Cache-Control", "private, max-age=60");
  res.json({ results: await searchPlaces(query) });
}));

router.get("/reverse", asyncRoute(async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !isCoordinate(lon)) {
    return res.status(400).json({ error: "Provide valid latitude and longitude." });
  }
  res.set("Cache-Control", "private, max-age=60");
  res.json({ result: await reverseGeocode(lat, lon) });
}));

router.post("/route", asyncRoute(async (req, res) => {
  const locations = req.body.locations;
  if (!Array.isArray(locations) || locations.length < 2 || locations.length > 10) {
    return res.status(400).json({ error: "Provide between 2 and 10 route locations." });
  }
  const valid = locations.every(point =>
    point && Number.isFinite(Number(point.lat)) &&
    Number(point.lat) >= -90 && Number(point.lat) <= 90 &&
    isCoordinate(point.lon)
  );
  if (!valid) return res.status(400).json({ error: "Every route point needs valid latitude and longitude." });
  const normalized = locations.map(point => ({ lat: Number(point.lat), lon: Number(point.lon) }));
  const costing = String(req.body.costing || "auto").toLowerCase();
  res.json({ route: await getRoute(normalized, costing) });
}));

module.exports = router;
