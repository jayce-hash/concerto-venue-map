let map;
let venues = [];
let markers = [];
let selectedVenue = null;
let placesService = null;
let topPicksByKey = {};
let currentCategory = "pregame";

// Custom Pins
const NAVY_PIN = { path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z", fillColor: "#121E36", fillOpacity: 1, strokeColor: "#FFFFFF", strokeWeight: 2, scale: 1.4, anchor: { x: 12, y: 22 } };

// Timeline Config
const TIMELINE_CONFIG = {
  pregame: { type: "restaurant", keyword: "drinks dinner", radius: 1500 },
  afterglow: { type: "bar", keyword: "late night food", radius: 2500 },
  recovery: { type: "cafe", keyword: "coffee breakfast", radius: 3000 },
  stay: { type: "lodging", keyword: "boutique hotel", radius: 5000 }
};

// --- MATH & UTILS ---
function makeVenueKey(name, city, state) {
  return (name + "|" + city + "|" + state).toLowerCase();
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getWalkScore(meters) {
  const minutes = Math.round(meters / 80); 
  if (minutes <= 3) return "📍 Steps away";
  if (minutes <= 20) return `🚶 ${minutes} min walk`;
  return `🚗 ${(meters / 1609.34).toFixed(1)} mi`;
}

// --- RENDER TOP PICKS ---
function renderTopPicksInline() {
  if (!selectedVenue) return;
  const key = selectedVenue.key || makeVenueKey(selectedVenue.name, selectedVenue.city, selectedVenue.state);
  const picks = topPicksByKey[key] || [];
  
  const resultsEl = document.getElementById("guideResults");

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
      <h3 class="place-name">${item.name}</h3>
      <p class="place-meta">${walkHTML} ${item.address || ""}</p>
      <p class="place-meta" style="margin-top: 8px;">"${item.notes || ""}"</p>
    `;
    card.addEventListener("click", () => showPlaceDetails(item));
    resultsEl.appendChild(card);
  });
}

// --- RENDER GOOGLE PLACES ---
function loadPlacesForTimeline(catKey) {
  if (!selectedVenue || !placesService) return;
  
  const config = TIMELINE_CONFIG[catKey];
  const request = {
    location: new google.maps.LatLng(selectedVenue.lat, selectedVenue.lng),
    radius: config.radius,
    type: config.type,
    keyword: config.keyword
  };

  const resultsEl = document.getElementById("guideResults");
  resultsEl.innerHTML = '<div style="padding: 20px; color: #5E6B86; font-size: 14px;">Curating the timeline...</div>';

  placesService.nearbySearch(request, (results, status) => {
    resultsEl.innerHTML = "";
    
    // Always show top picks at the top of the "Pre-Game" view
    if (catKey === "pregame") renderTopPicksInline();

    if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
      if (resultsEl.innerHTML === "") {
        resultsEl.innerHTML = '<div style="padding: 20px; color: #5E6B86; font-size: 14px;">No algorithmic results found.</div>';
      }
      return;
    }

    results.slice(0, 15).forEach(place => {
      const card = document.createElement("div");
      card.className = "place-card";

      let walkHTML = "";
      if (place.geometry && place.geometry.location) {
        const meters = distanceMeters(selectedVenue.lat, selectedVenue.lng, place.geometry.location.lat(), place.geometry.location.lng());
        walkHTML = `<span class="walk-badge">${getWalkScore(meters)}</span>`;
      }
      
      const ratingStr = place.rating ? `${Number(place.rating).toFixed(1)}★` : "";
      
      // Inside your renderTopPicksInline() function...

    card.innerHTML = `
      <span class="top-pick-badge">★ Concerto Top Pick</span>
      <h3 class="place-name">${item.name}</h3>
      <p class="place-meta">${walkHTML} ${item.address || ""}</p>
      <p class="place-meta top-pick-notes">"${item.notes || ""}"</p> 
    `;
      card.addEventListener("click", () => showPlaceDetails(place));
      resultsEl.appendChild(card);
    });
  });
}

// --- PLACE DETAILS & NATIVE ROUTING ---
function showPlaceDetails(place) {
  document.getElementById("placeDetails").classList.remove("hidden");
  
  document.getElementById("detailsName").textContent = place.name || "Location";
  const address = place.vicinity || place.formatted_address || place.address || "";
  document.getElementById("detailsAddress").textContent = address;
  
  const metaBits = [];
  if (place.rating) metaBits.push(`${Number(place.rating).toFixed(1)}★`);
  if (place.notes) metaBits.push(`Concerto Curated`); 
  document.getElementById("detailsMeta").textContent = metaBits.join(" • ");

  // The Native Map Routing Fix
  const routeBtn = document.getElementById("detailsMapsLink");
  let destName = place.name || "";
  if (address) destName += " " + address;
  
  // Official Universal Link format. Forces WebViews to hand off to OS maps.
  let mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destName)}`;
  if (place.place_id || place.placeId) {
    mapsUrl += `&query_place_id=${place.place_id || place.placeId}`;
  }
  
  routeBtn.href = mapsUrl;
}

// --- INITIALIZATION ---
window.initMap = function () {
  const mapStyle = [ { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] }, { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] }, { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] }, { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] }, { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] }, { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] } ];

  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 39.5, lng: -98.35 }, zoom: 4, disableDefaultUI: true, styles: mapStyle
  });
  placesService = new google.maps.places.PlacesService(map);

  // Setup Timeline Clicks
  document.querySelectorAll(".timeline-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      document.querySelectorAll(".timeline-pill").forEach(p => p.classList.remove("active"));
      e.target.classList.add("active");
      currentCategory = e.target.dataset.cat;
      loadPlacesForTimeline(currentCategory);
    });
  });

  // Setup Venue Search
  const searchInput = document.getElementById("venueSearch");
  const searchResults = document.getElementById("searchResults");
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = "";
    if (!q) { searchResults.classList.remove("visible"); return; }
    
    const filtered = venues.filter(v => v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q));
    filtered.slice(0, 10).forEach(v => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.textContent = `${v.name} — ${v.city}`;
      item.onclick = () => {
        searchInput.value = v.name;
        searchResults.classList.remove("visible");
        
        // Focus Venue & Open Panel
        selectedVenue = v;
        currentCategory = "pregame";
        document.querySelectorAll(".timeline-pill").forEach(p => p.classList.remove("active"));
        document.querySelector('.timeline-pill[data-cat="pregame"]').classList.add("active");
        
        map.setZoom(14);
        map.panTo({ lat: v.lat, lng: v.lng });
        google.maps.event.addListenerOnce(map, "idle", () => map.panBy(0, 150));
        
        document.getElementById("guideVenueName").textContent = v.name;
        document.getElementById("guideVenueLocation").textContent = `${v.city}, ${v.state}`;
        document.getElementById("guidePanel").classList.remove("hidden");
        
        loadPlacesForTimeline(currentCategory);
      };
      searchResults.appendChild(item);
    });
    searchResults.classList.add("visible");
  });

  // UI Closes
  document.getElementById("closePanelBtn").onclick = () => document.getElementById("guidePanel").classList.add("hidden");
  document.getElementById("placeDetailsClose").onclick = () => document.getElementById("placeDetails").classList.add("hidden");

  // Load Data
  fetch("data/venues.json").then(res => res.json()).then(data => {
    venues = data;
    venues.forEach(v => {
      v.key = makeVenueKey(v.name, v.city, v.state);
      const marker = new google.maps.Marker({ position: { lat: v.lat, lng: v.lng }, map, icon: NAVY_PIN });
      marker.addListener("click", () => { searchInput.value = v.name; searchResults.classList.remove("visible"); document.querySelector('.search-result-item').onclick(); });
    });
    return fetch("data/top_picks.json");
  }).then(res => res.json()).then(tpData => {
    tpData.forEach(entry => topPicksByKey[makeVenueKey(entry.venueName, entry.city, entry.state)] = entry.items);
  }).catch(err => console.error(err));
};
