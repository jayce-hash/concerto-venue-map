let map;
let venues = [];
let markers = [];
let selectedVenue = null;

let categoryButtons = [];
let guideResultsEl = null;
let secondaryFiltersEl = null;
let placesService = null;

let currentCategory = "restaurants";
let currentSecondaryId = "all";

let moreCategoriesBtn = null;
let filtersBtn = null;
let moreCategoriesMenu = null;

let guidePanelEl = null;

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

// Secondary filters per category
const SECONDARY_FILTERS = {
  restaurants: [
    { id: "all",     label: "All",           keyword: null },
    { id: "sitdown", label: "Sit-Down",      keyword: "sit down restaurant" },
    { id: "quick",   label: "Quick Bites",   keyword: "fast food" },
    { id: "brunch",  label: "Brunch",        keyword: "brunch" },
    { id: "pizza",   label: "Pizza",         keyword: "pizza" },
    { id: "vegan",   label: "Vegan-Friendly", keyword: "vegan restaurant" }
  ],
  hotels: [
    { id: "all",      label: "All",      keyword: null },
    { id: "boutique", label: "Boutique", keyword: "boutique hotel" },
    { id: "luxury",   label: "Luxury",   keyword: "luxury hotel" },
    { id: "budget",   label: "Budget",   keyword: "budget hotel" }
  ],
  bars: [
    { id: "all",      label: "All",        keyword: null },
    { id: "cocktail", label: "Cocktail",   keyword: "cocktail bar" },
    { id: "sports",   label: "Sports Bars", keyword: "sports bar" },
    { id: "rooftop",  label: "Rooftop",    keyword: "rooftop bar" }
  ],
  coffee: [
    { id: "all",       label: "All",        keyword: null },
    { id: "study",     label: "Study Spots", keyword: "coffee shop with wifi" },
    { id: "bakery",    label: "Bakery",     keyword: "bakery" },
    { id: "thirdwave", label: "Specialty",  keyword: "specialty coffee" }
  ]
};

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
  if (placeDetailsOverlay) {
    placeDetailsOverlay.hidden = true;
  }
}

function showPlaceDetails(place) {
  if (!placeDetailsOverlay) return;

  // Name
  detailsNameEl.textContent = place.name || "";

  // Meta: rating + review count + a simple type
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

  // Address
  detailsAddressEl.textContent =
    place.formatted_address || place.vicinity || "";

  // Phone
  if (place.formatted_phone_number) {
    detailsPhoneRowEl.hidden = false;
    detailsPhoneEl.textContent = place.formatted_phone_number;
    detailsPhoneEl.href =
      "tel:" + place.formatted_phone_number.replace(/\D/g, "");
  } else {
    detailsPhoneRowEl.hidden = true;
  }

  // Website
  if (place.website) {
    detailsWebsiteRowEl.hidden = false;
    detailsWebsiteEl.textContent = place.website.replace(/^https?:\/\//, "");
    detailsWebsiteEl.href = place.website;
  } else {
    detailsWebsiteRowEl.hidden = true;
  }

  // Maps link
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

  // Hours (if available)
  if (place.opening_hours && place.opening_hours.weekday_text) {
    detailsHoursEl.hidden = false;
    detailsHoursEl.textContent = place.opening_hours.weekday_text.join("\n");
  } else {
    detailsHoursEl.hidden = true;
  }

  placeDetailsOverlay.hidden = false;
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
  secondaryFiltersEl = document.getElementById("guideSecondaryFilters");
  moreCategoriesMenu = document.getElementById("moreCategoriesMenu");

  categoryButtons = Array.from(document.querySelectorAll(".guide-pill"));
  moreCategoriesBtn = document.getElementById("moreCategoriesBtn");
  filtersBtn = document.getElementById("filtersBtn");

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
  if (closeBtn) {
    closeBtn.addEventListener("click", hidePlaceDetails);
  }
  // Close when tapping the dimmed background, but not the card itself
  if (placeDetailsOverlay) {
    placeDetailsOverlay.addEventListener("click", (e) => {
      if (e.target === placeDetailsOverlay) hidePlaceDetails();
    });
  }

  setupCategoryPills();
  setupMainButtons();
  setupOutsideMenuClick();

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
  currentCategory = "restaurants";
  currentSecondaryId = "all";

  map.setZoom(13);
  map.panTo({ lat: venue.lat, lng: venue.lng });

google.maps.event.addListenerOnce(map, "idle", () => {
  const mapDiv = document.getElementById("map");
  const panel = document.getElementById("guidePanel");

  if (mapDiv && panel) {
    const panelHeight = panel.clientHeight;

    // Move the map down by ~70% of the panel height so the pin
    // sits nicely above the panel and below the header.
    const offset = panelHeight * 0.7;

    // Positive y moves the map down → pin appears higher on screen
    map.panBy(0, offset);
  } else if (mapDiv) {
    // fallback if panel can't be read for some reason
    map.panBy(0, mapDiv.clientHeight * 0.3);
  }
});

  const nameEl = document.getElementById("guideVenueName");
  const locEl = document.getElementById("guideVenueLocation");
  nameEl.textContent = venue.name;
  locEl.textContent = `${venue.city}, ${venue.state}`;

  // reset main pills
  if (categoryButtons.length) {
    categoryButtons.forEach(b => b.classList.remove("active"));
    const restaurantsBtn = categoryButtons.find(
      b => b.dataset.category === "restaurants"
    );
    if (restaurantsBtn) restaurantsBtn.classList.add("active");
  }

  renderSecondaryFilters(currentCategory, false);
  hideMoreCategoriesMenu();

  guidePanelEl.classList.remove("guide-panel--hidden");
  loadPlacesForCategory(currentCategory, currentSecondaryId);
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

function setupCategoryPills() {
  if (!categoryButtons.length) return;
  categoryButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (!selectedVenue) return;
      categoryButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.dataset.category || "restaurants";
      currentSecondaryId = "all";
      renderSecondaryFilters(currentCategory, false); // hide filters initially
      hideMoreCategoriesMenu();
      loadPlacesForCategory(currentCategory, currentSecondaryId);
    });
  });
}

