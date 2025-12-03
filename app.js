let map;
let venues = [];
let markers = [];
let selectedVenue = null;

let categoryButtons = [];
let guideIframeEl = null;

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

// helper: add or replace ?cat= in the guide URL
function withCategory(url, cat) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (cat) u.searchParams.set("cat", cat);
    return u.toString();
  } catch (e) {
    // relative or non-standard URL: simple fallback
    const sep = url.includes("?") ? "&" : "?";
    return cat ? `${url}${sep}cat=${encodeURIComponent(cat)}` : url;
  }
}

// Make initMap visible for Google callback
window.initMap = function () {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 39.5, lng: -98.35 }, // rough US center
    zoom: 4,
    disableDefaultUI: true,
    zoomControl: true
  });

  guideIframeEl = document.getElementById("guideIframe");
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

  // reset active pill to Restaurants by default
  if (categoryButtons.length) {
    categoryButtons.forEach(b => b.classList.remove("active"));
    const defaultBtn = categoryButtons.find(b => b.dataset.category === "restaurants");
    if (defaultBtn) defaultBtn.classList.add("active");
  }

  if (guideIframeEl) {
    guideIframeEl.src = withCategory(venue.guideUrl || "", "restaurants");
  }

  guidePanel.classList.remove("guide-panel--hidden");
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

  // Typing shows dropdown suggestions
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

  // Pressing "Go"/Enter jumps directly to best match
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

  // Hide dropdown if you tap elsewhere
  document.addEventListener("click", (e) => {
    if (!resultsEl.contains(e.target) && e.target !== input) {
      resultsEl.classList.remove("visible");
    }
  });
}

function setupCategoryPills() {
  if (!categoryButtons.length || !guideIframeEl) return;

  categoryButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (!selectedVenue) return;

      categoryButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const cat = btn.dataset.category || "";
      guideIframeEl.src = withCategory(selectedVenue.guideUrl || "", cat);
    });
  });
}
