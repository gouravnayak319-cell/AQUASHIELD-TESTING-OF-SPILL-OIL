/**
 * AQUASHIELD
 * Interactive Tactical GIS, Satellite Overlay, Timeline Scrubber & AIS Attribution Controller
 */

// Global State
let map;
let activeScenarioId = "malacca_strait";
let currentScenario = null;
let activeSeverityFilter = "all";
let activeImageryLayer = "dark";
let activeVesselId = null;

let isTimelinePlaying = false;
let timelineInterval = null;
let currentTimelineHours = 0; // 0 is satellite acquisition time

// Leaflet Layer Groups
const layers = {
  slicks: L.layerGroup(),
  vesselTracks: L.layerGroup(),
  vesselMarkers: L.layerGroup(),
  sarOverlay: L.layerGroup(),
  metoceanVectors: L.layerGroup(),
  cpaMarkers: L.layerGroup()
};

// SAR Overlay Reference
let sarImageOverlay = null;

// ============================================================================
// SCENARIO BENCHMARK DATABASE
// ============================================================================
const SCENARIOS = {
  malacca_strait: {
    id: "malacca_strait",
    name: "Strait of Malacca",
    title: "Strait of Malacca - Active Tanker Discharge (Caught Red-Handed)",
    sector: "Traffic Separation Scheme (TSS)",
    coords: [2.4518, 101.8842],
    zoom: 12,
    satellite: "Sentinel-1B SAR C-Band (VV/VH)",
    acquisitionTime: "2026-09-10 03:14:22 UTC",
    sarImage: "/static/data/images/sar_malacca_active.png",
    sarBounds: [[2.36, 101.76], [2.54, 102.02]],
    sha256: "9a8f4c28b1e479d20c58e77a13d96924bcf085b31dfa6f44d82f7c031804f58c",
    environment: {
      current: "0.9 kn @ 310° NW",
      wind: "11.5 kn @ 140° SE",
      temp: "29.5°C",
      distanceToCoast: "18.5 km",
      sanctuaries: ["Port Dickson Marine Reserve", "Mangrove Forest Sanctuary"]
    },
    slicks: [
      {
        id: "slick-1",
        severity: "high",
        type: "True Black Heavy Crude Oil",
        bonnCode: "Code 5 (Heavy Black Oil Emulsion)",
        areaKm2: 16.5,
        volumeM3: 310.5,
        weatheringAgeHours: 4.8,
        color: "#ef4444",
        coords: [
          [2.4518, 101.8842],
          [2.4550, 101.8900],
          [2.4620, 101.8950],
          [2.4490, 101.9300],
          [2.4350, 101.9600],
          [2.4180, 101.9950],
          [2.3900, 102.0400],
          [2.3850, 102.0300],
          [2.4100, 101.9750],
          [2.4300, 101.9300],
          [2.4420, 101.8800]
        ]
      },
      {
        id: "slick-2",
        severity: "medium",
        type: "Discontinuous Metallic Sheen",
        bonnCode: "Code 3 (Metallic Luster)",
        areaKm2: 4.2,
        volumeM3: 28.0,
        weatheringAgeHours: 6.2,
        color: "#f97316",
        coords: [
          [2.4380, 101.9650],
          [2.4480, 101.9800],
          [2.4350, 102.0100],
          [2.4200, 101.9900]
        ]
      },
      {
        id: "slick-3",
        severity: "low",
        type: "Surface Rainbow Sheen",
        bonnCode: "Code 2 (Rainbow)",
        areaKm2: 2.1,
        volumeM3: 3.5,
        weatheringAgeHours: 8.0,
        color: "#f59e0b",
        coords: [
          [2.4650, 101.8700],
          [2.4720, 101.8850],
          [2.4600, 101.8950],
          [2.4520, 101.8780]
        ]
      }
    ],
    vessels: [
      {
        id: "vessel-1",
        mmsi: "352001928",
        imo: "9482190",
        name: "MT OCEAN PHOENIX",
        flag: "Panama",
        flagEmoji: "🇵🇦",
        type: "VLCC Crude Oil Tanker",
        dwt: "305,000 DWT",
        length: "333 m",
        cpaDistNm: 0.08,
        confidence: 94.8,
        confLevel: "high",
        course: "258° WSW",
        currentSpeed: "13.2 kn",
        anomaly: "Direct Stern-Plume Contact • Ballast Dump Speed Drop (14.5 → 3.4 kn)",
        isPrimarySuspect: true,
        // Trajectory points: [timeOffsetHours, lat, lon, speedKnots, heading]
        track: [
          [-48.0, 2.0500, 102.8000, 14.8, 258],
          [-36.0, 2.1500, 2.5000, 14.6, 258],
          [-24.0, 2.2500, 102.3500, 14.5, 258],
          [-12.0, 2.3300, 102.1500, 14.2, 258],
          [-4.0,  2.3800, 102.0400, 13.8, 258],
          [-2.0,  2.4100, 101.9800, 3.4,  258], // Discharge event slowdown!
          [-1.0,  2.4450, 101.9250, 8.5,  258],
          [0.0,   2.4620, 101.8950, 13.2, 258]  // Acquisition time
        ]
      },
      {
        id: "vessel-2",
        mmsi: "211348000",
        imo: "9811002",
        name: "EVER GLORY",
        flag: "Germany",
        flagEmoji: "🇩🇪",
        type: "Container Ship (14,000 TEU)",
        dwt: "155,000 DWT",
        length: "366 m",
        cpaDistNm: 4.82,
        confidence: 18.2,
        confLevel: "low",
        course: "260° WSW",
        currentSpeed: "17.8 kn",
        anomaly: "Normal Container Transit • Constant Speed Profile",
        isPrimarySuspect: false,
        track: [
          [-48.0, 2.1000, 102.8500, 18.0, 260],
          [-24.0, 2.2200, 102.3800, 17.9, 260],
          [-12.0, 2.3100, 102.1000, 17.8, 260],
          [-2.0,  2.3700, 101.9000, 17.8, 260],
          [0.0,   2.4100, 101.8200, 17.8, 260]
        ]
      },
      {
        id: "vessel-3",
        mmsi: "636015999",
        imo: "9512301",
        name: "PACIFIC TRADER",
        flag: "Liberia",
        flagEmoji: "🇱🇷",
        type: "Capesize Bulk Carrier",
        dwt: "180,000 DWT",
        length: "292 m",
        cpaDistNm: 6.15,
        confidence: 12.5,
        confLevel: "low",
        course: "082° ENE",
        currentSpeed: "11.4 kn",
        anomaly: "Opposing TSS Lane • No Speed Anomaly",
        isPrimarySuspect: false,
        track: [
          [-48.0, 2.5500, 101.3000, 11.5, 82],
          [-24.0, 2.5000, 101.5500, 11.4, 82],
          [-12.0, 2.4700, 101.7500, 11.4, 82],
          [-2.0,  2.4600, 101.9500, 11.3, 82],
          [0.0,   2.4500, 102.0500, 11.4, 82]
        ]
      },
      {
        id: "vessel-4",
        mmsi: "563044000",
        imo: "9670014",
        name: "KOTA RAJA",
        flag: "Singapore",
        flagEmoji: "🇸🇬",
        type: "Feeder Container Ship",
        dwt: "28,000 DWT",
        length: "172 m",
        cpaDistNm: 8.40,
        confidence: 4.1,
        confLevel: "low",
        course: "255° WSW",
        currentSpeed: "15.0 kn",
        anomaly: "Inshore Feeder Route • Beyond Hydrodynamic Influence",
        isPrimarySuspect: false,
        track: [
          [-48.0, 2.2000, 102.6000, 15.2, 255],
          [-24.0, 2.3000, 102.2000, 15.1, 255],
          [-12.0, 2.3800, 101.9500, 15.0, 255],
          [0.0,   2.4800, 101.7500, 15.0, 255]
        ]
      }
    ]
  },

  persian_gulf: {
    id: "persian_gulf",
    name: "Persian Gulf",
    title: "Persian Gulf - Dark Ship Ghost Spill (AIS Transponder Blackout)",
    sector: "Strait of Hormuz Inbound Route",
    coords: [25.7400, 55.0500],
    zoom: 11,
    satellite: "Sentinel-1A SAR C-Band",
    acquisitionTime: "2026-09-08 18:22:10 UTC",
    sarImage: "/static/data/images/sar_persian_gulf_drifted.png",
    sarBounds: [[25.55, 54.85], [25.92, 55.28]],
    sha256: "b45c2901ee78120fa8d9e273010b9918dfca6b7134aa4e10b427928e192c0021",
    environment: {
      current: "1.2 kn @ 215° SW",
      wind: "14.0 kn @ 330° NNW",
      temp: "32.0°C",
      distanceToCoast: "34.0 km",
      sanctuaries: ["Coral Reef Marine Sanctuary", "Pearl Oyster Beds"]
    },
    slicks: [
      {
        id: "slick-pg-1",
        severity: "high",
        type: "Weathered Heavy Crude Emulsion",
        bonnCode: "Code 4 (True Oil)",
        areaKm2: 22.4,
        volumeM3: 420.0,
        weatheringAgeHours: 14.5,
        color: "#ef4444",
        coords: [
          [25.7400, 55.0500],
          [25.7800, 55.0900],
          [25.8200, 55.1500],
          [25.8000, 55.2100],
          [25.7300, 55.1700],
          [25.6800, 55.0900],
          [25.6900, 55.0200]
        ]
      },
      {
        id: "slick-pg-2",
        severity: "medium",
        type: "Metallic & Rainbow Fringe",
        bonnCode: "Code 3 (Metallic)",
        areaKm2: 6.8,
        volumeM3: 45.0,
        weatheringAgeHours: 16.0,
        color: "#f97316",
        coords: [
          [25.6700, 55.0100],
          [25.6900, 55.0600],
          [25.6500, 55.0900],
          [25.6200, 55.0300]
        ]
      }
    ],
    vessels: [
      {
        id: "vessel-pg-1",
        mmsi: "636019941",
        imo: "9312890",
        name: "SEA TITAN",
        flag: "Liberia",
        flagEmoji: "🇱🇷",
        type: "Suezmax Crude Oil Tanker",
        dwt: "158,000 DWT",
        length: "274 m",
        cpaDistNm: 0.14,
        confidence: 89.8,
        confLevel: "high",
        course: "198° SSW",
        currentSpeed: "12.4 kn",
        anomaly: "48-Minute AIS Transponder Blackout over Release Origin • Slowdown to 3.8 kn",
        isPrimarySuspect: true,
        track: [
          [-48.0, 26.6000, 55.8000, 13.5, 198],
          [-24.0, 26.2000, 55.4500, 13.4, 198],
          [-14.5, 25.8400, 55.1600, 3.8,  198], // Blackout begins, slows down
          [-13.7, 25.7800, 55.1100, 3.8,  198], // Blackout ends, transponder re-engages
          [-6.0,  25.6000, 54.9500, 12.0, 198],
          [0.0,   25.4000, 54.7500, 12.4, 198]
        ]
      },
      {
        id: "vessel-pg-2",
        mmsi: "466022100",
        imo: "9401124",
        name: "AL WASL",
        flag: "Qatar",
        flagEmoji: "🇶🇦",
        type: "LNG Carrier (Q-Max)",
        dwt: "128,000 DWT",
        length: "345 m",
        cpaDistNm: 3.80,
        confidence: 21.0,
        confLevel: "low",
        course: "205° SSW",
        currentSpeed: "18.2 kn",
        anomaly: "Commercial LNG Carrier • Verified Clean AIS Log",
        isPrimarySuspect: false,
        track: [
          [-48.0, 26.7000, 55.9000, 18.5, 205],
          [-24.0, 26.3000, 55.5000, 18.2, 205],
          [-12.0, 25.9000, 55.2000, 18.2, 205],
          [0.0,   25.3000, 54.7000, 18.2, 205]
        ]
      },
      {
        id: "vessel-pg-3",
        mmsi: "355018900",
        imo: "9722300",
        name: "GAS ODYSSEY",
        flag: "Panama",
        flagEmoji: "🇵🇦",
        type: "VLGC Gas Carrier",
        dwt: "55,000 DWT",
        length: "228 m",
        cpaDistNm: 7.20,
        confidence: 8.5,
        confLevel: "low",
        course: "025° NNE",
        currentSpeed: "14.5 kn",
        anomaly: "Northbound Outbound Channel",
        isPrimarySuspect: false,
        track: [
          [-48.0, 24.8000, 54.2000, 14.5, 25],
          [-24.0, 25.3000, 54.7000, 14.5, 25],
          [-12.0, 25.8000, 55.2000, 14.5, 25],
          [0.0,   26.3000, 55.7000, 14.5, 25]
        ]
      }
    ]
  },

  north_sea: {
    id: "north_sea",
    name: "North Sea",
    title: "North Sea - Offshore Platform & Support Vessel Discharge",
    sector: "Central Graben Basin",
    coords: [56.5500, 3.2100],
    zoom: 11,
    satellite: "Sentinel-1A SAR C-Band",
    acquisitionTime: "2026-09-09 11:45:00 UTC",
    sarImage: "/static/data/images/sar_north_sea_rig.png",
    sarBounds: [[56.40, 3.00], [56.70, 3.45]],
    sha256: "c18092ef940023a17c0938f9210bc9318efaa9182379bc028192837bc0192837",
    environment: {
      current: "0.8 kn @ 095° E",
      wind: "19.5 kn @ 265° W",
      temp: "11.2°C",
      distanceToCoast: "140 km",
      sanctuaries: ["North Sea Seabird Colonies", "Herring Spawning Grounds"]
    },
    slicks: [
      {
        id: "slick-ns-1",
        severity: "medium",
        type: "Offshore Condensate & Diesel",
        bonnCode: "Code 3 (Metallic)",
        areaKm2: 12.8,
        volumeM3: 185.0,
        weatheringAgeHours: 5.5,
        color: "#f97316",
        coords: [
          [56.5500, 3.2100],
          [56.5700, 3.2600],
          [56.5900, 3.3200],
          [56.5600, 3.3500],
          [56.5200, 3.2900],
          [56.5300, 3.2200]
        ]
      }
    ],
    vessels: [
      {
        id: "vessel-ns-1",
        mmsi: "257019800",
        imo: "9643210",
        name: "NORTH PROMOTER",
        flag: "Norway",
        flagEmoji: "🇳🇴",
        type: "Platform Supply Vessel (PSV)",
        dwt: "4,500 DWT",
        length: "88 m",
        cpaDistNm: 0.12,
        confidence: 74.2,
        confLevel: "med",
        course: "045° NE",
        currentSpeed: "3.2 kn",
        anomaly: "Loitering at Platform Ekofisk Alpha during Pressure Valve Blowout",
        isPrimarySuspect: true,
        track: [
          [-48.0, 56.4000, 3.0000, 11.2, 45],
          [-24.0, 56.5000, 3.1500, 6.5,  45],
          [-6.0,  56.5450, 3.2050, 2.1,  45],
          [0.0,   56.5500, 3.2100, 3.2,  45]
        ]
      },
      {
        id: "vessel-ns-2",
        mmsi: "232014000",
        imo: "9510098",
        name: "HIGHLAND NAVIGATOR",
        flag: "United Kingdom",
        flagEmoji: "🇬🇧",
        type: "Anchor Handling Tug (AHTS)",
        dwt: "3,800 DWT",
        length: "74 m",
        cpaDistNm: 1.45,
        confidence: 32.0,
        confLevel: "low",
        course: "180° S",
        currentSpeed: "8.5 kn",
        anomaly: "Standby Operations 1.4 nm West of Discharge",
        isPrimarySuspect: false,
        track: [
          [-48.0, 56.7000, 3.1000, 8.5, 180],
          [-24.0, 56.6000, 3.1500, 8.5, 180],
          [0.0,   56.5200, 3.1800, 8.5, 180]
        ]
      }
    ]
  },

  mediterranean_bloom: {
    id: "mediterranean_bloom",
    name: "Ligurian Sea",
    title: "Ligurian Sea - Natural Algae Bloom (Look-Alike False Alarm)",
    sector: "Sanctuary for Marine Mammals (Pelagos)",
    coords: [43.6200, 9.1500],
    zoom: 11,
    satellite: "Sentinel-2 MSI Optical Multispectral",
    acquisitionTime: "2026-09-07 10:15:33 UTC",
    sarImage: "/static/data/images/optical_mediterranean_lookalike.png",
    sarBounds: [[43.48, 8.95], [43.76, 9.35]],
    sha256: "d41d8cd98f00b204e9800998ecf8427e01289182390128391028391028390128",
    environment: {
      current: "0.4 kn @ 180° S",
      wind: "3.2 kn @ 045° NE (Calm Water)",
      temp: "24.5°C",
      distanceToCoast: "26.0 km",
      sanctuaries: ["Pelagos Sanctuary for Mediterranean Marine Mammals"]
    },
    slicks: [
      {
        id: "slick-med-1",
        severity: "low",
        type: "Biogenic Surfactant / Algae Bloom",
        bonnCode: "FALSE POSITIVE (Natural Chlorophyll-a)",
        areaKm2: 8.4,
        volumeM3: 0.0,
        weatheringAgeHours: 0.0,
        color: "#10b981",
        coords: [
          [43.6200, 9.1500],
          [43.6500, 9.2000],
          [43.6800, 9.1600],
          [43.6500, 9.1000],
          [43.6000, 9.1200]
        ]
      }
    ],
    vessels: [
      {
        id: "vessel-med-1",
        mmsi: "247001920",
        imo: "9214560",
        name: "MARE NOSTRUM",
        flag: "Italy",
        flagEmoji: "🇮🇹",
        type: "Ro-Pax Ferry",
        dwt: "7,500 DWT",
        length: "175 m",
        cpaDistNm: 0.60,
        confidence: 0.0,
        confLevel: "low",
        course: "135° SE",
        currentSpeed: "19.5 kn",
        anomaly: "Innocent Transit • Biological Surfactant Confirmed",
        isPrimarySuspect: false,
        track: [
          [-48.0, 43.9000, 8.8000, 19.5, 135],
          [-24.0, 43.7500, 9.0000, 19.5, 135],
          [0.0,   43.5800, 9.2500, 19.5, 135]
        ]
      }
    ]
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initLucide();
  initEventListeners();
  loadScenario("malacca_strait");
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Initialize Leaflet Map
function initMap() {
  map = L.map("leaflet-map", {
    center: [2.4518, 101.8842],
    zoom: 12,
    zoomControl: false,
    attributionControl: false
  });

  // Custom Zoom Control placed top-right below HUD
  L.control.zoom({ position: "bottomright" }).addTo(map);

  // CartoDB Dark Matter Base Tiles
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 18,
    subdomains: "abcd"
  }).addTo(map);

  // Add all layer groups to map
  for (let key in layers) {
    layers[key].addTo(map);
  }

  // Update HUD coordinates on mouse move
  map.on("mousemove", (e) => {
    const lat = e.latlng.lat.toFixed(4);
    const lon = e.latlng.lng.toFixed(4);
    const hud = document.getElementById("map-coords-hud");
    if (hud) {
      hud.textContent = `LAT: ${lat}° | LON: ${lon}°`;
    }
  });

  map.on("zoomend", () => {
    const zoomHud = document.getElementById("map-zoom-hud");
    if (zoomHud) {
      zoomHud.textContent = `ZOOM: ${map.getZoom()}X`;
    }
  });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function initEventListeners() {
  // Scenario Dropdown Change
  const scenarioSelect = document.getElementById("scenario-select");
  if (scenarioSelect) {
    scenarioSelect.addEventListener("change", (e) => {
      loadScenario(e.target.value);
    });
  }

  // Severity Filter Buttons
  const severityBtns = document.querySelectorAll(".filter-badge-btn[data-severity]");
  severityBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      severityBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeSeverityFilter = btn.getAttribute("data-severity");
      renderSlicks();
      renderVesselList();
    });
  });

  // Imagery Layer Toggles
  const layerChips = document.querySelectorAll(".toggle-chip[data-layer]");
  layerChips.forEach(chip => {
    chip.addEventListener("click", () => {
      layerChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const layerType = chip.getAttribute("data-layer");
      setImageryLayer(layerType);
    });
  });

  // Timeline Slider & Play Button
  const timelineSlider = document.getElementById("timeline-slider");
  if (timelineSlider) {
    timelineSlider.addEventListener("input", (e) => {
      currentTimelineHours = parseFloat(e.target.value);
      updateTimelineDisplay();
      updateVesselPositionsAtTime(currentTimelineHours);
    });
  }

  const playBtn = document.getElementById("timeline-play-btn");
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      toggleTimelinePlay();
    });
  }

  // Dossier Modal Triggers
  const openDossierBtn = document.getElementById("btn-toggle-dossier");
  const openDossierSideBtn = document.getElementById("btn-open-dossier-panel");
  const caseDossierBtn = document.getElementById("btn-view-case-dossier");
  const closeDossierBtn = document.getElementById("btn-close-dossier");
  const modalOverlay = document.getElementById("dossier-modal-overlay");

  if (openDossierBtn) openDossierBtn.addEventListener("click", openDossierModal);
  if (openDossierSideBtn) openDossierSideBtn.addEventListener("click", openDossierModal);
  if (caseDossierBtn) caseDossierBtn.addEventListener("click", openDossierModal);
  if (closeDossierBtn) closeDossierBtn.addEventListener("click", closeDossierModal);

  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeDossierModal();
    });
  }

  // Print Dossier
  const printBtn = document.getElementById("btn-print-dossier");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Download JSON
  const dlBtn = document.getElementById("btn-download-json");
  if (dlBtn) {
    dlBtn.addEventListener("click", () => {
      downloadTelemetryJson();
    });
  }

  // Case Study Image Tabs
  const caseTabs = document.querySelectorAll(".case-tab-btn");
  const caseImg = document.getElementById("case-study-img");
  const caseSensorLabel = document.getElementById("case-sensor-label");

  caseTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      caseTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const imgPath = tab.getAttribute("data-img");
      if (caseImg) caseImg.src = imgPath;

      if (imgPath.includes("sar_malacca")) {
        caseSensorLabel.textContent = "SENSOR: SENTINEL-1B C-BAND";
      } else if (imgPath.includes("persian_gulf")) {
        caseSensorLabel.textContent = "SENSOR: SENTINEL-1A SAR (POL: VV)";
      } else {
        caseSensorLabel.textContent = "SENSOR: SENTINEL-2 MSI (OPTICAL)";
      }
    });
  });
}

