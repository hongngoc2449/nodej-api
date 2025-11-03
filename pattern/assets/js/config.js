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
      
      // Filter out invalid patterns (URLs that don't match new path structure)
      // New path should contain "/pattern/" in URL (format: /pattern/{pattern-name}/)
      const validUploadedSets = uploadedSets.filter((set) => {
        if (!set.images || !Array.isArray(set.images) || set.images.length === 0) return false;
        
        // Check if all images have valid URLs with new path structure
        // URLs should contain "/pattern/" (not just old paths without this)
        const hasValidUrls = set.images.every((img) => {
          if (!img.url) return false;
          // New format: URLs should contain "/pattern/" (e.g., /pattern/my-pattern/image.png)
          // Old format would not have this path structure
          return img.url.includes("/pattern/");
        });
        
        return hasValidUrls;
      });
      
      // If there are invalid sets, clean them up from localStorage
      if (uploadedSets.length !== validUploadedSets.length) {
        console.log(`🧹 Removed ${uploadedSets.length - validUploadedSets.length} invalid pattern(s) from storage`);
        // Update localStorage with only valid sets
        localStorage.setItem(STORAGE_KEY_PATTERN_SETS, JSON.stringify(validUploadedSets));
      }
      
      if (validUploadedSets.length > 0) {
        patternSets.push(...validUploadedSets);
      }
    }
  } catch (err) {
    console.error("Error loading pattern sets from storage:", err);
    // If there's an error, clear corrupted localStorage
    try {
      localStorage.removeItem(STORAGE_KEY_PATTERN_SETS);
    } catch (e) {
      console.error("Error clearing localStorage:", e);
    }
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
    url: img.url || null, // Digital Ocean URL if available
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

