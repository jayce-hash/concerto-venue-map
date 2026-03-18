// --- STATE & CONFIG ---
let map;
let placesService = null;
let venues = [];
let venueMapboxMarkers = [];
let currentPlaceMarkers = []; 
let selectedVenue = null;
let topPicksByKey = {};
let currentCategory = "pregame";

const TIMELINE_CONFIG = {
  pregame: { type: "restaurant", radius: 1500 },
  quickbites: { keyword: "pizza casual fast food", radius: 1500 },
  afterglow: { type: "bar", radius: 2500 },
  recovery: { type: "cafe", radius: 3000 },
  stay: { type: "lodging", radius: 5000 }
};

// --- MATH & UTILS ---
function makeVenueKey(name, city, state) { 
  return (name + "|" + city + "|" + state).toLowerCase(); 
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = x => (x * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) * Math.sin(toRad(lat2 - lat1) / 2) + 
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) * Math.sin(toRad(lng2 - lng1) / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getWalkScore(meters) {
  const minutes = Math.round(meters / 80); 
  if (minutes <= 3) return "📍 Steps away";
  if (minutes <= 20) return `🚶 ${minutes} min walk`;
  return `🚗 ${(meters / 1609.34).toFixed(1)} mi`;
}

// --- INITIALIZE HEADLESS GOOGLE PLACES ---
window.initGoogleAPI = function() {
  const dummyDiv = document.getElementById("googlePlacesBrain");
  if(dummyDiv) {
    placesService = new google.maps.places.PlacesService(dummyDiv);
  }
};

// --- INITIALIZE MAPBOX & APP ---
document.addEventListener("DOMContentLoaded", () => {
  if (!mapboxgl.supported()) {
    console.warn("WebGL not supported. 3D maps may not render.");
  }

  mapboxgl.accessToken = 'pk.eyJ1Ijoiandjb25jZXJ0byIsImEiOiJjbW13aXhkNTkycnRiMnBwdGVpb3drd2E2In0.FnB70e0jozY5t1LBu_DRjw';

  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-98.35, 39.5],
    zoom: 3.5,
    pitch: 0, 
    antialias: true
  });

  map.on('load', () => {
    map.addLayer({
      'id': '3d-buildings',
      'source': 'composite',
      'source-layer': 'building',
      'filter': ['==', 'extrude', 'true'],
      'type': 'fill-extrusion',
      'minzoom': 14,
      'paint': {
        'fill-extrusion-color': '#E2E8F0',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.8
      }
    });
    
    loadData();
    setupEventListeners();
  });
});

// --- DATA LOADING & MARKERS ---
function loadData() {
  fetch("data/venues.json")
    .then(res => res.json())
    .then(data => {
      venues = data;
      venues.forEach(v => {
        v.key = makeVenueKey(v.name, v.city, v.state);
        
        const el = document.createElement('div');
        el.className = 'venue-marker';
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat([v.lng, v.lat])
          .addTo(map);
          
        el.addEventListener('click', () => {
          document.getElementById("venueSearch").value = v.name;
          document.getElementById("searchResults").classList.remove("visible");
          triggerVenueSelection(v);
        });
        
        venueMapboxMarkers.push(marker);
      });
      return fetch("data/top_picks.json");
    })
    .then(res => res.json())
    .then(tpData => {
      tpData.forEach(entry => topPicksByKey[makeVenueKey(entry.venueName, entry.city, entry.state)] = entry.items);
    })
    .catch(err => {
      console.error("Data load error:", err);
    });
}

function clearPlaceMarkers() {
  currentPlaceMarkers.forEach(m => m.remove());
  currentPlaceMarkers = [];
}

// --- VENUE SELECTION (THE 3D FLYOVER) ---
function triggerVenueSelection(v) {
  selectedVenue = v;
  clearRoute(); 
  
  // Faster, snappier 3D Flyover
  map.flyTo({
    center: [v.lng, v.lat],
    zoom: 15.5,
    pitch: 60, 
    bearing: 20, 
    duration: 1200, // Reduced from 2500ms
    padding: { bottom: 300 } 
  });

  const key = v.key || makeVenueKey(v.name, v.city, v.state);
  const hasTopPicks = topPicksByKey[key] && topPicksByKey[key].length > 0;
  
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

// --- GLOWING WALKING ROUTE ---
async function drawRoute(startLng, startLat, endLng, endLat) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    const route = data.routes[0].geometry;
    
    if (map.getSource('route')) {
      map.getSource('route').setData(route);
    } else {
      map.addSource('route', { 'type': 'geojson', 'data': route });
      
      // The outer "Glow"
      map.addLayer({
        'id': 'route-glow',
        'type': 'line',
        'source': 'route',
        'layout': { 'line-join': 'round', 'line-cap': 'round' },
        'paint': { 'line-color': '#C9A84C', 'line-width': 8, 'line-opacity': 0.3, 'line-blur': 4 }
      });
      
      // The core solid line
      map.addLayer({
        'id': 'route-core',
        'type': 'line',
        'source': 'route',
        'layout': { 'line-join': 'round', 'line-cap': 'round' },
        'paint': { 'line-color': '#C9A84C', 'line-width': 3 }
      });
    }

    // Smoothly pan to fit both the Venue and the Destination on screen
    const bounds = new mapboxgl.LngLatBounds([startLng, startLat], [startLng, startLat]);
    bounds.extend([endLng, endLat]);
    map.fitBounds(bounds, { padding: { top: 100, bottom: 400, left: 50, right: 50 }, duration: 1000 });
    
  } catch(e) { console.error("Could not fetch route", e); }
}