// ============================================================================
// SCENARIO LOADING & RENDERING
// ============================================================================
function loadScenario(scenarioId) {
  if (!SCENARIOS[scenarioId]) return;
  activeScenarioId = scenarioId;
  currentScenario = SCENARIOS[scenarioId];

  // Stop any active timeline playback
  if (isTimelinePlaying) toggleTimelinePlay();
  currentTimelineHours = 0;
  const slider = document.getElementById("timeline-slider");
  if (slider) slider.value = "0";
  updateTimelineDisplay();

  // Update map view
  map.setView(currentScenario.coords, currentScenario.zoom, { animate: true });

  // Update Side Panel Metrics Header
  updateSidePanelMetrics();

  // Render Map Features
  renderSlicks();
  renderVesselTracks();
  updateVesselPositionsAtTime(0);
  renderVesselList();
  updateImageryOverlay();
  initLucide();
}

function updateSidePanelMetrics() {
  if (!currentScenario) return;

  const totalArea = currentScenario.slicks.reduce((acc, s) => acc + s.areaKm2, 0).toFixed(1);
  const totalVol = currentScenario.slicks.reduce((acc, s) => acc + s.volumeM3, 0).toFixed(1);
  const primary = currentScenario.vessels.find(v => v.isPrimarySuspect) || currentScenario.vessels[0];

  const areaElem = document.getElementById("panel-slick-area");
  const volElem = document.getElementById("panel-slick-volume");
  const ageElem = document.getElementById("panel-slick-age");
  const suspectElem = document.getElementById("panel-top-suspect");
  const badgeElem = document.getElementById("vessels-scanned-badge");

  if (areaElem) areaElem.textContent = `${totalArea} km²`;
  if (volElem) volElem.textContent = `${totalVol} m³`;
  if (ageElem) ageElem.textContent = `${currentScenario.slicks[0]?.weatheringAgeHours || 0} Hours`;
  if (suspectElem) {
    suspectElem.textContent = primary ? primary.name : "None Identified";
    suspectElem.className = primary && primary.confidence > 50 ? "val text-red" : "val text-green";
  }
  if (badgeElem) badgeElem.textContent = `${currentScenario.vessels.length} CANDIDATES`;
}

