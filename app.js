let map;
let venues = [];
let markers = [];
let selectedVenue = null;

let guideResultsEl = null;
let placesService = null;

let currentCategory = "restaurants";
let currentSecondaryId = "all";

// ✅ New UI elements (2 pills + 2 menus)
let categorySelectBtn = null;
let categorySelectLabelEl = null;
let categoryMenuEl = null;

let filterSelectBtn = null;
let filterSelectLabelEl = null;
let filterMenuEl = null;

// Top Picks data
let topPicksByKey = {};

// --- Place details overlay elements ---
let placeDetailsOverlay = null;
let detailsNameEl = null;
let detailsMetaEl = null;
let detailsAddressEl = null;
let detailsPhoneEl = null;
let detailsPhoneRowEl = null;
let detailsWebsiteEl = null;
let detailsWebsiteRowEl = null;
let detailsMapsLinkEl = null;
let detailsHoursEl = null;

// Navy pin icon for Concerto (default venues)
const NAVY_PIN_ICON = {
  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
  fillColor: "#121E36",
  fillOpacity: 1,
  strokeColor: "#F8F9F9",
  strokeWeight: 1,
  scale: 1.4,
  anchor: { x: 12, y: 22 }
};

// Silver pin icon (festival venues)
const SILVER_PIN_ICON = {
  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
  fillColor: "#C0C0C0",
  fillOpacity: 1,
  strokeColor: "#F8F9F9",
  strokeWeight: 1,
  scale: 1.4,
  anchor: { x: 12, y: 22 }
};

// Base category → Places search config
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

// ✅ “Good” filter sets: not too many, but useful
const FILTERS = {
  restaurants: [
    { id: "all",     label: "All",           keyword: null },
    { id: "sitdown", label: "Sit-Down",      keyword: "sit down restaurant" },
    { id: "quick",   label: "Quick Bites",   keyword: "fast food" },
    { id: "brunch",  label: "Brunch",        keyword: "brunch" },
    { id: "pizza",   label: "Pizza",         keyword: "pizza" },
    { id: "vegan",   label: "Vegan-Friendly",keyword: "vegan restaurant" }
  ],
  hotels: [
    { id: "all",     label: "All",     keyword: null },
    { id: "boutique",label: "Boutique",keyword: "boutique hotel" },
    { id: "luxury",  label: "Luxury",  keyword: "luxury hotel" },
    { id: "budget",  label: "Budget",  keyword: "budget hotel" }
  ],
  bars: [
    { id: "all",     label: "All",        keyword: null },
    { id: "cocktail",label: "Cocktail",   keyword: "cocktail bar" },
    { id: "sports",  label: "Sports Bar", keyword: "sports bar" },
    { id: "rooftop", label: "Rooftop",    keyword: "rooftop bar" }
  ],
  coffee: [
    { id: "all",     label: "All",        keyword: null },
    { id: "study",   label: "Study Spots",keyword: "coffee shop with wifi" },
    { id: "bakery",  label: "Bakery",     keyword: "bakery" },
    { id: "special", label: "Specialty",  keyword: "specialty coffee" }
  ]
};

// Category labels for pill
const CATEGORY_LABELS = {
  toppicks: "Top Picks",
  restaurants: "Restaurants",
  hotels: "Hotels",
  bars: "Bars",
  coffee: "Coffee",
  transit: "Public Transit",
  attractions: "Attractions",
  retail: "Retail Stores",
  pharmacies: "Pharmacies",
  gas: "Gas Stations",
  grocery: "Grocery Stores"
};

// ----- Key helpers for venues / Top Picks -----
function makeVenueKey(name, city, state) {
  return (name + "|" + city + "|" + state).toLowerCase();
}

// ----- Distance helpers -----
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function metersToMiles(m) { return m / 1609.34; }

// -------- Place details overlay helpers --------
function hidePlaceDetails() {
  if (placeDetailsOverlay) placeDetailsOverlay.hidden = true;
}

