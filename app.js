// --- STATE & CONFIG ---
let map;
let placesService = null;
let venues = [];
let venueMapboxMarkers = [];
let currentPlaceMarkers = []; // Temporary markers for recommendations
let selectedVenue = null;
let topPicksByKey = {};
let currentCategory = "pregame";

const TIMELINE_CONFIG = {
  pregame: { type: "restaurant", radius: 1500 },
  quickbites: { keyword: "pizza casual", radius: 1500 },
  afterglow: { type: "bar", radius: 2500 },
  recovery: { type: "cafe", radius: 3000 },
  stay: { type: "lodging", radius: 5000 }
};

function makeVenueKey(name, city, state) { return (name + "|" + city + "|" + state).toLowerCase(); }

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = x => (x * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) * Math.sin(toRad(lat2 - lat1) / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) * Math.sin(toRad(lng2 - lng1) / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getWalkScore(meters) {
  const minutes = Math.round(meters / 80); 
  if (minutes <= 3) return "📍 Steps away";
  if (minutes <= 20) return `🚶 ${minutes} min walk`;
  return `🚗 ${(meters / 1609.34).toFixed(1)} mi`;
}

// --- INITIALIZE HEADLESS GOOGLE PLACES ---
// This runs automatically when the Google Script tag finishes loading in HTML
window.initGoogleAPI = function() {
  const dummyDiv = document.getElementById("googlePlacesBrain");
  placesService = new google.maps.places.PlacesService(dummyDiv);
};

// --- INITIALIZE MAPBOX ENGINE ---
mapboxgl.accessToken = 'pk.eyJ1Ijoiandjb25jZXJ0byIsImEiOiJjbW13aXhkNTkycnRiMnBwdGVpb3drd2E2In0.FnB70e0jozY5t1LBu_DRjw';

map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11', // Clean aesthetic to match your UI
  center: [-98.35, 39.5], // USA Center [lng, lat]
  zoom: 3.5,
  pitch: 0, 
  antialias: true
});

// Add 3D Buildings Layer
map.on('style.load', () => {
  map.addLayer({
    'id': '3d-buildings',
    'source': 'composite',
    'source-layer': 'building',
    'filter': ['==', 'extrude', 'true'],
    'type': 'fill-extrusion',
    'minzoom': 14,
    'paint': {
      'fill-extrusion-color': '#E2E8F0', // Sleek silver buildings
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-opacity': 0.8
    }
  });
  
  loadData();
});

// --- DATA LOADING & MARKERS ---
function loadData() {
  fetch("data/venues.json").then(res => res.json()).then(data => {
    venues = data;
    venues.forEach(v => {
      v.key = makeVenueKey(v.name, v.city, v.state);
      
      // Create Custom Mapbox HTML Marker
      const el = document.createElement('div');
      el.className = 'venue-marker';
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([v.lng, v.lat])
        .addTo(map);
        
      el.addEventListener('click', () => {
        document.getElementById("venueSearch").value = v.name;
        triggerVenueSelection(v);
      });
      
      venueMapboxMarkers.push(marker);
    });
    
    return fetch("data/top_picks.json");
  }).then(res => res.json()).then(tpData => {
    tpData.forEach(entry => topPicksByKey[makeVenueKey(entry.venueName, entry.city, entry.state)] = entry.items);
  }).catch(err => console.error("Data load error:", err));
}

function clearPlaceMarkers() {
  currentPlaceMarkers.forEach(m => m.remove());
  currentPlaceMarkers = [];
}

