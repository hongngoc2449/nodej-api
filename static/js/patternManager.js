// Pattern management and assignment logic

function convertTextToImages(text) {
  if (!text) return [];
  const upperText = text.toUpperCase();
  const result = [];
  for (let i = 0; i < upperText.length; i++) {
    const char = upperText[i];
    const assigned = assignedByIndex[i];
    if (char === " ") {
      result.push({ char, position: i, missing: true });
      continue;
    }
    if (assigned && assigned.char === char) {
      result.push({
        char,
        url: assigned.url || null,
        position: i,
        setId: assigned.setId || null,
        setName: assigned.setName || null,
        missing: !assigned.url,
      });
    } else {
      result.push({ char, position: i, missing: true });
    }
  }
  return result;
}

function assignForText(text) {
  const upperText = (text || "").toUpperCase();
  
  if (upperText.length < assignedByIndex.length) {
    assignedByIndex = assignedByIndex.slice(0, upperText.length);
    if (randomMode) usedPatternSetsInSequence.clear();
  } else if (upperText.length > assignedByIndex.length) {
    const add = upperText.length - assignedByIndex.length;
    for (let i = 0; i < add; i++) assignedByIndex.push(undefined);
  }

  if (randomMode) {
    usedPatternSetsInSequence.clear();
    const activeSetIds = Array.from(activePatternSetIds);
    
    if (activeSetIds.length > 0) {
      for (let i = 0; i < assignedByIndex.length && i < upperText.length; i++) {
        const existing = assignedByIndex[i];
        const ch = upperText[i];
        
        if (ch === " " || !existing || existing.char !== ch || !existing.setId) {
          continue;
        }
        
        usedPatternSetsInSequence.add(existing.setId);
        const unusedAfter = activeSetIds.filter(setId => !usedPatternSetsInSequence.has(setId));
        
        if (unusedAfter.length === 0) {
          usedPatternSetsInSequence.clear();
        }
      }
    }
  }

  let charPosition = 0;

  for (let i = 0; i < upperText.length; i++) {
    const ch = upperText[i];
    if (ch === " ") {
      assignedByIndex[i] = { char: ch };
      // Reset position when starting a new word (after space)
      if (rotateMode) {
        charPosition = 0;
      }
      continue;
    }

    const existing = assignedByIndex[i];
    const shouldReassign = !existing || existing.char !== ch;
    
    if (shouldReassign) {
      let img = null;

      if (randomMode) {
        const activeSetIds = Array.from(activePatternSetIds);
        if (activeSetIds.length === 0) {
          img = null;
        } else {
          const unusedSetIds = activeSetIds.filter(setId => !usedPatternSetsInSequence.has(setId));
          let availableSetIds;
          let willUseLastSet = false;
          
          if (unusedSetIds.length === 0) {
            availableSetIds = activeSetIds;
            usedPatternSetsInSequence.clear();
          } else if (unusedSetIds.length === 1) {
            availableSetIds = unusedSetIds;
            willUseLastSet = true;
          } else {
            availableSetIds = unusedSetIds;
          }
          
          const allImages = [];
          patternSets.forEach((set) => {
            if (!availableSetIds.includes(set.id)) return;
            const map = getCharMapForSet(set);
            const img = map.get(ch);
            if (img) {
              allImages.push({
                ...img,
                setId: set.id,
                setName: set.name,
              });
            }
          });
          
        if (allImages.length > 0) {
            const randomIndex = Math.floor(Math.random() * allImages.length);
          img = allImages[randomIndex];
            
            if (img.setId) {
              usedPatternSetsInSequence.add(img.setId);
              if (willUseLastSet) {
                usedPatternSetsInSequence.clear();
              }
            }
          }
        }
      } else if (rotateMode) {
        const rotateSet = getSetForRotation(charPosition);
        img = getImageFromSet(rotateSet, ch);
        if (!img) {
          img = getImageFromSet(getCurrentSet(), ch);
        }
      } else {
        img = getImageFromSet(getCurrentSet(), ch);
      }

      if (img) {
        assignedByIndex[i] = {
          char: ch,
          url: img.url || null,
          setId: img.setId,
          setName: img.setName,
        };
      } else {
        assignedByIndex[i] = { char: ch };
      }
    }

    // Increment position only for non-space characters
    if (rotateMode) {
    charPosition++;
    }
  }
}
