let map;
let venues = [];
let markers = [];
let selectedVenue = null;

let placesService = null;
let guidePanelEl = null;
let guideResultsEl = null;

// --- Category pill (single dropdown menu) ---
let categoryPillBtn = null;
let categoryPillLabel = null;
let categoryMenu = null;

// --- Name search pill ---
let placeNameSearchEl = null;
let clearNameSearchBtn = null;

// --- Existing venue search UI (top search bar) ---
let venueSearchInput = null;
let venueSearchResultsEl = null;

// Back button
let backToMapBtn = null;

let expandPanelBtn = null;
let isGuideExpanded = false;

// Top Picks data
let topPicksByKey = {};

// --- Place details overlay elements ---
let placeDetailsOverlay = null;
let detailsNameEl = null;
let detailsMetaEl = null;
let detailsAddressEl = null;

let detailsPhoneBtnEl = null;
let detailsWebsiteBtnEl = null;

let detailsMapsLinkEl = null;
let detailsHoursEl = null;

// State
let currentCategory = "restaurants";
let currentSecondaryId = "all";

// Single menu mode
let menuMode = "categories"; // "categories" | "filters"
let lastCategoryPicked = "restaurants";

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

const CATEGORY_ORDER = [
  "restaurants",
  "hotels",
  "bars",
  "coffee",
  "transit",
  "attractions",
  "retail",
  "pharmacies",
  "gas",
  "grocery"
];

// Base category → Places search config
const CATEGORY_SEARCH_CONFIG = {
  restaurants: { type: "restaurant", radius: 3000 },
  bars: { type: "bar", radius: 3000 },
  coffee: { type: "cafe", radius: 3000 },
  hotels: { type: "lodging", radius: 4000 },
  retail: { keyword: "shopping", radius: 4000 },
  attractions: { type: "tourist_attraction", radius: 5000 },
  transit: { type: "transit_station", radius: 4000 },
  pharmacies: { type: "pharmacy", radius: 3000 },
  gas: { type: "gas_station", radius: 4000 },
  grocery: { keyword: "grocery store", radius: 4000 }
};

