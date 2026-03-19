// --- STATE & CONFIG ---
let map;
let placesService = null;
let venues = [];
let venueMapboxMarkers = [];
let currentPlaceMarkers = []; 
let selectedVenue = null;
let topPicksByKey = {};
let currentCategory = "pregame";

// NEW EXTENDED CONFIG (Broader radii, new categories mapped to Google APIs)
const TIMELINE_CONFIG = {
  pregame: { type: "restaurant", radius: 3000 },
  quickbites: { keyword: "pizza casual fast food", radius: 3000 },
  recovery: { type: "cafe", radius: 5000 },
  afterglow: { type: "bar", radius: 4000 },
  photoops: { type: "tourist_attraction", radius: 3000 },
  getready: { keyword: "salon pharmacy clothing", radius: 3000 },
  parking: { type: "parking", radius: 2500 },
  transit: { type: "transit_station", radius: 3000 },
  stay: { type: "lodging", radius: 8000 }
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
  
  map.flyTo({
    center: [v.lng, v.lat],
    zoom: 15.5,
    pitch: 60, 
    bearing: 20, 
    duration: 1200, 
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
    if(!data.routes || !data.routes[0]) return;
    const route = data.routes[0].geometry;
    
    if (map.getSource('route')) {
      map.getSource('route').setData(route);
    } else {
      map.addSource('route', { 'type': 'geojson', 'data': route });
      
      map.addLayer({
        'id': 'route-glow', 'type': 'line', 'source': 'route',
        'layout': { 'line-join': 'round', 'line-cap': 'round' },
        'paint': { 'line-color': '#C9A84C', 'line-width': 8, 'line-opacity': 0.3, 'line-blur': 4 }
      });
      
      map.addLayer({
        'id': 'route-core', 'type': 'line', 'source': 'route',
        'layout': { 'line-join': 'round', 'line-cap': 'round' },
        'paint': { 'line-color': '#C9A84C', 'line-width': 3 }
      });
    }

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

// --- RENDER GOOGLE PLACES & TOP PICKS ---
function loadPlacesForTimeline(catKey) {
  const resultsEl = document.getElementById("guideResults");
  resultsEl.innerHTML = '<div style="padding: 20px; color: #5E6B86; font-size: 14px;">Curating the timeline...</div>';
  clearPlaceMarkers(); 

  // 1. TOP PICKS RENDERING
  if (catKey === "toppicks") {
    resultsEl.innerHTML = "";
    const picks = topPicksByKey[selectedVenue.key] || [];
    
    picks.forEach(item => {
      const card = document.createElement("div");
      card.className = "place-card top-pick-card";
      let walkHTML = "";
      
      if (item.lat && item.lng) {
        walkHTML = `<span class="walk-badge">${getWalkScore(distanceMeters(selectedVenue.lat, selectedVenue.lng, item.lat, item.lng))}</span>`;
        const el = document.createElement('div'); el.className = 'place-marker';
        const m = new mapboxgl.Marker(el).setLngLat([item.lng, item.lat]).addTo(map);
        currentPlaceMarkers.push(m);
      }

      card.innerHTML = `
        <span class="top-pick-badge">★ Concerto Top Pick</span>
        <h3 class="place-name">${item.name}</h3>
        <p class="place-meta">${walkHTML} ${item.address || ""}</p>
        <p class="place-meta top-pick-notes">"${item.notes || ""}"</p>
      `;
      // Pass TRUE to signify this is a Top Pick (triggers background geocoding if needed)
      card.addEventListener("click", () => showPlaceDetails(item, true));
      resultsEl.appendChild(card);
    });
    return;
  }

  // 2. STANDARD GOOGLE PLACES RENDERING
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
      resultsEl.innerHTML = '<div style="padding: 20px; color: #5E6B86; font-size: 14px;">No immediate recommendations found. Expand map to view more.</div>';
      return;
    }

    // Removed the .slice(0, 15) so it shows all available results!
    results.forEach(place => {
      const card = document.createElement("div");
      card.className = "place-card";

      let walkHTML = "";
      if (place.geometry && place.geometry.location) {
        const plat = place.geometry.location.lat();
        const plng = place.geometry.location.lng();
        walkHTML = `<span class="walk-badge">${getWalkScore(distanceMeters(selectedVenue.lat, selectedVenue.lng, plat, plng))}</span>`;
        
        const el = document.createElement('div'); el.className = 'place-marker';
        const m = new mapboxgl.Marker(el).setLngLat([plng, plat]).addTo(map);
        currentPlaceMarkers.push(m);
      }
      
      const ratingStr = place.rating ? `${Number(place.rating).toFixed(1)}★` : "";
      card.innerHTML = `
        <h3 class="place-name">${place.name}</h3>
        <p class="place-meta">${walkHTML} ${ratingStr} • ${place.vicinity}</p>
      `;
      // Pass FALSE to signify this is a standard place
      card.addEventListener("click", () => showPlaceDetails(place, false));
      resultsEl.appendChild(card);
    });
  });
}

