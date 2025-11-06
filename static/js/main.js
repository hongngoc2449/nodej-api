// Main initialization and event handlers

document.addEventListener("DOMContentLoaded", function () {
  // Initialize pattern sets
  const embeddedImages = JSON.parse(
    document.getElementById("images-data").textContent
  );
  initPatternSets(embeddedImages);

  // DOM elements
  const textInput = document.getElementById("text");
  const resultSection = document.querySelector(".result-section");
  const imageGrid = document.querySelector(".image-grid");
  const localPatternInput = document.getElementById("localPatterns");
  const singleModeRadio = document.getElementById("singleMode");
  const randomModeRadio = document.getElementById("randomMode");
  const rotateModeRadio = document.getElementById("rotateMode");
  const exportImageBtn = document.getElementById("exportImageBtn");

  // Helper function for refresh UI
  function refreshUI() {
    const getText = () => (textInput ? textInput.value : "");
    const text = getText();
    const result = convertTextToImages(text);
    renderResultImages(result, text);
  }

  // Real-time conversion on input
  if (textInput) {
    const indicator = document.getElementById("real-time-indicator");

    const onInput = debounce(function () {
      const text = this.value;

      // Show indicator
      if (indicator) {
        indicator.classList.add("show");
        setTimeout(() => indicator.classList.remove("show"), 1000);
      }

      // Assign for new/changed indices
      assignForText(text);
      refreshUI();
    }, 120);

    textInput.addEventListener("input", onInput);

    // Initial conversion if there's already text
    if (textInput.value) {
      assignForText(textInput.value);
      refreshUI();
    }
  }

  // Helper: Disable other mode when one mode is enabled
  // Handle mode radio buttons
  function handleModeChange() {
    if (singleModeRadio && singleModeRadio.checked) {
      randomMode = false;
      rotateMode = false;
      // Reset used sets when switching away from random mode
      usedPatternSetsInSequence.clear();
    } else if (randomModeRadio && randomModeRadio.checked) {
      randomMode = true;
      rotateMode = false;
      // Reset used sets when switching to random mode to start fresh
      usedPatternSetsInSequence.clear();
    } else if (rotateModeRadio && rotateModeRadio.checked) {
      randomMode = false;
      rotateMode = true;
      // Reset used sets when switching away from random mode
      usedPatternSetsInSequence.clear();
      
      // Initialize order list when rotate mode is selected
      if (rotateMode) {
        patternSetOrder = patternSets
          .filter((set) => activePatternSetIds.has(set.id))
          .map((set) => set.id);
      }
    }

    // Reassign text if exists
    if (textInput && textInput.value) {
      assignForText(textInput.value);
      refreshUI();
    } else {
      refreshUI();
    }
  }

  // Add event listeners to all radio buttons
  if (singleModeRadio) {
    singleModeRadio.addEventListener("change", handleModeChange);
  }
  if (randomModeRadio) {
    randomModeRadio.addEventListener("change", handleModeChange);
  }
  if (rotateModeRadio) {
    rotateModeRadio.addEventListener("change", handleModeChange);
  }

  // Handle local pattern input
  if (localPatternInput) {
    localPatternInput.addEventListener("change", function () {
      const files = Array.from(this.files || []);
      if (!files.length) {
        rebuildSetsList();
        rebuildImageGrid();
        refreshUI();
        return;
      }

      // Group by top folder and build multiple local sets
      const groups = new Map(); // folder -> files
      files.forEach((file) => {
        const rel = file.webkitRelativePath || file.name;
        const top = rel.split("/")[0] || "Local";
        if (!groups.has(top)) groups.set(top, []);
        groups.get(top).push(file);
      });

      groups.forEach((groupFiles, folder) => {
        const mapByChar = new Map();
        const objectUrls = [];
        groupFiles.forEach((file) => {
          const name = file.name || "";
          const base = name.replace(/\.[^.]+$/, "");
          const ch = (base[0] || "").toUpperCase();
          if (!isSupportedChar(ch)) return;
          if (mapByChar.has(ch)) return;
          const url = URL.createObjectURL(file);
          objectUrls.push(url);
          mapByChar.set(ch, { char: ch, url });
        });
        const images = Array.from(mapByChar.values()).sort((a, b) =>
          a.char.localeCompare(b.char)
        );
        if (images.length === 0) return;
        const id = `local_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        patternSets.push({
          id,
          name: folder,
          source: "local",
          images,
          objectUrls,
        });
        
        // Add to active list automatically
        activePatternSetIds.add(id);
        
        invalidateCharMapForSet(id);
      });

      rebuildSetsList();
      rebuildImageGrid();
      if (typeof rebuildAvailablePatternsList === "function") rebuildAvailablePatternsList();

      // Update order list if rotate mode is on
      if (rotateMode) {
        // Update patternSetOrder to match patternSets order (filtered by active sets)
        patternSetOrder = patternSets
          .filter((set) => activePatternSetIds.has(set.id))
          .map((set) => set.id);
      }

      refreshUI();
    });
  }

  // Handle export button
  if (exportImageBtn) {
    exportImageBtn.addEventListener("click", exportImage);
  }

  // Handle inline spacing controls: update display and live preview
  (function initInlineSpacingControls() {
    const characterSpacingInput = document.getElementById(
      "characterSpacingInput"
    );
    const wordSpacingInput = document.getElementById("wordSpacingInput");
    const characterSpacingValue = document.getElementById(
      "characterSpacingValue"
    );
    const wordSpacingValue = document.getElementById("wordSpacingValue");

    const debouncedRefresh = debounce(refreshUI, 180);

    const updateValues = () => {
      if (characterSpacingInput && characterSpacingValue) {
        characterSpacingValue.textContent = characterSpacingInput.value;
      }
      if (wordSpacingInput && wordSpacingValue) {
        wordSpacingValue.textContent = wordSpacingInput.value;
      }
    };

    if (characterSpacingInput) {
      characterSpacingInput.addEventListener("input", () => {
        updateValues();
        debouncedRefresh();
      });
    }
    if (wordSpacingInput) {
      wordSpacingInput.addEventListener("input", () => {
        updateValues();
        debouncedRefresh();
      });
    }

    // Initialize displayed values on load
    updateValues();
  })();

  // Initialize export handlers
  if (typeof initExportHandlers === "function") {
    initExportHandlers();
  }

  // Initialize upload handlers
  initUploadHandlers();

  // Initialize pattern form handlers
  if (typeof initPatternFormHandlers === "function") {
    initPatternFormHandlers();
  }

  // Initialize available patterns list (no longer need modal handlers)
  if (typeof rebuildAvailablePatternsList === "function") {
    rebuildAvailablePatternsList();
  }

  // Initial UI build
  rebuildSetsList();
  rebuildImageGrid();
  invalidateAllCharMaps();

  // Initialize pattern set order (all active sets are used)
  if (patternSetOrder.length === 0 && activePatternSetIds.size > 0) {
    patternSetOrder = Array.from(activePatternSetIds);
  }
});

// Revoke all object URLs on page unload
window.addEventListener("beforeunload", function () {
  try {
    (patternSets || []).forEach((set) => {
      if (set && Array.isArray(set.objectUrls)) {
        set.objectUrls.forEach((u) => {
          try {
            URL.revokeObjectURL(u);
          } catch (_) {}
        });
      }
    });
  } catch (_) {}
});