function showPlaceDetails(place) {
  if (!placeDetailsOverlay) return;

  detailsNameEl.textContent = place.name || "";

  const bits = [];
  if (place.rating) {
    const rating = place.rating.toFixed(1);
    const count = place.user_ratings_total;
    bits.push(`${rating}★${count ? ` (${count})` : ""}`);
  }
  if (place.types && place.types.length) {
    const prettyType = place.types[0].replace(/_/g, " ");
    bits.push(prettyType);
  }
  detailsMetaEl.textContent = bits.join(" • ");

  detailsAddressEl.textContent =
    place.formatted_address || place.vicinity || "";

  if (place.formatted_phone_number) {
    detailsPhoneRowEl.hidden = false;
    detailsPhoneEl.textContent = place.formatted_phone_number;
    detailsPhoneEl.href =
      "tel:" + place.formatted_phone_number.replace(/\D/g, "");
  } else {
    detailsPhoneRowEl.hidden = true;
  }

  if (place.website) {
    detailsWebsiteRowEl.hidden = false;
    detailsWebsiteEl.textContent = place.website.replace(/^https?:\/\//, "");
    detailsWebsiteEl.href = place.website;
  } else {
    detailsWebsiteRowEl.hidden = true;
  }

  let mapsUrl;
  if (place.url) {
    mapsUrl = place.url;
  } else {
    const base =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(place.name || "");
    mapsUrl = place.place_id
      ? `${base}&query_place_id=${encodeURIComponent(place.place_id)}`
      : base;
  }
  detailsMapsLinkEl.href = mapsUrl;

  if (place.opening_hours && place.opening_hours.weekday_text) {
    detailsHoursEl.hidden = false;
    detailsHoursEl.textContent = place.opening_hours.weekday_text.join("\n");
  } else {
    detailsHoursEl.hidden = true;
  }

  placeDetailsOverlay.hidden = false;
}

function hideMenus() {
  if (categoryMenuEl) categoryMenuEl.hidden = true;
  if (filterMenuEl) filterMenuEl.hidden = true;
  if (categorySelectBtn) categorySelectBtn.setAttribute("aria-expanded", "false");
  if (filterSelectBtn) filterSelectBtn.setAttribute("aria-expanded", "false");
}

function categorySupportsFilters(catKey) {
  // filters only for these 4 categories
  return !!FILTERS[catKey];
}

function renderFilterMenu(catKey) {
  if (!filterMenuEl) return;
  filterMenuEl.innerHTML = "";

  const defs = FILTERS[catKey];
  if (!defs || !defs.length) return;

  defs.forEach(def => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "select-menu-item";
    btn.textContent = def.label;
    btn.addEventListener("click", () => {
      currentSecondaryId = def.id;
      if (filterSelectLabelEl) filterSelectLabelEl.textContent = def.label;
      filterMenuEl.hidden = true;
      filterSelectBtn.setAttribute("aria-expanded", "false");
      loadPlacesForCategory(currentCategory, currentSecondaryId);
    });
    filterMenuEl.appendChild(btn);
  });
}

function setCategory(catKey) {
  currentCategory = catKey;
  currentSecondaryId = "all";

  if (categorySelectLabelEl) {
    categorySelectLabelEl.textContent = CATEGORY_LABELS[catKey] || "Restaurants";
  }

  // Show/hide filter pill based on category
  if (filterSelectBtn) {
    const supported = categorySupportsFilters(catKey);
    filterSelectBtn.hidden = !supported;
    if (supported) {
      // reset filter label + rebuild filter menu
      if (filterSelectLabelEl) filterSelectLabelEl.textContent = "All";
      renderFilterMenu(catKey);
    }
  }

  loadPlacesForCategory(currentCategory, currentSecondaryId);
}

