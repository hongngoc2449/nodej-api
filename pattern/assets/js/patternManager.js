// Pattern management and assignment logic

function convertTextToImages(text) {
  if (!text) return [];
  const upperText = text.toUpperCase();
  const result = [];
  for (let i = 0; i < upperText.length; i++) {
    const char = upperText[i];
    const assigned = assignedByIndex[i];
    if (char === " ") {
      result.push({
        char: char,
        filename: null,
        position: i,
        missing: true,
      });
      continue;
    }
    if (assigned && assigned.char === char) {
      result.push({
        char: char,
        filename: assigned.filename || null,
        url: assigned.url || null,
        position: i,
        setId: assigned.setId || null,
        setName: assigned.setName || null,
        missing: !assigned.filename && !assigned.url,
      });
    } else {
      result.push({
        char: char,
        filename: null,
        position: i,
        missing: true,
      });
    }
  }
  return result;
}

function assignForText(text) {
  const upperText = (text || "").toUpperCase();
  // Resize cache
  if (upperText.length < assignedByIndex.length) {
    assignedByIndex = assignedByIndex.slice(0, upperText.length);
  } else if (upperText.length > assignedByIndex.length) {
    const add = upperText.length - assignedByIndex.length;
    for (let i = 0; i < add; i++) assignedByIndex.push(undefined);
  }

  // Count non-space characters for rotation
  // Count based on ALL non-space characters (including existing ones) for correct rotation position
  let charPosition = 0;

  for (let i = 0; i < upperText.length; i++) {
    const ch = upperText[i];
    if (ch === " ") {
      assignedByIndex[i] = { char: ch };
      continue;
    }

    // Increment position only for non-space characters
    const existing = assignedByIndex[i];

    // Only reassign if:
    // 1. No existing assignment (new character)
    // 2. Character changed (user edited text)
    // Do NOT reassign existing characters even in rotate mode - keep them intact
    const shouldReassign = !existing || existing.char !== ch;
    
    if (shouldReassign) {
      let img = null;

      if (randomMode) {
        // Random mode: find all available images for this character across all sets
        const allImages = findAllImagesForChar(ch);
        if (allImages.length > 0) {
          const randomIndex = Math.floor(
            Math.random() * allImages.length
          );
          img = allImages[randomIndex];
        }
      } else if (rotateMode) {
        // Rotate mode: use pattern set in order based on character position (excluding spaces)
        // charPosition is calculated based on ALL non-space characters up to this point
        // This ensures new characters get the correct rotation position
        const rotateSet = getSetForRotation(charPosition);
        img = getImageFromSet(rotateSet, ch);
        // Fallback to selected set if rotation set not found
        if (!img) {
          img = getImageFromSet(getCurrentSet(), ch);
        }
      } else {
        // Normal mode: use selected set
        img = getImageFromSet(getCurrentSet(), ch);
      }

      if (img) {
        assignedByIndex[i] = {
          char: ch,
          filename: img.filename,
          url: img.url || null,
          setId: img.setId,
          setName: img.setName,
        };
      } else {
        assignedByIndex[i] = { char: ch }; // missing
      }
    }

    // Increment character position after processing (for next character's rotation position)
    // This counts ALL non-space characters, maintaining continuity for rotation
    charPosition++;
  }
}

