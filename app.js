let map;
let venues = [];
let markers = [];
let selectedVenue = null;

let categoryButtons = [];
let guideResultsEl = null;
let placesService = null;

// Navy pin icon for Concerto
const NAVY_PIN_ICON = {
  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
  fillColor: "#121E36",
  fillOpacity: 1,
  strokeColor: "#F8F9F9",
  strokeWeight: 1,
  scale: 1.4,
  anchor: { x: 12, y: 22 }
};

// Category → Places search config
const CATEGORY_SEARCH_CONFIG = {
  restaurants: { type: "restaurant", radius: 3000 },
  bars:        { type: "bar", radius: 3000 },
  coffee:      { type: "cafe", radius: 3000 },
  hotels:      { type: "lodging", radius: 4000 },
  retail:      { keyword: "shopping", radius: 4000 },
  attractions: { type: "tourist_attraction", radius: 5000 },
  transit:     { type: "transit_station", radius: 4000 },
  pharmacies:  { type: "pharmacy", radius: 3000 },
  gas:         { type: "gas_station", radius: 4000 },
  grocery:     { keyword: "grocery store", radius: 4000 }
};

// Make initMap visible for Google callback
window.initMap = function () {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 39.5, lng: -98.35 }, // rough US center
    zoom: 4,
    disableDefaultUI: true,
    zoomControl: true
  });

  placesService = new google.maps.places.PlacesService(map);
  guideResultsEl = document.getElementById("guideResults");
  categoryButtons = Array.from(document.querySelectorAll(".guide-pill"));

  setupCategoryPills();

  fetch("data/venues.json")
    .then(res => res.json())
    .then(data => {
      venues = data;
      createMarkers();
      setupSearch();
    })
    .catch(err => console.error("Error loading venues.json:", err));
};

function createMarkers() {
  markers = venues.map(venue => {
    const marker = new google.maps.Marker({
      position: { lat: venue.lat, lng: venue.lng },
      map,
      title: venue.name,
      icon: NAVY_PIN_ICON
    });

    marker.addListener("click", () => {
      focusVenue(venue);
    });

    return { venueId: venue.id, marker };
  });
}

function focusVenue(venue) {
  if (!venue || !venue.lat || !venue.lng) return;

  selectedVenue = venue;

  map.panTo({ lat: venue.lat, lng: venue.lng });
  map.setZoom(13);

  const guidePanel = document.getElementById("guidePanel");
  const nameEl = document.getElementById("guideVenueName");
  const locEl = document.getElementById("guideVenueLocation");

  nameEl.textContent = venue.name;
  locEl.textContent = `${venue.city}, ${venue.state}`;

  // Reset pills to Restaurants
  if (categoryButtons.length) {
    categoryButtons.forEach(b => b.classList.remove("active"));
    const defaultBtn = categoryButtons.find(
      b => b.dataset.category === "restaurants"
    );
    if (defaultBtn) defaultBtn.classList.add("active");
  }

  guidePanel.classList.remove("guide-panel--hidden");
  loadPlacesForCategory("restaurants");
}

function setupSearch() {
  const input = document.getElementById("venueSearch");
  const resultsEl = document.getElementById("searchResults");

  function renderResults(list) {
    resultsEl.innerHTML = "";
    if (!list.length) {
      resultsEl.classList.remove("visible");
      return;
    }

    list.forEach(v => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.textContent = `${v.name} — ${v.city}, ${v.state}`;
      item.addEventListener("click", () => {
        input.value = v.name;
        resultsEl.classList.remove("visible");
        focusVenue(v);
      });
      resultsEl.appendChild(item);
    });

    resultsEl.classList.add("visible");
  }

  function findBestMatch(query) {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    return (
      venues.find(v => v.name.toLowerCase() === q) ||
      venues.find(v => v.name.toLowerCase().includes(q)) ||
      venues.find(
        v =>
          v.city.toLowerCase().includes(q) ||
          v.state.toLowerCase().includes(q)
      ) ||
      null
    );
  }

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      renderResults([]);
      return;
    }

    const filtered = venues.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.city.toLowerCase().includes(q) ||
      v.state.toLowerCase().includes(q)
    );

    renderResults(filtered.slice(0, 25));
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const match = findBestMatch(input.value);
      if (match) {
        renderResults([]);
        focusVenue(match);
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!resultsEl.contains(e.target) && e.target !== input) {
      resultsEl.classList.remove("visible");
    }
  });
}

function setupCategoryPills() {
  if (!categoryButtons.length) return;

  categoryButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (!selectedVenue) return;

      categoryButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const cat = btn.dataset.category || "restaurants";
      loadPlacesForCategory(cat);
    });
  });
}

function loadPlacesForCategory(catKey) {
  if (!placesService || !selectedVenue) return;

  const cfg = CATEGORY_SEARCH_CONFIG[catKey] || CATEGORY_SEARCH_CONFIG.restaurants;

  const request = {
    location: new google.maps.LatLng(selectedVenue.lat, selectedVenue.lng),
    radius: cfg.radius || 3000
  };

  if (cfg.type) request.type = cfg.type;
  if (cfg.keyword) request.keyword = cfg.keyword;

  if (guideResultsEl) {
    guideResultsEl.innerHTML = '<div class="hint">Loading nearby places…</div>';
  }

  placesService.nearbySearch(request, (results, status) => {
    if (!guideResultsEl) return;

    if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
      guideResultsEl.innerHTML =
        '<div class="hint">No places found for this category here yet.</div>';
      return;
    }

    renderPlaces(results.slice(0, 20));
  });
}

function renderPlaces(places) {
  guideResultsEl.innerHTML = "";

  if (!places.length) {
    guideResultsEl.innerHTML =
      '<div class="hint">No places found for this category here yet.</div>';
    return;
  }

  places.forEach(place => {
    const card = document.createElement("div");
    card.className = "place-card";

    const name = document.createElement("p");
    name.className = "place-name";
    name.textContent = place.name || "Unnamed Place";

    const meta = document.createElement("p");
    meta.className = "place-meta";

    const metaBits = [];
    if (place.vicinity) metaBits.push(place.vicinity);
    if (place.rating) metaBits.push(`${place.rating.toFixed(1)}★`);
    if (place.user_ratings_total) metaBits.push(`${place.user_ratings_total} reviews`);

    meta.textContent = metaBits.join(" • ");

    card.appendChild(name);
    card.appendChild(meta);

    // Tap card → center map on that place
    card.addEventListener("click", () => {
      if (place.geometry && place.geometry.location) {
        map.panTo(place.geometry.location);
        map.setZoom(15);
      }
    });

    guideResultsEl.appendChild(card);
  });
}