function setupMainButtons() {
  if (moreCategoriesBtn) {
    moreCategoriesBtn.addEventListener("click", () => {
      if (!selectedVenue) return;
      const isHidden = moreCategoriesMenu.hidden;
      if (isHidden) {
        moreCategoriesMenu.hidden = false;
      } else {
        hideMoreCategoriesMenu();
      }
    });
  }
  if (filtersBtn) {
    filtersBtn.addEventListener("click", () => {
      if (!selectedVenue) return;
      const defs = SECONDARY_FILTERS[currentCategory];
      if (!defs || !defs.length) {
        // no filters for this category
        secondaryFiltersEl.hidden = true;
        secondaryFiltersEl.innerHTML = "";
        return;
      }
      // toggle visibility
      secondaryFiltersEl.hidden = !secondaryFiltersEl.hidden;
      if (!secondaryFiltersEl.hidden && !secondaryFiltersEl.hasChildNodes()) {
        renderSecondaryFilters(currentCategory, true);
      }
    });
  }

  if (moreCategoriesMenu) {
    const items = Array.from(
      moreCategoriesMenu.querySelectorAll(".guide-menu-item")
    );
    items.forEach(item => {
      item.addEventListener("click", () => {
        const cat = item.dataset.category;
        if (!cat) return;
        currentCategory = cat;
        currentSecondaryId = "all";

        // visually unselect main pills (they represent the "core 4")
        categoryButtons.forEach(b => b.classList.remove("active"));
        hideMoreCategoriesMenu();
        renderSecondaryFilters(currentCategory, false);
        loadPlacesForCategory(currentCategory, currentSecondaryId);
      });
    });
  }
}

function hideMoreCategoriesMenu() {
  if (moreCategoriesMenu) moreCategoriesMenu.hidden = true;
}

function setupOutsideMenuClick() {
  document.addEventListener("click", e => {
    if (!moreCategoriesMenu || moreCategoriesMenu.hidden) return;
    const withinMenu = moreCategoriesMenu.contains(e.target);
    const withinButton =
      moreCategoriesBtn && moreCategoriesBtn.contains(e.target);
    if (!withinMenu && !withinButton) {
      hideMoreCategoriesMenu();
    }
  });
}

function renderSecondaryFilters(catKey, keepVisible) {
  if (!secondaryFiltersEl) return;
  const defs = SECONDARY_FILTERS[catKey];
  secondaryFiltersEl.innerHTML = "";

  if (!defs || !defs.length) {
    secondaryFiltersEl.hidden = true;
    return;
  }

  if (!keepVisible) {
    secondaryFiltersEl.hidden = true; // only show when Filters is tapped
  }

  defs.forEach(def => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "guide-secondary-pill" + (def.id === "all" ? " active" : "");
    b.textContent = def.label;

    b.addEventListener("click", () => {
      currentSecondaryId = def.id;
      Array.from(
        secondaryFiltersEl.querySelectorAll(".guide-secondary-pill")
      ).forEach(el => el.classList.remove("active"));
      b.classList.add("active");
      loadPlacesForCategory(currentCategory, currentSecondaryId);
    });

    secondaryFiltersEl.appendChild(b);
  });
}

function loadPlacesForCategory(catKey, subFilterId) {
  if (!placesService || !selectedVenue) return;

  const baseCfg =
    CATEGORY_SEARCH_CONFIG[catKey] || CATEGORY_SEARCH_CONFIG.restaurants;

  const request = {
    location: new google.maps.LatLng(selectedVenue.lat, selectedVenue.lng),
    radius: baseCfg.radius || 3000
  };

  if (baseCfg.type) request.type = baseCfg.type;
  let keyword = baseCfg.keyword || null;

  const defs = SECONDARY_FILTERS[catKey];
  if (defs && subFilterId) {
    const match = defs.find(d => d.id === subFilterId);
    if (match && match.keyword) {
      keyword = match.keyword;
    }
  }
  if (keyword) request.keyword = keyword;

  if (guideResultsEl) {
    guideResultsEl.innerHTML =
      '<div class="hint">Loading nearby places…</div>';
  }

  placesService.nearbySearch(request, (results, status) => {
    if (!guideResultsEl) return;

    if (
      status !== google.maps.places.PlacesServiceStatus.OK ||
      !results
    ) {
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
      const meters = distanceMeters(
        selectedVenue.lat,
        selectedVenue.lng,
        lat2,
        lng2
      );
      const miles = metersToMiles(meters);
      bits.push(`${miles.toFixed(1)} mi`);
    }

    if (place.rating) bits.push(`${place.rating.toFixed(1)}★`);

    meta.textContent = bits.join(" • ");

    card.appendChild(name);
    card.appendChild(meta);

    // Click → in-app details sheet using Places Details API
    card.addEventListener("click", () => {
      if (!placesService || !place.place_id) {
        // fallback: show what we already have
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
        if (
          status === google.maps.places.PlacesServiceStatus.OK &&
          details
        ) {
          showPlaceDetails(details);
        } else {
          showPlaceDetails(place);
        }
      });
    });

    guideResultsEl.appendChild(card);
  });
}