// ============================================================================
// MAP RENDERING: SLICKS, TRACKS & MARKERS
// ============================================================================
function renderSlicks() {
  layers.slicks.clearLayers();
  if (!currentScenario) return;

  currentScenario.slicks.forEach(slick => {
    // Filter check
    if (activeSeverityFilter !== "all" && slick.severity !== activeSeverityFilter) {
      return;
    }

    const color = slick.color;
    const polygon = L.polygon(slick.coords, {
      color: color,
      weight: 2,
      fillColor: color,
      fillOpacity: slick.severity === "high" ? 0.65 : 0.45,
      dashArray: slick.severity === "low" ? "4, 6" : null
    });

    const popupContent = `
      <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #f8fafc; min-width: 180px;">
        <div style="font-weight: 700; color: ${color}; margin-bottom: 4px; text-transform: uppercase;">
          ${slick.type}
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-bottom: 3px;">
          SEVERITY: <strong style="color: ${color};">${slick.severity.toUpperCase()}</strong>
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-bottom: 3px;">
          EST. VOLUME: <strong>${slick.volumeM3} m³</strong>
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-bottom: 3px;">
          SURFACE AREA: <strong>${slick.areaKm2} km²</strong>
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #94a3b8;">
          BONN: ${slick.bonnCode}
        </div>
      </div>
    `;

    polygon.bindPopup(popupContent);
    layers.slicks.addLayer(polygon);
  });
}