// Make initMap visible for Google callback
window.initMap = function () {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 39.5, lng: -98.35 },
    zoom: 4,
    disableDefaultUI: true,
    zoomControl: true
  });

  placesService = new google.maps.places.PlacesService(map);

  guideResultsEl = document.getElementById("guideResults");

  // ✅ new elements
  categorySelectBtn = document.getElementById("categorySelectBtn");
  categorySelectLabelEl = document.getElementById("categorySelectLabel");
  categoryMenuEl = document.getElementById("categoryMenu");

  filterSelectBtn = document.getElementById("filterSelectBtn");
  filterSelectLabelEl = document.getElementById("filterSelectLabel");
  filterMenuEl = document.getElementById("filterMenu");

  // Details overlay elements
  placeDetailsOverlay = document.getElementById("placeDetails");
  detailsNameEl = document.getElementById("detailsName");
  detailsMetaEl = document.getElementById("detailsMeta");
  detailsAddressEl = document.getElementById("detailsAddress");
  detailsPhoneEl = document.getElementById("detailsPhone");
  detailsPhoneRowEl = document.getElementById("detailsPhoneRow");
  detailsWebsiteEl = document.getElementById("detailsWebsite");
  detailsWebsiteRowEl = document.getElementById("detailsWebsiteRow");
  detailsMapsLinkEl = document.getElementById("detailsMapsLink");
  detailsHoursEl = document.getElementById("detailsHours");

  const closeBtn = document.getElementById("placeDetailsClose");
  if (closeBtn) closeBtn.addEventListener("click", hidePlaceDetails);

  if (placeDetailsOverlay) {
    placeDetailsOverlay.addEventListener("click", (e) => {
      if (e.target === placeDetailsOverlay) hidePlaceDetails();
    });
  }

  // ✅ Category pill click
  if (categorySelectBtn) {
    categorySelectBtn.addEventListener("click", () => {
      if (!selectedVenue) return;
      const willOpen = categoryMenuEl.hidden;
      hideMenus();
      categoryMenuEl.hidden = !willOpen;
      categorySelectBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  }

  // ✅ Category menu items
  if (categoryMenuEl) {
    Array.from(categoryMenuEl.querySelectorAll(".select-menu-item")).forEach(item => {
      item.addEventListener("click", () => {
        if (!selectedVenue) return;
        const cat = item.dataset.category;
        if (!cat) return;
        setCategory(cat);
        hideMenus();
      });
    });
  }

  // ✅ Filter pill click
  if (filterSelectBtn) {
    filterSelectBtn.addEventListener("click", () => {
      if (!selectedVenue) return;
      if (filterSelectBtn.hidden) return;

      const willOpen = filterMenuEl.hidden;
      hideMenus();
      filterMenuEl.hidden = !willOpen;
      filterSelectBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  }

  // ✅ Outside click closes menus
  document.addEventListener("click", (e) => {
    const inCategory = categorySelectBtn && categorySelectBtn.contains(e.target);
    const inCategoryMenu = categoryMenuEl && categoryMenuEl.contains(e.target);
    const inFilter = filterSelectBtn && filterSelectBtn.contains(e.target);
    const inFilterMenu = filterMenuEl && filterMenuEl.contains(e.target);

    if (!inCategory && !inCategoryMenu && !inFilter && !inFilterMenu) {
      hideMenus();
    }
  });

  // Load venues, then Top Picks
  fetch("data/venues.json")
    .then(res => res.json())
    .then(data => {
      venues = data;
      venues.forEach(v => { v.key = makeVenueKey(v.name, v.city, v.state); });

      createMarkers();
      setupSearch();

      return fetch("data/top_picks.json");
    })
    .then(res => (res && res.ok ? res.json() : []))
    .then(tpData => {
      if (!Array.isArray(tpData)) return;
      tpData.forEach(entry => {
        if (!entry.venueName || !entry.city || !entry.state) return;
        const key = makeVenueKey(entry.venueName, entry.city, entry.state);
        if (entry.items && Array.isArray(entry.items)) {
          topPicksByKey[key] = entry.items;
        }
      });
    })
    .catch(err => console.error("Error loading data:", err));
};

function createMarkers() {
  markers = venues.map(venue => {
    const marker = new google.maps.Marker({
      position: { lat: venue.lat, lng: venue.lng },
      map,
      title: venue.name,
      icon: venue.isFestival ? SILVER_PIN_ICON : NAVY_PIN_ICON
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

  map.setZoom(13);
  map.panTo({ lat: venue.lat, lng: venue.lng });

  google.maps.event.addListenerOnce(map, "idle", () => {
    const mapDiv = document.getElementById("map");
    const panel = document.getElementById("guidePanel");

    if (mapDiv && panel) {
      const panelHeight = panel.clientHeight;
      const offset = panelHeight * 0.7;
      map.panBy(0, offset);
    } else if (mapDiv) {
      map.panBy(0, mapDiv.clientHeight * 0.3);
    }
  });

  const nameEl = document.getElementById("guideVenueName");
  const locEl = document.getElementById("guideVenueLocation");
  nameEl.textContent = venue.name;
  locEl.textContent = `${venue.city}, ${venue.state}`;

  document.getElementById("guidePanel").classList.remove("guide-panel--hidden");

  hideMenus();
  setCategory("restaurants");
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
      venues.find(v => v.city.toLowerCase().includes(q) || v.state.toLowerCase().includes(q)) ||
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

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      const match = findBestMatch(input.value);
      if (match) {
        renderResults([]);
        focusVenue(match);
      }
    }
  });

  document.addEventListener("click", e => {
    if (!resultsEl.contains(e.target) && e.target !== input) {
      resultsEl.classList.remove("visible");
    }
  });
}

// ----- Top Picks loader (curated) -----
function loadTopPicksForVenue(venue) {
  if (!guideResultsEl || !venue) return;

  const key = venue.key || makeVenueKey(venue.name, venue.city, venue.state);
  const picks = topPicksByKey[key] || [];

  if (!picks.length) {
    guideResultsEl.innerHTML =
      '<div class="hint">No Top Picks added for this venue yet.</div>';
    return;
  }

  guideResultsEl.innerHTML = "";

  picks.forEach(item => {
    const card = document.createElement("div");
    card.className = "place-card";

    const nameEl = document.createElement("p");
    nameEl.className = "place-name";
    nameEl.textContent = item.name || "Top Pick";

    const metaEl = document.createElement("p");
    metaEl.className = "place-meta";

    const bits = [];
    if (item.address) bits.push(item.address);
    if (item.notes) bits.push(item.notes);
    metaEl.textContent = bits.join(" • ");

    card.appendChild(nameEl);
    card.appendChild(metaEl);

    card.addEventListener("click", () => {
      const pseudoPlace = {
        name: item.name,
        formatted_address: item.address,
        rating: item.rating || null,
        user_ratings_total: item.user_ratings_total || null,
        formatted_phone_number: item.phone || null,
        website: item.website || null,
        opening_hours: null,
        types: item.types || []
      };

      let mapsUrl;
      if (item.mapsUrl) {
        mapsUrl = item.mapsUrl;
      } else if (item.placeId) {
        const base =
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent(item.name || "");
        mapsUrl = base + "&query_place_id=" + encodeURIComponent(item.placeId);
      } else if (item.name || item.address) {
        mapsUrl =
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent((item.name || "") + " " + (item.address || ""));
      }

      if (mapsUrl) pseudoPlace.url = mapsUrl;

      showPlaceDetails(pseudoPlace);
    });

    guideResultsEl.appendChild(card);
  });
}

function loadPlacesForCategory(catKey, subFilterId) {
  if (!selectedVenue) return;

  if (catKey === "toppicks") {
    loadTopPicksForVenue(selectedVenue);
    return;
  }

  if (!placesService) return;

  const baseCfg = CATEGORY_SEARCH_CONFIG[catKey] || CATEGORY_SEARCH_CONFIG.restaurants;

  const request = {
    location: new google.maps.LatLng(selectedVenue.lat, selectedVenue.lng),
    radius: baseCfg.radius || 3000
  };

  if (baseCfg.type) request.type = baseCfg.type;

  // apply keyword from filter if supported
  let keyword = baseCfg.keyword || null;
  const defs = FILTERS[catKey];
  if (defs && subFilterId) {
    const match = defs.find(d => d.id === subFilterId);
    if (match && match.keyword) keyword = match.keyword;
  }
  if (keyword) request.keyword = keyword;

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

    const bits = [];

    if (place.vicinity) bits.push(place.vicinity);

    if (selectedVenue && place.geometry && place.geometry.location) {
      const lat2 = place.geometry.location.lat();
      const lng2 = place.geometry.location.lng();
      const meters = distanceMeters(selectedVenue.lat, selectedVenue.lng, lat2, lng2);
      const miles = metersToMiles(meters);
      bits.push(`${miles.toFixed(1)} mi`);
    }

    if (place.rating) bits.push(`${place.rating.toFixed(1)}★`);
    meta.textContent = bits.join(" • ");

    card.appendChild(name);
    card.appendChild(meta);

    card.addEventListener("click", () => {
      if (!placesService || !place.place_id) {
        showPlaceDetails(place);
        return;
      }

      const request = {
        placeId: place.place_id,
        fields: [
          "name",
          "rating",
          "user_ratings_total",
          "formatted_address",
          "formatted_phone_number",
          "website",
          "url",
          "opening_hours",
          "types"
        ]
      };

      placesService.getDetails(request, (details, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && details) {
          showPlaceDetails(details);
        } else {
          showPlaceDetails(place);
        }
      });
    });

    guideResultsEl.appendChild(card);
  });
}