// “Good filters” (not too many, but useful)
const SECONDARY_FILTERS = {
  restaurants: [
    { id: "all", label: "All", keyword: null },
    { id: "sitdown", label: "Sit-Down", keyword: "sit down restaurant" },
    { id: "quick", label: "Quick Bites", keyword: "fast food" },
    { id: "brunch", label: "Brunch", keyword: "brunch" },
    { id: "pizza", label: "Pizza", keyword: "pizza" },
    { id: "vegan", label: "Vegan-Friendly", keyword: "vegan restaurant" }
  ],
  hotels: [
    { id: "all", label: "All", keyword: null },
    { id: "boutique", label: "Boutique", keyword: "boutique hotel" },
    { id: "luxury", label: "Luxury", keyword: "luxury hotel" },
    { id: "budget", label: "Budget", keyword: "budget hotel" }
  ],
  bars: [
    { id: "all", label: "All", keyword: null },
    { id: "cocktail", label: "Cocktail", keyword: "cocktail bar" },
    { id: "sports", label: "Sports Bars", keyword: "sports bar" },
    { id: "rooftop", label: "Rooftop", keyword: "rooftop bar" }
  ],
  coffee: [
    { id: "all", label: "All", keyword: null },
    { id: "study", label: "Study Spots", keyword: "coffee shop with wifi" },
    { id: "bakery", label: "Bakery", keyword: "bakery" },
    { id: "specialty", label: "Specialty", keyword: "specialty coffee" }
  ],
  attractions: [
    { id: "all", label: "All", keyword: null },
    { id: "museums", label: "Museums", keyword: "museum" },
    { id: "parks", label: "Parks", keyword: "park" },
    { id: "views", label: "Views", keyword: "observation deck" }
  ],
  retail: [
    { id: "all", label: "All", keyword: null },
    { id: "mall", label: "Malls", keyword: "mall" },
    { id: "clothing", label: "Clothing", keyword: "clothing store" },
    { id: "gifts", label: "Gifts", keyword: "gift shop" }
  ],
  transit: [
    { id: "all", label: "All", keyword: null },
    { id: "subway", label: "Subway", keyword: "subway station" },
    { id: "train", label: "Train", keyword: "train station" },
    { id: "bus", label: "Bus", keyword: "bus station" }
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

  // Title
  if (detailsNameEl) detailsNameEl.textContent = place.name || "";

  // Meta line: rating + type
  const bits = [];
  if (place.rating) {
    const rating = Number(place.rating).toFixed(1);
    const count = place.user_ratings_total;
    bits.push(`${rating}★${count ? ` (${count})` : ""}`);
  }
  if (place.types && place.types.length) {
    const prettyType = String(place.types[0]).replace(/_/g, " ");
    bits.push(prettyType);
  }
  if (detailsMetaEl) detailsMetaEl.textContent = bits.join(" • ");

  // Address
  if (detailsAddressEl) {
    detailsAddressEl.textContent = place.formatted_address || place.vicinity || "";
  }

  // --- Action buttons (Call / Website / Maps) ---

  // Call
  if (detailsPhoneBtnEl) {
    if (place.formatted_phone_number) {
      detailsPhoneBtnEl.hidden = false;
      detailsPhoneBtnEl.textContent = "Call";
      detailsPhoneBtnEl.href =
        "tel:" + String(place.formatted_phone_number).replace(/\D/g, "");
    } else {
      detailsPhoneBtnEl.hidden = true;
      detailsPhoneBtnEl.removeAttribute("href");
    }
  }

  // Website
  if (detailsWebsiteBtnEl) {
    if (place.website) {
      detailsWebsiteBtnEl.hidden = false;
      detailsWebsiteBtnEl.textContent = "Website";
      detailsWebsiteBtnEl.href = place.website;
      detailsWebsiteBtnEl.target = "_blank";
      detailsWebsiteBtnEl.rel = "noopener noreferrer";
    } else {
      detailsWebsiteBtnEl.hidden = true;
      detailsWebsiteBtnEl.removeAttribute("href");
    }
  }

  // Maps URL (keep your existing logic)
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
  if (detailsMapsLinkEl) {
    detailsMapsLinkEl.href = mapsUrl;
    detailsMapsLinkEl.target = "_blank";
    detailsMapsLinkEl.rel = "noopener noreferrer";
  }

  // Hours
  if (detailsHoursEl) {
    if (place.opening_hours && place.opening_hours.weekday_text) {
      detailsHoursEl.hidden = false;
      detailsHoursEl.textContent = place.opening_hours.weekday_text.join("\n");
    } else {
      detailsHoursEl.hidden = true;
      detailsHoursEl.textContent = "";
    }
  }

  placeDetailsOverlay.hidden = false;
}

// ---------- Menu positioning (place under pill, inside panel) ----------
function positionMenuUnderButton(menuEl, buttonEl) {
  if (!menuEl || !buttonEl || !guidePanelEl) return;

  const panelRect = guidePanelEl.getBoundingClientRect();
  const btnRect = buttonEl.getBoundingClientRect();
  const top = (btnRect.bottom - panelRect.top) + 6;
  menuEl.style.top = `${top}px`;
}

// ---------- Single dropdown menu (Categories -> Filters) ----------
function closeCategoryMenu() {
  if (!categoryMenu) return;
  categoryMenu.hidden = true;
  menuMode = "categories";
}

function openCategoryMenu(mode = "categories") {
  if (!categoryMenu || !categoryPillBtn) return;

  menuMode = mode;
  buildCategoryMenu(mode);
  positionMenuUnderButton(categoryMenu, categoryPillBtn);
  categoryMenu.hidden = false;
}

function buildCategoryMenu(mode) {
  if (!categoryMenu) return;
  categoryMenu.innerHTML = "";

  if (mode === "filters") {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "select-menu-item";
    back.textContent = "← Back to Categories";
    back.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCategoryMenu("categories");
    });
    categoryMenu.appendChild(back);
  }

  if (mode === "categories") {
    CATEGORY_ORDER.forEach(cat => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "select-menu-item";
      item.dataset.category = cat;
      item.textContent = CATEGORY_LABELS[cat] || cat;

      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedVenue) return;

        currentCategory = cat;
        currentSecondaryId = "all";
        lastCategoryPicked = cat;

        const defs = SECONDARY_FILTERS[cat];
        const hasFilters = defs && defs.length && cat !== "toppicks";

        const catLabel = CATEGORY_LABELS[cat] || cat;

        if (!hasFilters) {
          categoryPillLabel.textContent = catLabel;
          closeCategoryMenu();
          loadPlacesForCategory(currentCategory, currentSecondaryId);
          return;
        }

        categoryPillLabel.textContent = catLabel;
        openCategoryMenu("filters");
      });

      categoryMenu.appendChild(item);
    });
  }

  if (mode === "filters") {
    const defs = SECONDARY_FILTERS[lastCategoryPicked] || [];

    defs.forEach(def => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "select-menu-item";
      item.dataset.filterId = def.id;
      item.textContent = def.label;

      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        currentSecondaryId = def.id;

        const catLabel = CATEGORY_LABELS[lastCategoryPicked] || lastCategoryPicked;
        categoryPillLabel.textContent =
          def.id === "all" ? catLabel : `${catLabel} • ${def.label}`;

        closeCategoryMenu();
        loadPlacesForCategory(currentCategory, currentSecondaryId);
      });

      categoryMenu.appendChild(item);
    });
  }
}

