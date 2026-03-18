let map;
let venues = [];
let markers = [];
let selectedVenue = null;
let placesService = null;
let guidePanelEl = null;
let guideResultsEl = null;
let venueSearchInput = null;
let venueSearchResultsEl = null;
let topPicksByKey = {};

// Current Timeline State
let currentCategory = "pregame";

// Custom Map Pins (Clean & Modern)
const NAVY_PIN_ICON = { path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z", fillColor: "#121E36", fillOpacity: 1, strokeColor: "#FFFFFF", strokeWeight: 1.5, scale: 1.4, anchor: { x: 12, y: 22 } };

// Timeline Config (Strict radii based on event flow)
const TIMELINE_CONFIG = {
  pregame: { type: "restaurant", keyword: "drinks dinner", radius: 1500 }, // 15 min walk max
  afterglow: { type: "bar", keyword: "late night food", radius: 2500 }, // Walk or short Uber
  recovery: { type: "cafe", keyword: "coffee breakfast", radius: 3000 },
  stay: { type: "lodging", keyword: "boutique hotel", radius: 5000 }
};

// --- CORE MATH ---
function makeVenueKey(name, city, state) {
  return (name + "|" + city + "|" + state).toLowerCase();
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// The Walk Score Formula
function getWalkScore(meters) {
  const minutes = Math.round(meters / 80); // ~80m per minute walk speed
  if (minutes <= 3) return "📍 Steps away";
  if (minutes <= 20) return `🚶 ${minutes} min walk`;
  const miles = (meters / 1609.34).toFixed(1);
  return `🚗 ${miles} mi`;
}

// --- TOP PICKS RENDERER ---
function renderTopPicksInline() {
  if (!selectedVenue) return;
  const key = selectedVenue.key || makeVenueKey(selectedVenue.name, selectedVenue.city, selectedVenue.state);
  const picks = topPicksByKey[key] || [];
  
  if (!picks.length) return;

  picks.forEach(item => {
    const card = document.createElement("div");
    card.className = "place-card top-pick-card";

    let walkHTML = "";
    if (item.lat && item.lng) {
      const meters = distanceMeters(selectedVenue.lat, selectedVenue.lng, item.lat, item.lng);
      walkHTML = `<span class="walk-badge">${getWalkScore(meters)}</span>`;
    }

    card.innerHTML = `
      <span class="top-pick-badge">★ Concerto Top Pick</span>
      <p class="place-name">${item.name}</p>
      <p class="place-meta">${walkHTML} ${item.address}</p>
      <p class="place-meta" style="margin-top: 8px;">"${item.notes}"</p>
    `;
    guideResultsEl.appendChild(card);
  });
}

// --- GOOGLE PLACES RENDERER ---
function loadPlacesForTimeline(catKey) {
  if (!selectedVenue || !placesService) return;
  const config = TIMELINE_CONFIG[catKey];
  
  const request = {
    location: new google.maps.LatLng(selectedVenue.lat, selectedVenue.lng),
    radius: config.radius,
    type: config.type,
    keyword: config.keyword
  };

  guideResultsEl.innerHTML = '<div class="hint" style="padding: 20px;">Curating the timeline...</div>';

  placesService.nearbySearch(request, (results, status) => {
    guideResultsEl.innerHTML = "";
    
    // Always render Top Picks first at the top of the timeline
    if (catKey === "pregame") renderTopPicksInline();

    if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
      if (guideResultsEl.innerHTML === "") {
        guideResultsEl.innerHTML = '<div class="hint">No immediate recommendations found.</div>';
      }
      return;
    }

    // Render algorithmic results below Top Picks
    results.slice(0, 15).forEach(place => {
      const card = document.createElement("div");
      card.className = "place-card";

      let walkHTML = "";
      if (place.geometry && place.geometry.location) {
        const meters = distanceMeters(selectedVenue.lat, selectedVenue.lng, place.geometry.location.lat(), place.geometry.location.lng());
        walkHTML = `<span class="walk-badge">${getWalkScore(meters)}</span>`;
      }
      
      const ratingStr = place.rating ? `${Number(place.rating).toFixed(1)}★` : "";
      
      card.innerHTML = `
        <p class="place-name">${place.name}</p>
        <p class="place-meta">${walkHTML} ${ratingStr} • ${place.vicinity}</p>
      `;
      
      card.addEventListener("click", () => showPlaceDetails(place));
      guideResultsEl.appendChild(card);
    });
  });
}

// --- TIMELINE UI SETUP ---
function setupTimelineUI() {
  const pills = document.querySelectorAll(".timeline-pill");
  pills.forEach(pill => {
    pill.addEventListener("click", (e) => {
      // Manage Active State
      pills.forEach(p => p.classList.remove("active"));
      e.target.classList.add("active");
      
      // Load New Data
      currentCategory = e.target.dataset.cat;
      loadPlacesForTimeline(currentCategory);
    });
  });
}

// --- MAP & APP INITIALIZATION ---
function focusVenue(venue) {
  selectedVenue = venue;
  currentCategory = "pregame"; // Reset to start of night
  
  // Reset pills UI visually
  document.querySelectorAll(".timeline-pill").forEach(p => p.classList.remove("active"));
  document.querySelector('.timeline-pill[data-cat="pregame"]').classList.add("active");

  map.setZoom(14);
  map.panTo({ lat: venue.lat, lng: venue.lng });
  
  // Offset map center so the panel doesn't cover the pin
  google.maps.event.addListenerOnce(map, "idle", () => { map.panBy(0, 150); });

  document.getElementById("guideVenueName").textContent = venue.name;
  document.getElementById("guideVenueLocation").textContent = `${venue.city}, ${venue.state}`;
  guidePanelEl.classList.remove("guide-panel--hidden");

  loadPlacesForTimeline(currentCategory);
}

function setupVenueSearch() {
  venueSearchInput = document.getElementById("venueSearch");
  venueSearchResultsEl = document.getElementById("searchResults");
  
  venueSearchInput.addEventListener("input", () => {
    const q = venueSearchInput.value.trim().toLowerCase();
    venueSearchResultsEl.innerHTML = "";
    if (!q) { venueSearchResultsEl.classList.remove("visible"); return; }
    
    const filtered = venues.filter(v => v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q));
    
    filtered.slice(0, 10).forEach(v => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.textContent = `${v.name} — ${v.city}`;
      item.addEventListener("click", () => {
        venueSearchInput.value = v.name;
        venueSearchResultsEl.classList.remove("visible");
        focusVenue(v);
      });
      venueSearchResultsEl.appendChild(item);
    });
    venueSearchResultsEl.classList.add("visible");
  });
}

