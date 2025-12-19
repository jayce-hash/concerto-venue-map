let map;
let venues = [];
let markers = [];
let selectedVenue = null;

let placesService = null;
let guidePanelEl = null;
let guideResultsEl = null;

// --- New UI elements (Category + Filter dropdown pills) ---
let categorySelectBtn = null;
let categorySelectLabel = null;
let categoryMenu = null;

let filterSelectBtn = null;
let filterSelectLabel = null;
let filterMenu = null;

let backToMapBtn = null;

// --- Existing search UI ---
let venueSearchInput = null;
let venueSearchResultsEl = null;

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

// State
let currentCategory = "restaurants";
let currentSecondaryId = "all";

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

// Category labels for UI
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

// “Good filters” (not too many, but useful)
const SECONDARY_FILTERS = {
  restaurants: [
    { id: "all",     label: "All",            keyword: null },
    { id: "sitdown", label: "Sit-Down",       keyword: "sit down restaurant" },
    { id: "quick",   label: "Quick Bites",    keyword: "fast food" },
    { id: "brunch",  label: "Brunch",         keyword: "brunch" },
    { id: "pizza",   label: "Pizza",          keyword: "pizza" },
    { id: "vegan",   label: "Vegan-Friendly", keyword: "vegan restaurant" }
  ],
  hotels: [
    { id: "all",      label: "All",      keyword: null },
    { id: "boutique", label: "Boutique", keyword: "boutique hotel" },
    { id: "luxury",   label: "Luxury",   keyword: "luxury hotel" },
    { id: "budget",   label: "Budget",   keyword: "budget hotel" }
  ],
  bars: [
    { id: "all",      label: "All",         keyword: null },
    { id: "cocktail", label: "Cocktail",    keyword: "cocktail bar" },
    { id: "sports",   label: "Sports Bars", keyword: "sports bar" },
    { id: "rooftop",  label: "Rooftop",     keyword: "rooftop bar" }
  ],
  coffee: [
    { id: "all",       label: "All",         keyword: null },
    { id: "study",     label: "Study Spots", keyword: "coffee shop with wifi" },
    { id: "bakery",    label: "Bakery",      keyword: "bakery" },
    { id: "specialty", label: "Specialty",   keyword: "specialty coffee" }
  ],
  attractions: [
    { id: "all",     label: "All",     keyword: null },
    { id: "museums", label: "Museums", keyword: "museum" },
    { id: "parks",   label: "Parks",   keyword: "park" },
    { id: "views",   label: "Views",   keyword: "observation deck" }
  ],
  retail: [
    { id: "all",      label: "All",      keyword: null },
    { id: "mall",     label: "Malls",    keyword: "mall" },
    { id: "clothing", label: "Clothing", keyword: "clothing store" },
    { id: "gifts",    label: "Gifts",    keyword: "gift shop" }
  ],
  transit: [
    { id: "all",    label: "All",    keyword: null },
    { id: "subway", label: "Subway", keyword: "subway station" },
    { id: "train",  label: "Train",  keyword: "train station" },
    { id: "bus",    label: "Bus",    keyword: "bus station" }
  ]
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

function metersToMiles(m) {
  return m / 1609.34;
}

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

// ---------- Dropdown positioning (fixes “weird open” + mobile scroll) ----------
function positionMenuUnderButton(menuEl, buttonEl) {
  if (!menuEl || !buttonEl || !guidePanelEl) return;

  const panelRect = guidePanelEl.getBoundingClientRect();
  const btnRect = buttonEl.getBoundingClientRect();

  // menu is inside the panel visually, so set top relative to the panel
  const top = (btnRect.bottom - panelRect.top) + 6;
  menuEl.style.top = `${top}px`;
}

function closeMenus() {
  if (categoryMenu) categoryMenu.hidden = true;
  if (filterMenu) filterMenu.hidden = true;
  if (categorySelectBtn) categorySelectBtn.setAttribute("aria-expanded", "false");
  if (filterSelectBtn) filterSelectBtn.setAttribute("aria-expanded", "false");
}

function toggleMenu(menuEl, btnEl) {
  if (!menuEl || !btnEl) return;

  const opening = menuEl.hidden === true;

  // close other menu first
  if (menuEl === categoryMenu && filterMenu && !filterMenu.hidden) {
    filterMenu.hidden = true;
    if (filterSelectBtn) filterSelectBtn.setAttribute("aria-expanded", "false");
  }
  if (menuEl === filterMenu && categoryMenu && !categoryMenu.hidden) {
    categoryMenu.hidden = true;
    if (categorySelectBtn) categorySelectBtn.setAttribute("aria-expanded", "false");
  }

  if (opening) {
    positionMenuUnderButton(menuEl, btnEl);
    menuEl.hidden = false;
    btnEl.setAttribute("aria-expanded", "true");
  } else {
    menuEl.hidden = true;
    btnEl.setAttribute("aria-expanded", "false");
  }
}

// ---------- UI state for filter pill ----------
function updateFilterUIForCategory(catKey) {
  const defs = SECONDARY_FILTERS[catKey];

  // No filters for Top Picks + Pharmacies + Gas + Grocery (per your requirement)
  const shouldHide =
    catKey === "toppicks" ||
    catKey === "pharmacies" ||
    catKey === "gas" ||
    catKey === "grocery" ||
    !defs ||
    !defs.length;

  if (!filterSelectBtn || !filterSelectLabel || !filterMenu) return;

  if (shouldHide) {
    filterSelectBtn.hidden = true;
    filterMenu.innerHTML = "";
    currentSecondaryId = "all";
    return;
  }

  // Show filter pill, rebuild filter menu
  filterSelectBtn.hidden = false;
  buildFilterMenu(catKey);

  // Default to “All”
  currentSecondaryId = "all";
  filterSelectLabel.textContent = "All";
}

function buildFilterMenu(catKey) {
  if (!filterMenu) return;
  filterMenu.innerHTML = "";

  const defs = SECONDARY_FILTERS[catKey] || [];
  defs.forEach(def => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "select-menu-item";
    item.dataset.filterId = def.id;
    item.textContent = def.label;

    item.addEventListener("click", () => {
      currentSecondaryId = def.id;
      if (filterSelectLabel) filterSelectLabel.textContent = def.label;

      closeMenus();
      loadPlacesForCategory(currentCategory, currentSecondaryId);
    });

    filterMenu.appendChild(item);
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

    // add distance if we can (optional but nice)
    if (item.lat && item.lng && selectedVenue) {
      const meters = distanceMeters(selectedVenue.lat, selectedVenue.lng, item.lat, item.lng);
      bits.push(`${metersToMiles(meters).toFixed(1)} mi`);
    }

    if (item.rating) bits.push(`${Number(item.rating).toFixed(1)}★`);
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

  // Curated Top Picks
  if (catKey === "toppicks") {
    loadTopPicksForVenue(selectedVenue);
    return;
  }

  if (!placesService) return;

  const baseCfg =
    CATEGORY_SEARCH_CONFIG[catKey] || CATEGORY_SEARCH_CONFIG.restaurants;

  const request = {
    location: new google.maps.LatLng(selectedVenue.lat, selectedVenue.lng),
    radius: baseCfg.radius || 3000
  };

  if (baseCfg.type) request.type = baseCfg.type;
  let keyword = baseCfg.keyword || null;

  // Apply secondary filter keyword if available
  const defs = SECONDARY_FILTERS[catKey];
  if (defs && subFilterId) {
    const match = defs.find(d => d.id === subFilterId);
    if (match && match.keyword) keyword = match.keyword;
  }
  if (keyword) request.keyword = keyword;

  if (guideResultsEl) {
    guideResultsEl.innerHTML =
      '<div class="hint">Loading nearby places…</div>';
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
      bits.push(`${metersToMiles(meters).toFixed(1)} mi`);
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

// ----- Venue markers -----
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

// ----- “Back to main map” -----
function ensureBackButton() {
  if (!guidePanelEl) return;

  const header = guidePanelEl.querySelector(".guide-header");
  if (!header) return;

  if (document.getElementById("backToMapBtn")) {
    backToMapBtn = document.getElementById("backToMapBtn");
    return;
  }

  const btn = document.createElement("button");
  btn.id = "backToMapBtn";
  btn.type = "button";
  btn.textContent = "Back";
  btn.style.border = "1px solid #E2E7F0";
  btn.style.background = "#fff";
  btn.style.borderRadius = "999px";
  btn.style.padding = "7px 12px";
  btn.style.fontSize = "0.85rem";
  btn.style.color = "#121E36";
  btn.style.boxShadow = "0 4px 10px rgba(18, 30, 54, 0.10)";
  btn.style.cursor = "pointer";
  btn.style.marginLeft = "10px";
  btn.style.flex = "0 0 auto";

  btn.addEventListener("click", () => {
    closeMenus();
    hidePlaceDetails();

    selectedVenue = null;
    currentCategory = "restaurants";
    currentSecondaryId = "all";

    if (guidePanelEl) guidePanelEl.classList.add("guide-panel--hidden");
    if (guideResultsEl) guideResultsEl.innerHTML = "";

    // reset map view
    map.setZoom(4);
    map.panTo({ lat: 39.5, lng: -98.35 });

    // optionally clear the venue search input (not required)
    // if (venueSearchInput) venueSearchInput.value = "";
  });

  header.appendChild(btn);
  backToMapBtn = btn;
}

function focusVenue(venue) {
  if (!venue || !venue.lat || !venue.lng) return;

  selectedVenue = venue;

  // default state
  currentCategory = "restaurants";
  currentSecondaryId = "all";

  closeMenus();

  map.setZoom(13);
  map.panTo({ lat: venue.lat, lng: venue.lng });

  // keep venue above panel
  google.maps.event.addListenerOnce(map, "idle", () => {
    const panel = document.getElementById("guidePanel");
    if (panel) {
      const panelHeight = panel.clientHeight;
      map.panBy(0, panelHeight * 0.7);
    }
  });

  // set header text
  const nameEl = document.getElementById("guideVenueName");
  const locEl = document.getElementById("guideVenueLocation");
  if (nameEl) nameEl.textContent = venue.name;
  if (locEl) locEl.textContent = `${venue.city}, ${venue.state}`;

  // set UI labels to default
  if (categorySelectLabel) categorySelectLabel.textContent = CATEGORY_LABELS[currentCategory] || "Restaurants";
  updateFilterUIForCategory(currentCategory);

  // show panel
  if (guidePanelEl) guidePanelEl.classList.remove("guide-panel--hidden");

  ensureBackButton();

  // load places
  loadPlacesForCategory(currentCategory, currentSecondaryId);
}

// ----- Venue search (top search bar) -----
function setupVenueSearch() {
  venueSearchInput = document.getElementById("venueSearch");
  venueSearchResultsEl = document.getElementById("searchResults");
  if (!venueSearchInput || !venueSearchResultsEl) return;

  function renderResults(list) {
    venueSearchResultsEl.innerHTML = "";
    if (!list.length) {
      venueSearchResultsEl.classList.remove("visible");
      return;
    }
    list.forEach(v => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.textContent = `${v.name} — ${v.city}, ${v.state}`;
      item.addEventListener("click", () => {
        venueSearchInput.value = v.name;
        venueSearchResultsEl.classList.remove("visible");
        focusVenue(v);
      });
      venueSearchResultsEl.appendChild(item);
    });
    venueSearchResultsEl.classList.add("visible");
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

  venueSearchInput.addEventListener("input", () => {
    const q = venueSearchInput.value.trim().toLowerCase();
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

  venueSearchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      const match = findBestMatch(venueSearchInput.value);
      if (match) {
        renderResults([]);
        focusVenue(match);
      }
    }
  });

  document.addEventListener("click", e => {
    if (!venueSearchResultsEl.contains(e.target) && e.target !== venueSearchInput) {
      venueSearchResultsEl.classList.remove("visible");
    }
  });
}

function setupCategoryAndFilterUI() {
  categorySelectBtn = document.getElementById("categorySelectBtn");
  categorySelectLabel = document.getElementById("categorySelectLabel");
  categoryMenu = document.getElementById("categoryMenu");

  filterSelectBtn = document.getElementById("filterSelectBtn");
  filterSelectLabel = document.getElementById("filterSelectLabel");
  filterMenu = document.getElementById("filterMenu");

  // ✅ Prevent iOS/WebView from immediately triggering the document click close
  if (categorySelectBtn) {
    categorySelectBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu(categoryMenu, categorySelectBtn);
    });
  }

  if (filterSelectBtn) {
    filterSelectBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (filterSelectBtn.hidden) return;
      toggleMenu(filterMenu, filterSelectBtn);
    });
  }

  // ✅ Also stop propagation when clicking inside menus
  if (categoryMenu) {
    categoryMenu.addEventListener("click", (e) => e.stopPropagation());

    const items = Array.from(categoryMenu.querySelectorAll(".select-menu-item"));
    items.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedVenue) return;

        const cat = item.dataset.category;
        if (!cat) return;

        currentCategory = cat;
        currentSecondaryId = "all";

        if (categorySelectLabel) {
          categorySelectLabel.textContent = CATEGORY_LABELS[cat] || cat;
        }

        updateFilterUIForCategory(cat);

        closeMenus();
        loadPlacesForCategory(currentCategory, currentSecondaryId);
      });
    });
  }

  if (filterMenu) {
    filterMenu.addEventListener("click", (e) => e.stopPropagation());
  }

  // Close menus on outside click
  document.addEventListener("click", (e) => {
    if (!selectedVenue) return;

    const withinCategoryBtn = categorySelectBtn && categorySelectBtn.contains(e.target);
    const withinCategoryMenu = categoryMenu && categoryMenu.contains(e.target);

    const withinFilterBtn = filterSelectBtn && filterSelectBtn.contains(e.target);
    const withinFilterMenu = filterMenu && filterMenu.contains(e.target);

    if (!withinCategoryBtn && !withinCategoryMenu && !withinFilterBtn && !withinFilterMenu) {
      closeMenus();
    }
  });

  // ESC closes menus
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenus();
  });
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
  guidePanelEl = document.getElementById("guidePanel");
  guideResultsEl = document.getElementById("guideResults");

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

  setupVenueSearch();
  setupCategoryAndFilterUI();

  // Load venues, then Top Picks
  fetch("data/venues.json")
    .then(res => res.json())
    .then(data => {
      venues = data;

      // Attach a stable key for each venue (name+city+state)
      venues.forEach(v => {
        v.key = makeVenueKey(v.name, v.city, v.state);
      });

      createMarkers();

      // Load curated Top Picks (optional file)
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