function setupCategoryPillUI() {
  categoryPillBtn = document.getElementById("categoryPillBtn");
  categoryPillLabel = document.getElementById("categoryPillLabel");
  categoryMenu = document.getElementById("categoryMenu");

  if (!categoryPillBtn || !categoryPillLabel || !categoryMenu) return;

  // Prevent iOS webview “open then instantly close”
  categoryPillBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  categoryMenu.addEventListener("pointerdown", (e) => e.stopPropagation());

  categoryPillBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedVenue) return;

    if (!categoryMenu.hidden) {
      closeCategoryMenu();
      return;
    }
    openCategoryMenu("categories");
  });

  // Close on outside click
  document.addEventListener("pointerdown", (e) => {
    if (!categoryMenu || categoryMenu.hidden) return;
    const inside = categoryPillBtn.contains(e.target) || categoryMenu.contains(e.target);
    if (!inside) closeCategoryMenu();
  });

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCategoryMenu();
  });

  categoryPillLabel.textContent = "Search by Category";
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

  if (!placesService) return;

  const baseCfg = CATEGORY_SEARCH_CONFIG[catKey] || CATEGORY_SEARCH_CONFIG.restaurants;

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

  if (guideResultsEl) guideResultsEl.innerHTML = '<div class="hint">Loading nearby places…</div>';

  placesService.nearbySearch(request, (results, status) => {
    if (!guideResultsEl) return;

    if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
      guideResultsEl.innerHTML = '<div class="hint">No places found for this category here yet.</div>';
      return;
    }

    renderPlaces(results.slice(0, 20));
  });
}

// ----- Name search near venue (same cards) -----
function searchPlacesByName(query) {
  if (!selectedVenue || !placesService) return;
  const q = (query || "").trim();

  if (!q) {
    loadPlacesForCategory(currentCategory, currentSecondaryId);
    return;
  }

  if (guideResultsEl) guideResultsEl.innerHTML = '<div class="hint">Searching…</div>';

  // Use a bounds bias near the venue
  const center = new google.maps.LatLng(selectedVenue.lat, selectedVenue.lng);
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(new google.maps.LatLng(selectedVenue.lat + 0.05, selectedVenue.lng + 0.05));
  bounds.extend(new google.maps.LatLng(selectedVenue.lat - 0.05, selectedVenue.lng - 0.05));

  const request = {
    query: q,
    location: center,
    radius: 6000,
    bounds
  };

  placesService.textSearch(request, (results, status) => {
    if (!guideResultsEl) return;

    if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
      guideResultsEl.innerHTML = '<div class="hint">No results found for that search.</div>';
      return;
    }

    renderPlaces(results.slice(0, 20));
  });
}

function setupNameSearchUI() {
  placeNameSearchEl = document.getElementById("placeNameSearch");
  clearNameSearchBtn = document.getElementById("clearNameSearch");

  if (!placeNameSearchEl) return;

  let t = null;

  placeNameSearchEl.addEventListener("input", () => {
    if (!selectedVenue) return;
    const val = placeNameSearchEl.value;
    if (t) clearTimeout(t);
    t = setTimeout(() => searchPlacesByName(val), 250);
  });

  placeNameSearchEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchPlacesByName(placeNameSearchEl.value);
    }
  });

  if (clearNameSearchBtn) {
    clearNameSearchBtn.addEventListener("click", () => {
      placeNameSearchEl.value = "";
      loadPlacesForCategory(currentCategory, currentSecondaryId);
      placeNameSearchEl.focus();
    });
  }
}