// --- VENUE SELECTION (THE 3D FLYOVER) ---
function triggerVenueSelection(v) {
  selectedVenue = v;
  
  // Cinematic Flyover! Tilts the camera 60 degrees.
  map.flyTo({
    center: [v.lng, v.lat],
    zoom: 15.5,
    pitch: 60, 
    bearing: 20, 
    duration: 2500,
    padding: { bottom: 300 } // Offsets center so bottom sheet doesn't cover it
  });

  const key = v.key || makeVenueKey(v.name, v.city, v.state);
  const hasTopPicks = topPicksByKey[key] && topPicksByKey[key].length > 0;
  
  // UI Resets
  document.querySelectorAll(".timeline-pill").forEach(p => p.classList.remove("active"));
  const tpPill = document.getElementById("pill-toppicks");
  
  if (hasTopPicks) {
    tpPill.classList.remove("hidden-pill");
    currentCategory = "toppicks";
    tpPill.classList.add("active");
  } else {
    tpPill.classList.add("hidden-pill");
    currentCategory = "pregame";
    document.getElementById("pill-pregame").classList.add("active");
  }
  
  document.getElementById("guideVenueName").textContent = v.name;
  document.getElementById("guideVenueLocation").textContent = `${v.city}, ${v.state}`;
  document.getElementById("guidePanel").classList.remove("hidden");
  document.querySelector(".timeline-scroller").scrollLeft = 0;
  
  loadPlacesForTimeline(currentCategory);
}

// --- RENDER TIMELINE LIST & DROP PINS ---
function loadPlacesForTimeline(catKey) {
  const resultsEl = document.getElementById("guideResults");
  resultsEl.innerHTML = '<div style="padding: 20px; color: #5E6B86; font-size: 14px;">Curating the timeline...</div>';
  clearPlaceMarkers(); // Remove old gold dots

  if (catKey === "toppicks") {
    resultsEl.innerHTML = "";
    const picks = topPicksByKey[selectedVenue.key] || [];
    
    picks.forEach(item => {
      const card = document.createElement("div");
      card.className = "place-card top-pick-card";
      let walkHTML = "";
      
      if (item.lat && item.lng) {
        walkHTML = `<span class="walk-badge">${getWalkScore(distanceMeters(selectedVenue.lat, selectedVenue.lng, item.lat, item.lng))}</span>`;
        
        // Drop Gold Mapbox Pin
        const el = document.createElement('div');
        el.className = 'place-marker';
        const m = new mapboxgl.Marker(el).setLngLat([item.lng, item.lat]).addTo(map);
        currentPlaceMarkers.push(m);
      }

      card.innerHTML = `
        <span class="top-pick-badge">★ Concerto Top Pick</span>
        <h3 class="place-name">${item.name}</h3>
        <p class="place-meta">${walkHTML} ${item.address || ""}</p>
        <p class="place-meta top-pick-notes">"${item.notes || ""}"</p>
      `;
      card.addEventListener("click", () => showPlaceDetails(item));
      resultsEl.appendChild(card);
    });
    return;
  }

  // Use Headless Google Places for standard categories
  if (!placesService) return;
  const config = TIMELINE_CONFIG[catKey];
  
  placesService.nearbySearch({
    location: new google.maps.LatLng(selectedVenue.lat, selectedVenue.lng),
    radius: config.radius,
    type: config.type,
    keyword: config.keyword
  }, (results, status) => {
    resultsEl.innerHTML = "";
    if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
      resultsEl.innerHTML = '<div style="padding: 20px; color: #5E6B86; font-size: 14px;">No immediate recommendations found.</div>';
      return;
    }

    results.slice(0, 15).forEach(place => {
      const card = document.createElement("div");
      card.className = "place-card";

      let walkHTML = "";
      if (place.geometry && place.geometry.location) {
        const plat = place.geometry.location.lat();
        const plng = place.geometry.location.lng();
        walkHTML = `<span class="walk-badge">${getWalkScore(distanceMeters(selectedVenue.lat, selectedVenue.lng, plat, plng))}</span>`;
        
        // Drop Gold Mapbox Pin
        const el = document.createElement('div');
        el.className = 'place-marker';
        const m = new mapboxgl.Marker(el).setLngLat([plng, plat]).addTo(map);
        currentPlaceMarkers.push(m);
      }
      
      const ratingStr = place.rating ? `${Number(place.rating).toFixed(1)}★` : "";
      card.innerHTML = `
        <h3 class="place-name">${place.name}</h3>
        <p class="place-meta">${walkHTML} ${ratingStr} • ${place.vicinity}</p>
      `;
      card.addEventListener("click", () => showPlaceDetails(place));
      resultsEl.appendChild(card);
    });
  });
}