function renderVesselTracks() {
  layers.vesselTracks.clearLayers();
  if (!currentScenario) return;

  currentScenario.vessels.forEach(vessel => {
    const latLngs = vessel.track.map(pt => [pt[1], pt[2]]);
    const isSuspect = vessel.isPrimarySuspect;

    const trackLine = L.polyline(latLngs, {
      color: isSuspect ? "#ef4444" : "#06b6d4",
      weight: isSuspect ? 3 : 2,
      opacity: isSuspect ? 0.85 : 0.5,
      dashArray: isSuspect ? "6, 4" : "3, 6"
    });

    trackLine.bindTooltip(`${vessel.name} (${vessel.currentSpeed})`, {
      sticky: true,
      className: "font-mono"
    });

    layers.vesselTracks.addLayer(trackLine);
  });
}

// Calculate interpolated position along vessel track at historical time t (-48h to 0h)
function updateVesselPositionsAtTime(hoursOffset) {
  layers.vesselMarkers.clearLayers();
  layers.cpaMarkers.clearLayers();
  if (!currentScenario) return;

  currentScenario.vessels.forEach(vessel => {
    const pos = interpolateVesselPosition(vessel.track, hoursOffset);
    if (!pos) return;

    const isSuspect = vessel.isPrimarySuspect;
    const isSelected = vessel.id === activeVesselId;

    // Custom tactical vessel icon with heading arrow
    const iconHtml = `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transform: rotate(${pos.heading}deg);
      ">
        <div style="
          width: 22px;
          height: 22px;
          background: ${isSuspect ? '#ef4444' : '#06b6d4'};
          border: 2px solid ${isSelected ? '#fff' : '#050813'};
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 ${isSelected ? '16px' : '8px'} ${isSuspect ? '#ef4444' : '#06b6d4'};
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#050813" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 19 21 12 17 5 21 12 2"/>
          </svg>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: "vessel-marker-icon",
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([pos.lat, pos.lon], { icon: customIcon });

    const popupHtml = `
      <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #fff; min-width: 190px;">
        <div style="font-weight: 700; color: ${isSuspect ? '#fca5a5' : '#38bdf8'}; margin-bottom: 2px;">
          ${vessel.flagEmoji} ${vessel.name}
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 6px;">
          ${vessel.type} (${vessel.flag})
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-bottom: 2px;">
          SPEED: <strong>${pos.speed.toFixed(1)} kn</strong> | COG: <strong>${pos.heading}°</strong>
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-bottom: 2px;">
          CPA DIST: <strong>${vessel.cpaDistNm} nm</strong>
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: ${isSuspect ? '#ef4444' : '#10b981'};">
          CULPABILITY: <strong>${vessel.confidence}%</strong>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    marker.on("click", () => {
      selectVessel(vessel.id);
    });

    layers.vesselMarkers.addLayer(marker);

    // If suspect is at CPA window (-3h to -1h), draw a CPA warning circle
    if (isSuspect && hoursOffset <= -1.0 && hoursOffset >= -3.5) {
      const cpaCircle = L.circle([pos.lat, pos.lon], {
        radius: 400,
        color: "#ef4444",
        weight: 1.5,
        fillColor: "#ef4444",
        fillOpacity: 0.25,
        dashArray: "3, 3"
      });
      layers.cpaMarkers.addLayer(cpaCircle);
    }
  });
}