function getTopPicksForSelectedVenue() {
  if (!selectedVenue) return [];
  const key = selectedVenue.key || makeVenueKey(selectedVenue.name, selectedVenue.city, selectedVenue.state);
  return topPicksByKey[key] || [];
}

function renderTopPicksInline() {
  const picks = getTopPicksForSelectedVenue();
  if (!picks.length) return;

  const wrap = document.createElement("div");
  wrap.className = "top-picks-block";

  picks.forEach(item => {
    const card = document.createElement("div");
    card.className = "place-card top-pick-card";

    // --- Title row: name + Top Pick badge ---
const titleRow = document.createElement("div");
titleRow.style.display = "flex";
titleRow.style.alignItems = "center";
titleRow.style.justifyContent = "flex-start";
titleRow.style.gap = "10px";

const nameEl = document.createElement("p");
nameEl.className = "place-name";
nameEl.textContent = item.name || "Top Pick";
nameEl.style.margin = "0";

const badgeEl = document.createElement("span");
badgeEl.className = "place-meta"; // keeps same color + font
badgeEl.textContent = "Concerto Top Pick";
badgeEl.style.display = "flex";
badgeEl.style.alignItems = "center";
badgeEl.style.gap = "4px";

const star = document.createElement("span");
star.textContent = "★";

badgeEl.prepend(star);
badgeEl.style.whiteSpace = "nowrap";

titleRow.appendChild(nameEl);
titleRow.appendChild(badgeEl);

// --- Address line ---
const addressEl = document.createElement("p");
addressEl.className = "place-meta";
addressEl.textContent = item.address || "";
addressEl.style.margin = "4px 0 0";

// --- Description line ---
const notesEl = document.createElement("p");
notesEl.className = "place-meta";
notesEl.textContent = item.notes || "";
notesEl.style.margin = "2px 0 0";

// Append in order
card.appendChild(titleRow);
if (item.address) card.appendChild(addressEl);
if (item.notes) card.appendChild(notesEl);
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

      // Maps URL fallbacks
      let mapsUrl;
      if (item.mapsUrl) {
        mapsUrl = item.mapsUrl;
      } else if (item.placeId) {
        const base =
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent(item.name || "");
        mapsUrl = base + "&query_place_id=" + encodeURIComponent(item.placeId);
      } else {
        mapsUrl =
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent((item.name || "") + " " + (item.address || ""));
      }

      pseudoPlace.url = mapsUrl;
      showPlaceDetails(pseudoPlace);
    });

    wrap.appendChild(card);
  });

  guideResultsEl.appendChild(wrap);
}