function clearRoute() {
  if (map.getSource('route')) {
    map.getSource('route').setData({ type: 'FeatureCollection', features: [] });
  }
}

// --- RENDER TOP PICKS ---
function renderTopPicksInline() {
  if (!selectedVenue) return;
  const picks = topPicksByKey[selectedVenue.key] || [];
  const resultsEl = document.getElementById("guideResults");

  picks.forEach(item => {
    const card = document.createElement("div");
    card.className = "place-card top-pick-card";
    let walkHTML = "";
    
    if (item.lat && item.lng) {
      walkHTML = `<span class="walk-badge">${getWalkScore(distanceMeters(selectedVenue.lat, selectedVenue.lng, item.lat, item.lng))}</span>`;
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
}

// --- RENDER GOOGLE PLACES ---
function loadPlacesForTimeline(catKey) {
  const resultsEl = document.getElementById("guideResults");
  resultsEl.innerHTML = '<div style="padding: 20px; color: #5E6B86; font-size: 14px;">Curating the timeline...</div>';
  clearPlaceMarkers(); 

  if (catKey === "toppicks") {
    resultsEl.innerHTML = "";
    renderTopPicksInline();
    return;
  }

  if (!placesService) return;
  const config = TIMELINE_CONFIG[catKey];
  
  placesService.nearbySearch({
    location: new google.maps.LatLng(selectedVenue.lat, selectedVenue.lng),
    radius: config.radius,
    type: config.type,
    keyword: config.keyword
  }, (results, status) => {
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
        const plat = place.geometry.location.lat();
        const plng = place.geometry.location.lng();
        walkHTML = `<span class="walk-badge">${getWalkScore(distanceMeters(selectedVenue.lat, selectedVenue.lng, plat, plng))}</span>`;
        
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
  try {
    // 1. Hide the main list panel & Show the details panel
    document.getElementById("guidePanel").classList.add("hidden");
    document.getElementById("placeDetails").classList.remove("hidden");
    
    // 2. Populate text
    document.getElementById("detailsName").textContent = place.name || "Location";
    const address = place.vicinity || place.formatted_address || place.address || "";
    document.getElementById("detailsAddress").textContent = address;
    
    const metaBits = [];
    if (place.rating) metaBits.push(`${Number(place.rating).toFixed(1)}★`);
    if (place.notes) metaBits.push(`Concerto Curated`); 
    document.getElementById("detailsMeta").textContent = metaBits.join(" • ");

    // 3. Setup Route Button
    const routeBtn = document.getElementById("detailsMapsLink");
    let destName = place.name || "";
    if (address) destName += " " + address;
    let mapsUrl = `https://www.google.com/maps/search/?api=1&query=$?daddr=${encodeURIComponent(destName)}`;
    if (place.place_id || place.placeId) mapsUrl += `&query_place_id=${place.place_id || place.placeId}`;
    routeBtn.href = mapsUrl;
    routeBtn.target = "_system";

    // 4. Draw the Glowing Route
    if (selectedVenue) {
      let pLat = place.lat || (place.geometry ? place.geometry.location.lat() : null);
      let pLng = place.lng || (place.geometry ? place.geometry.location.lng() : null);
      if (pLat && pLng) {
        drawRoute(selectedVenue.lng, selectedVenue.lat, pLng, pLat);
      }
    }

    // 5. When Closing: Bring back the main list and fly back to the venue!
    document.getElementById("placeDetailsClose").onclick = () => {
      document.getElementById("placeDetails").classList.add("hidden");
      document.getElementById("guidePanel").classList.remove("hidden"); // Bring list back
      clearRoute(); 
      map.flyTo({ center: [selectedVenue.lng, selectedVenue.lat], zoom: 15.5, pitch: 60, duration: 800, padding: {bottom: 300} });
    };

  } catch(e) { console.error(e); }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  document.getElementById("closePanelBtn").onclick = () => {
    document.getElementById("guidePanel").classList.add("hidden");
    clearPlaceMarkers();
    clearRoute();
    map.flyTo({ pitch: 0, zoom: 4, duration: 1500 }); 
  };

  document.getElementById("placeDetailsClose").onclick = () => {
    document.getElementById("placeDetails").classList.add("hidden");
    clearRoute();
    if (selectedVenue) {
      map.flyTo({ center: [selectedVenue.lng, selectedVenue.lat], zoom: 15.5, pitch: 60, duration: 800, padding: {bottom: 300} });
    }
  };

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
  });
}