window.initMap = function () {
  // Ultra-clean grayscale map style
  const mapStyle = [ { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] }, { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] }, { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] }, { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] }, { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] }, { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] }, { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] }, { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] }, { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] }, { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] }, { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] }, { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] } ];

  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 39.5, lng: -98.35 },
    zoom: 4,
    disableDefaultUI: true,
    styles: mapStyle
  });

  placesService = new google.maps.places.PlacesService(map);
  guidePanelEl = document.getElementById("guidePanel");
  guideResultsEl = document.getElementById("guideResults");
  
  document.getElementById("backToMapBtn").addEventListener("click", () => {
    guidePanelEl.classList.add("guide-panel--hidden");
    map.setZoom(4);
    venueSearchInput.value = "";
  });

  setupVenueSearch();
  setupTimelineUI();

  // Load Data
  fetch("data/venues.json").then(res => res.json()).then(data => {
    venues = data;
    venues.forEach(v => {
      v.key = makeVenueKey(v.name, v.city, v.state);
      const marker = new google.maps.Marker({ position: { lat: v.lat, lng: v.lng }, map, icon: NAVY_PIN_ICON });
      marker.addListener("click", () => focusVenue(v));
      markers.push({ venueId: v.id, marker });
    });
    return fetch("data/top_picks.json");
  }).then(res => res.json()).then(tpData => {
    tpData.forEach(entry => {
      const key = makeVenueKey(entry.venueName, entry.city, entry.state);
      topPicksByKey[key] = entry.items;
    });
  }).catch(err => console.error("Error loading data:", err));
};

// Quick Place Details Stub (Expand if needed based on your old logic)
function showPlaceDetails(place) {
  document.getElementById("placeDetails").hidden = false;
  document.getElementById("detailsName").textContent = place.name;
  document.getElementById("detailsAddress").textContent = place.vicinity || place.formatted_address || "";
  document.getElementById("placeDetailsClose").onclick = () => document.getElementById("placeDetails").hidden = true;
}