function renderPlaces(places) {
  guideResultsEl.innerHTML = "";

  // ✅ Only prepend Top Picks when NOT using the name search
  const nameQuery = (placeNameSearchEl && placeNameSearchEl.value || "").trim();
  if (!nameQuery) {
    renderTopPicksInline();
  }

  if (!places.length) {
    // If there are top picks, don't show "no places" too aggressively
    if (!getTopPicksForSelectedVenue().length) {
      guideResultsEl.innerHTML = '<div class="hint">No places found for this category here yet.</div>';
    }
    return;
  }

  // ...keep the rest of your existing renderPlaces code the same...

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

    if (place.rating) bits.push(`${Number(place.rating).toFixed(1)}★`);
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

function setGuideExpanded(expanded) {
  isGuideExpanded = !!expanded;

  if (!guidePanelEl) return;

  if (isGuideExpanded) {
    guidePanelEl.classList.add("guide-panel--expanded");
    guidePanelEl.classList.remove("guide-panel--hidden");
    if (expandPanelBtn) expandPanelBtn.textContent = "Collapse";
  } else {
    guidePanelEl.classList.remove("guide-panel--expanded");
    if (expandPanelBtn) expandPanelBtn.textContent = "Expand";
  }

  // Re-position the dropdown menu if it's open (so it stays under the pill)
  requestAnimationFrame(() => {
    if (categoryMenu && !categoryMenu.hidden && categoryPillBtn) {
      positionMenuUnderButton(categoryMenu, categoryPillBtn);
    }
  });
}

// ----- “Back to main map” -----
function ensureBackButton() {
  if (!guidePanelEl) return;

  const header = guidePanelEl.querySelector(".guide-header");
  if (!header) return;

  // If buttons already exist, just re-hook references
  if (document.getElementById("backToMapBtn")) {
    backToMapBtn = document.getElementById("backToMapBtn");
    expandPanelBtn = document.getElementById("expandPanelBtn");
    return;
  }

  // --- RIGHT SIDE BUTTON GROUP ---
  const right = document.createElement("div");
  right.className = "guide-header-actions";
  // inline styling so you don't have to touch CSS if you don't want to
  right.style.display = "flex";
  right.style.gap = "10px";
  right.style.alignItems = "center";
  right.style.marginLeft = "auto";
  right.style.flex = "0 0 auto";

  // helper to style both buttons the same
  const styleHeaderBtn = (b) => {
    b.style.border = "1px solid #E2E7F0";
    b.style.background = "#fff";
    b.style.borderRadius = "999px";
    b.style.padding = "7px 12px";
    b.style.fontSize = "0.85rem";
    b.style.color = "#121E36";
    b.style.boxShadow = "0 4px 10px rgba(18, 30, 54, 0.10)";
    b.style.cursor = "pointer";
    b.style.flex = "0 0 auto";
    b.style.whiteSpace = "nowrap";
  };

  // --- Expand (left) ---
  const exp = document.createElement("button");
  exp.id = "expandPanelBtn";
  exp.type = "button";
  exp.textContent = isGuideExpanded ? "Collapse" : "Expand";
  styleHeaderBtn(exp);

  exp.addEventListener("click", () => {
    closeCategoryMenu();
    hidePlaceDetails();
    setGuideExpanded(!isGuideExpanded);
  });

  // --- Back (right) ---
  const btn = document.createElement("button");
  btn.id = "backToMapBtn";
  btn.type = "button";
  btn.textContent = "Back";
  styleHeaderBtn(btn);

  btn.addEventListener("click", () => {
    closeCategoryMenu();
    hidePlaceDetails();
    setGuideExpanded(false); // always reset expanded mode

    selectedVenue = null;
    currentCategory = "restaurants";
    currentSecondaryId = "all";
    lastCategoryPicked = "restaurants";
    menuMode = "categories";

    if (placeNameSearchEl) placeNameSearchEl.value = "";
    if (categoryPillLabel) categoryPillLabel.textContent = "Search by Category";

    if (guidePanelEl) guidePanelEl.classList.add("guide-panel--hidden");
    if (guideResultsEl) guideResultsEl.innerHTML = "";

    map.setZoom(4);
    map.panTo({ lat: 39.5, lng: -98.35 });
  });

  right.appendChild(exp);
  right.appendChild(btn);
  header.appendChild(right);

  expandPanelBtn = exp;
  backToMapBtn = btn;
}

function focusVenue(venue) {
  if (!venue || !venue.lat || !venue.lng) return;

  selectedVenue = venue;

  currentCategory = "restaurants";
  currentSecondaryId = "all";
  lastCategoryPicked = "restaurants";
  menuMode = "categories";

  closeCategoryMenu();

  map.setZoom(13);
  map.panTo({ lat: venue.lat, lng: venue.lng });

  google.maps.event.addListenerOnce(map, "idle", () => {
    const panel = document.getElementById("guidePanel");
    if (panel) {
      const panelHeight = panel.clientHeight;
      map.panBy(0, panelHeight * 0.7);
    }
  });

  const nameEl = document.getElementById("guideVenueName");
  const locEl = document.getElementById("guideVenueLocation");
  if (nameEl) nameEl.textContent = venue.name;
  if (locEl) locEl.textContent = `${venue.city}, ${venue.state}`;

  if (categoryPillLabel) categoryPillLabel.textContent = "Search by Category";
  if (placeNameSearchEl) placeNameSearchEl.value = "";

if (guidePanelEl) guidePanelEl.classList.remove("guide-panel--hidden");
ensureBackButton();
setGuideExpanded(false);

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
  detailsPhoneBtnEl = document.getElementById("detailsPhoneBtn");
  detailsWebsiteBtnEl = document.getElementById("detailsWebsiteBtn");
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
  setupCategoryPillUI();
  setupNameSearchUI();

  // Load venues, then Top Picks
  fetch("data/venues.json")
    .then(res => res.json())
    .then(data => {
      venues = data;

      venues.forEach(v => {
        v.key = makeVenueKey(v.name, v.city, v.state);
      });

      createMarkers();

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