// --- DETAILS & ROUTING ---
function showPlaceDetails(place) {
  document.getElementById("placeDetails").classList.remove("hidden");
  document.getElementById("detailsName").textContent = place.name || "Location";
  
  const address = place.vicinity || place.formatted_address || place.address || "";
  document.getElementById("detailsAddress").textContent = address;
  
  const metaBits = [];
  if (place.rating) metaBits.push(`${Number(place.rating).toFixed(1)}★`);
  if (place.notes) metaBits.push(`Concerto Curated`); 
  document.getElementById("detailsMeta").textContent = metaBits.join(" • ");

  const routeBtn = document.getElementById("detailsMapsLink");
  let destName = place.name || "";
  if (address) destName += " " + address;
  
  let mapsUrl = `https://www.google.com/maps/search/?api=1&query=?q=${encodeURIComponent(destName)}`;
  if (place.place_id || place.placeId) mapsUrl += `&query_place_id=${place.place_id || place.placeId}`;
  
  routeBtn.href = mapsUrl;
}

// --- EVENT LISTENERS ---
document.getElementById("closePanelBtn").onclick = () => {
  document.getElementById("guidePanel").classList.add("hidden");
  clearPlaceMarkers();
  map.flyTo({ pitch: 0, zoom: 4 }); // Fly back up
};

document.getElementById("placeDetailsClose").onclick = () => document.getElementById("placeDetails").classList.add("hidden");

document.querySelectorAll(".timeline-pill").forEach(pill => {
  pill.addEventListener("click", (e) => {
    document.querySelectorAll(".timeline-pill").forEach(p => p.classList.remove("active"));
    e.target.classList.add("active");
    loadPlacesForTimeline(e.target.dataset.cat);
  });
});

