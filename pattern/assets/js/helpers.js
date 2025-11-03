// Helper functions

function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function getCharMapForSet(set) {
  if (!set) return new Map();
  if (setIdToCharMap.has(set.id)) return setIdToCharMap.get(set.id);
  const m = new Map();
  (set.images || []).forEach((img) => {
    if (!m.has(img.char)) m.set(img.char, img);
  });
  setIdToCharMap.set(set.id, m);
  return m;
}

function invalidateCharMapForSet(setId) {
  if (setIdToCharMap.has(setId)) setIdToCharMap.delete(setId);
}

function invalidateAllCharMaps() {
  setIdToCharMap.clear();
}

function isSupportedChar(ch) {
  return /[A-Z0-9]/.test(ch);
}

function getCurrentSet() {
  // Return first selected set (or builtin if none selected)
  const firstSelectedId = selectedSetIds.size > 0 
    ? Array.from(selectedSetIds)[0] 
    : "builtin";
  return (
    patternSets.find((s) => s.id === firstSelectedId) ||
    patternSets.find((s) => s.id === "builtin")
  );
}

function getImageFromSet(set, char) {
  if (!set) return null;
  const map = getCharMapForSet(set);
  const foundImg = map.get(char);
  if (!foundImg) return null;
  return {
    ...foundImg,
    setId: set.id,
    setName: set.name,
  };
}

function getImageSrc(item) {
  return item.url ? item.url : `/patterns/Set 1/${item.filename}`;
}

function findAllImagesForChar(char) {
  const allImages = [];
  patternSets.forEach((set) => {
    // Only search in selected sets
    if (!selectedSetIds.has(set.id)) return;
    
    const map = getCharMapForSet(set);
    const img = map.get(char);
    if (img) {
      allImages.push({
        ...img,
        setId: set.id,
        setName: set.name,
      });
    }
  });
  return allImages;
}

function getSetForRotation(position) {
  if (!rotateMode) {
    return null;
  }
  // Use the order from patternSets array (which reflects the drag & drop order)
  // IMPORTANT: Get a fresh reference to patternSets array to ensure we use the latest order
  // Filter to only include selected sets, preserving the order from patternSets
  const selectedOrder = [];
  // Iterate through patternSets in order and add selected ones
  for (const set of patternSets) {
    if (selectedSetIds.has(set.id)) {
      selectedOrder.push(set.id);
    }
  }
  
  if (selectedOrder.length === 0) {
    return null;
  }
  const setIndex = position % selectedOrder.length;
  const setId = selectedOrder[setIndex];
  
  return patternSets.find((s) => s.id === setId);
}

function groupIntoWords(result) {
  const words = [];
  let currentWord = [];
  result.forEach((item) => {
    if (item.char === " " || (item.missing && item.char === " ")) {
      if (currentWord.length > 0) {
        words.push(currentWord);
        currentWord = [];
      }
    } else {
      currentWord.push(item);
    }
  });
  if (currentWord.length > 0) {
    words.push(currentWord);
  }
  return words;
}