// --- RICH DETAILS, SMART ROUTING & POP-UP LOGIC ---
function showPlaceDetails(place, isTopPick) {
  try {
    document.getElementById("guidePanel").classList.add("hidden");
    document.getElementById("placeDetails").classList.remove("hidden");
    
    // 1. Set Base Data
    document.getElementById("detailsName").textContent = place.name || "Location";
    const address = place.vicinity || place.formatted_address || place.address || "";
    document.getElementById("detailsAddress").textContent = address;
    
    const metaBits = [];
    if (place.rating) metaBits.push(`${Number(place.rating).toFixed(1)}★`);
    if (place.notes) metaBits.push(`Concerto Curated`); 
    document.getElementById("detailsMeta").textContent = metaBits.join(" • ");

    // 2. Setup Open in Maps Button
    const routeBtn = document.getElementById("detailsMapsLink");
    let destName = encodeURIComponent((place.name || "") + " " + address);
    let mapsUrl = `https://maps.google.com/maps?daddr=6$${destName}`;
    routeBtn.href = mapsUrl;
    routeBtn.target = "_system";

    // 3. Hide Action Buttons by Default
    const phoneBtn = document.getElementById("detailsPhoneBtn");
    const webBtn = document.getElementById("detailsWebsiteBtn");
    if(phoneBtn) phoneBtn.hidden = true; 
    if(webBtn) webBtn.hidden = true;

    // 4. THE MAGIC: Routing & Rich Details Fetching
    if (isTopPick && (!place.lat || !place.lng) && selectedVenue && placesService) {
      // Background Geocode for Top Picks missing Lat/Lng
      placesService.findPlaceFromQuery({ query: place.name + " " + address, fields: ['geometry', 'place_id'] }, (res, status) => {
        if (status === 'OK' && res[0]) {
          const geom = res[0].geometry.location;
          drawRoute(selectedVenue.lng, selectedVenue.lat, geom.lng(), geom.lat());
          fetchRichDetails(res[0].place_id);
        }
      });
    } else if (selectedVenue) {
      // Standard Place or Top Pick with coordinates
      let pLat = place.lat || (place.geometry ? place.geometry.location.lat() : null);
      let pLng = place.lng || (place.geometry ? place.geometry.location.lng() : null);
      if (pLat && pLng) drawRoute(selectedVenue.lng, selectedVenue.lat, pLng, pLat);
      
      if(place.place_id) fetchRichDetails(place.place_id);
    }

    // --- Helper to fetch Price, Categories, Hours, Phone, Web ---
    function fetchRichDetails(placeId) {
      if(!placesService) return;
      placesService.getDetails({ 
        placeId: placeId, 
        fields: ['price_level', 'types', 'formatted_phone_number', 'website', 'opening_hours'] 
      }, (details, status) => {
        if (status === 'OK') {
          let updatedMeta = [];
          if (place.rating) updatedMeta.push(`${Number(place.rating).toFixed(1)}★`);
          if (details.price_level) updatedMeta.push('$'.repeat(details.price_level));
          
          if (details.types && details.types.length > 0) {
            let typeStr = details.types[0].replace(/_/g, ' ');
            updatedMeta.push(typeStr.charAt(0).toUpperCase() + typeStr.slice(1));
          }
          
          if (details.opening_hours) {
            const isOpen = details.opening_hours.isOpen ? details.opening_hours.isOpen() : false;
            updatedMeta.push(isOpen ? "🟢 Open Now" : "🔴 Closed");
          } else if (place.notes) {
             updatedMeta.push(`Concerto Curated`);
          }
          
          document.getElementById("detailsMeta").textContent = updatedMeta.join(" • ");

          if(details.formatted_phone_number && phoneBtn) {
            phoneBtn.hidden = false;
            phoneBtn.href = `tel:${details.formatted_phone_number.replace(/\D/g, '')}`;
          }
          if(details.website && webBtn) {
            webBtn.hidden = false;
            webBtn.href = details.website;
          }
        }
      });
    }

    // 5. When Closing Details
    document.getElementById("placeDetailsClose").onclick = () => {
      document.getElementById("placeDetails").classList.add("hidden");
      document.getElementById("guidePanel").classList.remove("hidden");
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