// Interpolate vessel position from track history
function interpolateVesselPosition(track, timeH) {
  if (!track || track.length === 0) return null;

  // Clamp time
  if (timeH <= track[0][0]) {
    return { lat: track[0][1], lon: track[0][2], speed: track[0][3], heading: track[0][4] };
  }
  if (timeH >= track[track.length - 1][0]) {
    const last = track[track.length - 1];
    return { lat: last[1], lon: last[2], speed: last[3], heading: last[4] };
  }

  // Find bounding segment
  for (let i = 0; i < track.length - 1; i++) {
    const p1 = track[i];
    const p2 = track[i + 1];
    if (timeH >= p1[0] && timeH <= p2[0]) {
      const span = p2[0] - p1[0];
      const alpha = span === 0 ? 0 : (timeH - p1[0]) / span;
      const lat = p1[1] + alpha * (p2[1] - p1[1]);
      const lon = p1[2] + alpha * (p2[2] - p1[2]);
      const speed = p1[3] + alpha * (p2[3] - p1[3]);
      const heading = p1[4];
      return { lat, lon, speed, heading };
    }
  }

  return { lat: track[0][1], lon: track[0][2], speed: track[0][3], heading: track[0][4] };
}

// ============================================================================
// TIMELINE SCRUBBER & ANIMATION PLAYBACK
// ============================================================================
function updateTimelineDisplay() {
  const timeText = document.getElementById("timeline-val-text");
  if (!timeText) return;

  if (currentTimelineHours === 0) {
    timeText.textContent = "0.0h (Acquisition Time)";
  } else {
    timeText.textContent = `T ${currentTimelineHours.toFixed(1)}h (${Math.abs(currentTimelineHours).toFixed(1)}h Hindcast)`;
  }
}

