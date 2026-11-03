const STADIA_BASE_URL = "https://api.stadiamaps.com";

function getApiKey() {
  const key = process.env.STADIA_MAPS_API_KEY;
  if (!key) {
    const error = new Error("Map service is not configured. Set STADIA_MAPS_API_KEY.");
    error.status = 503;
    throw error;
  }
  return key;
}

async function stadiaRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Stadia-Auth ${getApiKey()}`,
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      response.status === 429
        ? "Map service usage limit reached. Please try again later."
        : "Map provider request failed."
    );
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  return payload;
}

async function searchPlaces(query) {
  const url = new URL("/geocoding/v1/search", STADIA_BASE_URL);
  url.searchParams.set("text", query);
  url.searchParams.set("boundary.country", "IND");
  url.searchParams.set("size", "6");
  const data = await stadiaRequest(url);
  return (data.features || []).map(feature => ({
    id: feature.properties?.gid || feature.properties?.id || null,
    label: feature.properties?.label || feature.properties?.name || "Selected location",
    name: feature.properties?.name || "",
    coordinates: feature.geometry?.coordinates || null,
    confidence: feature.properties?.confidence ?? null,
    layer: feature.properties?.layer || null
  })).filter(place => Array.isArray(place.coordinates) && place.coordinates.length >= 2);
}

async function reverseGeocode(lat, lon) {
  const url = new URL("/geocoding/v2/reverse", STADIA_BASE_URL);
  url.searchParams.set("point.lat", String(lat));
  url.searchParams.set("point.lon", String(lon));
  url.searchParams.set("boundary.country", "IND");
  const data = await stadiaRequest(url);
  const feature = data.features?.[0];
  if (!feature) return null;
  return {
    id: feature.properties?.gid || null,
    label: feature.properties?.label || feature.properties?.name || "",
    name: feature.properties?.name || "",
    coordinates: feature.geometry?.coordinates || [lon, lat],
    properties: feature.properties || {}
  };
}

async function getRoute(locations, costing = "auto") {
  const url = new URL("/route/v1", STADIA_BASE_URL);
  const allowedCostings = new Set(["auto", "bicycle", "pedestrian", "motorcycle"]);
  const safeCosting = allowedCostings.has(costing) ? costing : "auto";
  return stadiaRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: locations.map(point => ({ lat: point.lat, lon: point.lon, type: "break" })),
      costing: safeCosting,
      units: "kilometers"
    })
  });
}

module.exports = { searchPlaces, reverseGeocode, getRoute };
