// Global configuration and state
let patternSets = []; // All available patterns (builtin + uploaded + local)
let activePatternSetIds = new Set(["builtin"]); // IDs of patterns currently in the active list
let assignedByIndex = [];
let selectedSetId = "builtin";
let selectedSetByIndex = [];
let selectedSetIds = new Set(["builtin"]); // Track multiple selected sets
let randomMode = false;
let rotateMode = false;
let patternSetOrder = [];

// Cache: setId -> Map<char, image>
const setIdToCharMap = new Map();

// LocalStorage key for pattern sets
const STORAGE_KEY_PATTERN_SETS = "patternConverter_uploadedPatternSets";

// Load uploaded pattern sets from localStorage
function loadPatternSetsFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PATTERN_SETS);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only load uploaded sets (builtin will be added separately)
      const uploadedSets = parsed.filter((set) => set.source === "uploaded");
      if (uploadedSets.length > 0) {
        patternSets.push(...uploadedSets);
      }
    }
  } catch (err) {
    console.error("Error loading pattern sets from storage:", err);
  }
}

// Save uploaded pattern sets to localStorage
function savePatternSetsToStorage() {
  try {
    // Only save uploaded sets (don't save builtin or local sets)
    const uploadedSets = patternSets.filter((set) => set.source === "uploaded");
    localStorage.setItem(STORAGE_KEY_PATTERN_SETS, JSON.stringify(uploadedSets));
  } catch (err) {
    console.error("Error saving pattern sets to storage:", err);
  }
}

// Initialize pattern sets from embedded data
function initPatternSets(embeddedImages) {
  const builtIn = (embeddedImages || []).map((img) => ({
    char: img.char,
    filename: img.filename,
  }));
  patternSets.push({
    id: "builtin",
    name: "Bộ mặc định",
    source: "builtin",
    images: builtIn,
  });
  
  // Load uploaded sets from localStorage
  loadPatternSetsFromStorage();
  
  // Initialize active list with builtin
  activePatternSetIds.add("builtin");
}