const searchInput = document.getElementById("venueSearch");
const searchResults = document.getElementById("searchResults");
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  if (!q) { searchResults.classList.remove("visible"); return; }
  
  venues.filter(v => v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q)).slice(0, 10).forEach(v => {
    const item = document.createElement("div");
    item.className = "search-result-item";
    item.textContent = `${v.name} — ${v.city}`;
    item.onclick = () => {
      searchInput.value = v.name;
      searchResults.classList.remove("visible");
      triggerVenueSelection(v);
    };
    searchResults.appendChild(item);
  });
  searchResults.classList.add("visible");
});}

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
      <p class="place-meta top-pick-notes">"${item.notes || ""}"</p>
    `;
    card.addEventListener("click", () => showPlaceDetails(item));
    resultsEl.appendChild(card);
  });
}

// --- RENDER GOOGLE PLACES ---
function loadPlacesForTimeline(catKey) {
  const resultsEl = document.getElementById("guideResults");
  resultsEl.innerHTML = '<div style="padding: 20px; color: #5E6B86; font-size: 14px;">Curating the timeline...</div>';

  if (catKey === "toppicks") {
    resultsEl.innerHTML = "";
    renderTopPicksInline();
    return; 
  }

  if (!selectedVenue || !placesService) return;
  
  const config = TIMELINE_CONFIG[catKey];
  const request = {
    location: new google.maps.LatLng(selectedVenue.lat, selectedVenue.lng),
    radius: config.radius
  };
  
  if (config.type) request.type = config.type;
  if (config.keyword) request.keyword = config.keyword;

  placesService.nearbySearch(request, (results, status) => {
    resultsEl.innerHTML = "";

    if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
      resultsEl.innerHTML = '<div style="padding: 20px; color: #5E6B86; font-size: 14px;">No immediate recommendations found.</div>';
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
      
      card.innerHTML = `
        <h3 class="place-name">${place.name}</h3>
        <p class="place-meta">${walkHTML} ${ratingStr} • ${place.vicinity}</p>
      `;
      card.addEventListener("click", () => showPlaceDetails(place));
      resultsEl.appendChild(card);
    });
  });
}

// --- PLACE DETAILS & NATIVE ROUTING ---
function showPlaceDetails(place) {
  try {
    document.getElementById("placeDetails").classList.remove("hidden");
    document.getElementById("detailsName").textContent = place.name || "Location";
    
    const address = place.vicinity || place.formatted_address || place.address || "";
    document.getElementById("detailsAddress").textContent = address;
    
    const metaBits = [];
    if (place.rating) metaBits.push(`${Number(place.rating).toFixed(1)}★`);
    if (place.notes) metaBits.push(`Concerto Curated`); 
    document.getElementById("detailsMeta").textContent = metaBits.join(" • ");

    // --- THE FIX: Reverting to your original, working Maps URL logic ---
    const routeBtn = document.getElementById("detailsMapsLink");
    
    let mapsUrl;
    if (place.url) {
      // If the API gives us a direct URL, use it
      mapsUrl = place.url;
    } else {
      // Otherwise, build the official Google Maps Search URL
      const queryStr = encodeURIComponent((place.name || "") + " " + address);
      const base = "https://www.google.com/maps/search/?api=1&query=" + queryStr;
      
      const pId = place.place_id || place.placeId;
      mapsUrl = pId ? `${base}&query_place_id=${encodeURIComponent(pId)}` : base;
    }
    
    // Set the href and use standard _blank exactly like your original code did
    routeBtn.href = mapsUrl;
    routeBtn.target = "_blank";
    routeBtn.rel = "noopener noreferrer";
    
    // Clear out the broken onclick override I gave you previously
    routeBtn.onclick = null;

    document.getElementById("placeDetailsClose").onclick = () => {
      document.getElementById("placeDetails").classList.add("hidden");
    };
  } catch(e) { 
    console.error("Error showing place details: ", e); 
  }
}

// --- INITIALIZATION & VENUE LOGIC ---
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
      
      // Select Venue
      item.onclick = () => {
        searchInput.value = v.name;
        searchResults.classList.remove("visible");
        
        selectedVenue = v;
        const key = v.key || makeVenueKey(v.name, v.city, v.state);
        const hasTopPicks = topPicksByKey[key] && topPicksByKey[key].length > 0;
        
        // Dynamic Pill Logic
        document.querySelectorAll(".timeline-pill").forEach(p => p.classList.remove("active"));
        const tpPill = document.getElementById("pill-toppicks");
        
        if (hasTopPicks) {
          tpPill.classList.remove("hidden-pill");
          currentCategory = "toppicks";
          tpPill.classList.add("active");
        } else {
          tpPill.classList.add("hidden-pill");
          currentCategory = "pregame";
          document.getElementById("pill-pregame").classList.add("active");
        }
        
        map.setZoom(14);
        map.panTo({ lat: v.lat, lng: v.lng });
        google.maps.event.addListenerOnce(map, "idle", () => map.panBy(0, 150));
        
        document.getElementById("guideVenueName").textContent = v.name;
        document.getElementById("guideVenueLocation").textContent = `${v.city}, ${v.state}`;
        document.getElementById("guidePanel").classList.remove("hidden");
        document.querySelector(".timeline-scroller").scrollLeft = 0;
        
        loadPlacesForTimeline(currentCategory);
      };
      searchResults.appendChild(item);
    });
    searchResults.classList.add("visible");
  });

  document.getElementById("closePanelBtn").onclick = () => document.getElementById("guidePanel").classList.add("hidden");

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
