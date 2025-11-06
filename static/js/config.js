// Global configuration and state
let patternSets = []; // All available patterns (builtin + uploaded + local)
let activePatternSetIds = new Set(); // IDs of patterns currently in the active list
let assignedByIndex = [];
let selectedSetId = null;
let selectedSetByIndex = [];
let selectedSetIds = new Set(); // Track multiple selected sets
let randomMode = false;
let rotateMode = false;
let patternSetOrder = [];
// Track used pattern sets in current sequence for random mode
let usedPatternSetsInSequence = new Set();

// Cache: setId -> Map<char, image>
const setIdToCharMap = new Map();

// MongoDB-backed API helpers
async function loadUploadedPatternSetsFromServer() {
  try {
    const res = await fetch("/api/pattern-sets?includeBuiltin=1", { cache: "no-store" });
    if (!res.ok) return;
    const fetchedSets = await res.json();
    if (Array.isArray(fetchedSets) && fetchedSets.length) {
      const existingIds = new Set(patternSets.map((s) => s.id));
      fetchedSets.forEach((s) => {
        if (!existingIds.has(s.id)) patternSets.push(s);
      });
    }
  } catch (err) {
    console.error("Error loading pattern sets from server:", err);
  }
}

async function savePatternSetToServer(set) {
  try {
    const res = await fetch("/api/pattern-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: set.name, images: set.images || [] }),
    });
    if (!res.ok) throw new Error("Save failed");
    const saved = await res.json();
    return saved; // { id, name, source, images }
  } catch (err) {
    console.error("Error saving pattern set to server:", err);
    return null;
  }
}

// Initialize pattern sets from embedded data
function initPatternSets(_embeddedImages) {
  // Ignore embedded builtin to avoid duplicates; load from server instead
  loadUploadedPatternSetsFromServer()?.then(() => {
    try {
      // Initialize active sets conservatively:
      // Only activate builtin by default (if exists). Others remain in available list.
      if (patternSets.length > 0 && activePatternSetIds.size === 0) {
        const builtin = patternSets.find((s) => s.source === "builtin");
        if (builtin) {
          activePatternSetIds.add(builtin.id);
        }
      }
      if (typeof rebuildSetsList === "function") rebuildSetsList();
      if (typeof rebuildImageGrid === "function") rebuildImageGrid();
      if (typeof rebuildAvailablePatternsList === "function") rebuildAvailablePatternsList();
    } catch (_) {}
  });
}