function toggleTimelinePlay() {
  const playBtnIcon = document.getElementById("play-btn-icon");

  if (isTimelinePlaying) {
    clearInterval(timelineInterval);
    isTimelinePlaying = false;
    if (playBtnIcon) playBtnIcon.setAttribute("data-lucide", "play");
  } else {
    isTimelinePlaying = true;
    if (playBtnIcon) playBtnIcon.setAttribute("data-lucide", "pause");

    // If already at end, rewind to -48h
    if (currentTimelineHours >= 0) {
      currentTimelineHours = -48.0;
    }

    timelineInterval = setInterval(() => {
      currentTimelineHours += 0.5;
      if (currentTimelineHours > 0) {
        currentTimelineHours = 0;
        toggleTimelinePlay(); // Stop when finished
      }

      const slider = document.getElementById("timeline-slider");
      if (slider) slider.value = currentTimelineHours.toString();
      updateTimelineDisplay();
      updateVesselPositionsAtTime(currentTimelineHours);
    }, 150);
  }

  initLucide();
}

// ============================================================================
// SIDE PANEL: RANKED CANDIDATE LIST & SELECTION
// ============================================================================
function renderVesselList() {
  const container = document.getElementById("vessel-cards-container");
  if (!container || !currentScenario) return;

  container.innerHTML = "";

  // Sort vessels by confidence descending
  const sortedVessels = [...currentScenario.vessels].sort((a, b) => b.confidence - a.confidence);

  sortedVessels.forEach((vessel, index) => {
    const isSuspect = vessel.isPrimarySuspect;
    const isSelected = vessel.id === activeVesselId;

    let confBadgeClass = "conf-low";
    if (vessel.confidence >= 70) confBadgeClass = "conf-high";
    else if (vessel.confidence >= 30) confBadgeClass = "conf-med";

    const card = document.createElement("div");
    card.className = `vessel-candidate-card ${isSuspect ? 'active-suspect' : ''} ${isSelected ? 'box-glow-cyan' : ''}`;
    card.id = `card-${vessel.id}`;

    card.innerHTML = `
      <div class="card-top-row">
        <div class="vessel-name-block">
          <span style="color: ${isSuspect ? 'var(--alert-red)' : 'var(--cyan-bright)'}; font-size: 11px;">
            #${index + 1}
          </span>
          <span>${vessel.flagEmoji} ${vessel.name}</span>
        </div>
        <div class="confidence-badge ${confBadgeClass}">
          ${vessel.confidence.toFixed(1)}% CONF
        </div>
      </div>

      <div class="card-vessel-type-row">
        <span>${vessel.type}</span>
        <span class="flag-badge">${vessel.flag}</span>
      </div>

      <div class="card-metrics-grid">
        <div class="c-metric">
          <span class="c-lbl">CPA DIST</span>
          <span class="c-val ${isSuspect ? 'text-red' : 'text-cyan'}">${vessel.cpaDistNm} nm</span>
        </div>
        <div class="c-metric">
          <span class="c-lbl">COURSE</span>
          <span class="c-val">${vessel.course}</span>
        </div>
        <div class="c-metric">
          <span class="c-lbl">SPEED</span>
          <span class="c-val">${vessel.currentSpeed}</span>
        </div>
      </div>

      ${vessel.anomaly ? `
        <div class="anomaly-alert-tag">
          <i data-lucide="alert-circle" class="w-3.5 h-3.5" style="flex-shrink:0;"></i>
          <span>${vessel.anomaly}</span>
        </div>
      ` : ''}
    `;

    card.addEventListener("click", () => {
      selectVessel(vessel.id);
    });

    container.appendChild(card);
  });

  initLucide();
}

function selectVessel(vesselId) {
  activeVesselId = vesselId;
  const vessel = currentScenario.vessels.find(v => v.id === vesselId);
  if (!vessel) return;

  // Center map on vessel's current position at slider time
  const pos = interpolateVesselPosition(vessel.track, currentTimelineHours);
  if (pos) {
    map.panTo([pos.lat, pos.lon], { animate: true });
  }

  // Highlight card in side panel
  document.querySelectorAll(".vessel-candidate-card").forEach(c => {
    c.classList.remove("box-glow-cyan");
  });
  const activeCard = document.getElementById(`card-${vesselId}`);
  if (activeCard) {
    activeCard.classList.add("box-glow-cyan");
    activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  updateVesselPositionsAtTime(currentTimelineHours);
}

// ============================================================================
// IMAGERY OVERLAY CONTROLS
// ============================================================================
function setImageryLayer(layerType) {
  activeImageryLayer = layerType;
  updateImageryOverlay();
}

function updateImageryOverlay() {
  layers.sarOverlay.clearLayers();
  layers.metoceanVectors.clearLayers();
  if (!currentScenario) return;

  if (activeImageryLayer === "sar" || activeImageryLayer === "optical") {
    // Render satellite image overlay
    if (currentScenario.sarImage && currentScenario.sarBounds) {
      sarImageOverlay = L.imageOverlay(currentScenario.sarImage, currentScenario.sarBounds, {
        opacity: 0.85,
        interactive: false
      });
      layers.sarOverlay.addLayer(sarImageOverlay);
    }
  } else if (activeImageryLayer === "drift") {
    // Render hydrodynamic drift vectors
    renderMetoceanDriftVectors();
  }
}

function renderMetoceanDriftVectors() {
  layers.metoceanVectors.clearLayers();
  if (!currentScenario) return;

  const center = currentScenario.coords;
  // Generate sample drift vector grid
  for (let dx = -0.08; dx <= 0.08; dx += 0.04) {
    for (let dy = -0.06; dy <= 0.06; dy += 0.03) {
      const start = [center[0] + dy, center[1] + dx];
      const end = [start[0] + 0.015, start[1] - 0.015]; // NW current vector
      
      const arrow = L.polyline([start, end], {
        color: "#06b6d4",
        weight: 1.5,
        opacity: 0.6
      });
      layers.metoceanVectors.addLayer(arrow);
    }
  }
}

// ============================================================================
// COURT-READY EVIDENCE DOSSIER MODAL
// ============================================================================
function openDossierModal() {
  if (!currentScenario) return;

  const primary = currentScenario.vessels.find(v => v.isPrimarySuspect) || currentScenario.vessels[0];
  const totalArea = currentScenario.slicks.reduce((acc, s) => acc + s.areaKm2, 0).toFixed(1);
  const totalVol = currentScenario.slicks.reduce((acc, s) => acc + s.volumeM3, 0).toFixed(1);

  // Populate modal fields
  const shaElem = document.getElementById("dossier-sha256");
  const idElem = document.getElementById("dossier-incident-id");
  const locElem = document.getElementById("dossier-location");
  const suspectNameElem = document.getElementById("dossier-suspect-name");
  const suspectMetaElem = document.getElementById("dossier-suspect-meta");
  const volElem = document.getElementById("dossier-volumetric-text");
  const originElem = document.getElementById("dossier-origin-text");

  if (shaElem) shaElem.textContent = currentScenario.sha256;
  if (idElem) idElem.textContent = `OSI-${currentScenario.id.toUpperCase()}-2026-084`;
  if (locElem) locElem.textContent = `${currentScenario.title} | Acquisition: ${currentScenario.acquisitionTime}`;
  
  if (suspectNameElem) {
    suspectNameElem.textContent = primary ? primary.name : "None Attributed";
    suspectNameElem.className = primary && primary.confidence > 50 ? "val text-red" : "val text-green";
  }

  if (suspectMetaElem && primary) {
    suspectMetaElem.textContent = `IMO ${primary.imo} | MMSI ${primary.mmsi} | Flag: ${primary.flag} | ${primary.type} (${primary.dwt})`;
  }

  if (volElem) {
    volElem.textContent = `Detected slick surface area of ${totalArea} km² with estimated total discharge volume of ${totalVol} m³ (~${(totalVol * 6.29).toFixed(0)} bbls). Exceeds IMO MARPOL Annex I instantaneous discharge limits of 15 ppm by orders of magnitude.`;
  }

  if (originElem && primary) {
    originElem.textContent = `Hydrodynamic Lagrangian backtracking computes release coordinates Lat: ${currentScenario.coords[0].toFixed(4)}°N, Lon: ${currentScenario.coords[1].toFixed(4)}°E. Target vessel ${primary.name} crossed within ${primary.cpaDistNm} nautical miles of origin point with anomalous speed drop (${primary.currentSpeed}).`;
  }

  const modalOverlay = document.getElementById("dossier-modal-overlay");
  if (modalOverlay) {
    modalOverlay.classList.add("open");
  }
}

function closeDossierModal() {
  const modalOverlay = document.getElementById("dossier-modal-overlay");
  if (modalOverlay) {
    modalOverlay.classList.remove("open");
  }
}

// Download Telemetry JSON
function downloadTelemetryJson() {
  if (!currentScenario) return;

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentScenario, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `AQUASHIELD_Evidence_Dossier_${currentScenario.id}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
