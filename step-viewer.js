(() => {
  const THREE = window.THREE;

  if (!THREE || !THREE.TrackballControls) {
    document.querySelectorAll(".inline-model-viewer .viewer-status").forEach((status) => {
      status.textContent = "The 3D tools could not load. Refresh this page and try again.";
    });
    return;
  }

  window.stepViewerStarted = true;

const modelLibrary = {
  "light-cover-mounting-bracket": "assets/models/light-cover-mounting-bracket.step",
  "fridge-dairy-compartment": "assets/models/fridge-dairy-compartment.step",
  "countertop-scraper": "assets/models/countertop-scraper.step",
  "shopvac-suction-cup": "assets/models/shopvac-suction-cup.step",
  impeller: "assets/models/impeller.step",
  "linear-intake": "assets/models/linear-intake.step",
  "roller-floor": "assets/models/roller-floor.step",
  "turret-platform-pocketing": "assets/models/turret-platform-pocketing.step",
  "ground-intake": "assets/models/ground-intake.step",
  "differential-wrist": "assets/models/differential-wrist.step",
  "limelight-cover": "assets/models/limelight-cover.step",
  "funnel-angle-mounts": "assets/models/funnel-angle-mounts.step",
  "manual-transmission-gearbox": "assets/models/manual-transmission-gearbox.step",
  carburetor: "assets/models/carburetor.step",
  turbine: "assets/models/turbine.step",
  "cam-project": "assets/models/cam-project.step",
  "cabinet-magnet-holder": "assets/models/cabinet-magnet-holder.step",
  "frc-drivebase": "assets/models/frc-drivebase.step",
  "puzzle-cube": "assets/models/puzzle-cube.step",
  "bed-mount": "assets/models/bed-mount.step",
};

let parserPromise;

function decodeEmbeddedModel(encodedModel) {
  const binary = window.atob(encodedModel);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function loadEmbeddedModel(modelKey, sourceFile) {
  if (window.stepModelSources?.[modelKey]) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = sourceFile;
    script.onload = resolve;
    script.onerror = () => reject(new Error("The CAD model file could not be opened."));
    document.head.append(script);
  });
}

async function loadModelBytes(modelFile, modelKey, embeddedSource, updateProgress) {
  const sources = [modelFile, `https://raw.githubusercontent.com/Nozzleheating/portfolio/main/${modelFile}`];
  let fetchError;

  for (const [sourceIndex, source] of sources.entries()) {
    try {
      updateProgress(sourceIndex === 0 ? 28 : 34, "Downloading model...");
      const response = await fetch(source);
      if (!response.ok) throw new Error("The CAD model could not be loaded.");

      const total = Number(response.headers.get("content-length")) || 0;
      if (!response.body || !total) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        updateProgress(66, "Model downloaded.");
        return bytes;
      }

      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        updateProgress(28 + Math.round((received / total) * 38), "Downloading model...");
      }

      const bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      updateProgress(66, "Model downloaded.");
      return bytes;
    } catch (error) {
      fetchError = error;
    }
  }

  if (!embeddedSource) throw fetchError;
  await loadEmbeddedModel(modelKey, embeddedSource);
  const embeddedModel = window.stepModelSources?.[modelKey];
  if (!embeddedModel) throw new Error("The local CAD model could not be read.");
  updateProgress(66, "Model downloaded.");
  return decodeEmbeddedModel(embeddedModel);
}

function getParser() {
  if (parserPromise) return parserPromise;

  parserPromise = new Promise((resolve, reject) => {
    if (!window.occtimportjs) {
      reject(new Error("The CAD engine could not start. Refresh the page and try again."));
      return;
    }

    const timer = window.setTimeout(() => {
      reject(new Error("The CAD engine took too long to load. Please refresh and try again."));
    }, 20000);

    window.occtimportjs()
      .then((parser) => {
        window.clearTimeout(timer);
        resolve(parser);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });

  return parserPromise;
}

function initializeViewer(stage) {
  const modelFile = modelLibrary[stage.dataset.stepModel];
  const embeddedSource = stage.dataset.stepFallback;
  const emptyState = stage.querySelector(".viewer-empty");
  const status = stage.querySelector(".viewer-status");
  const resetButton = stage.querySelector(".inline-viewer-reset");
  const progress = document.createElement("div");
  const progressBar = document.createElement("span");

  progress.className = "viewer-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "3D model loading progress");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.append(progressBar);
  emptyState.append(progress);

  function updateProgress(value, message) {
    const clampedValue = Math.max(0, Math.min(100, Math.round(value)));
    progress.style.setProperty("--viewer-progress", `${clampedValue}%`);
    progress.setAttribute("aria-valuenow", String(clampedValue));
    if (message) status.textContent = message;
  }

  if (!modelFile) {
    status.textContent = "This project does not have an interactive model yet.";
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6f7f2);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  stage.prepend(renderer.domElement);

  const controls = new THREE.TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = 3.4;
  controls.zoomSpeed = 1.15;
  controls.panSpeed = 0.7;
  controls.dynamicDampingFactor = 0.12;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x22372f, 1.75));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(180, 260, 180);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xd9902f, 0.28);
  fillLight.position.set(-180, -80, 120);
  scene.add(fillLight);

  const modelGroup = new THREE.Group();
  scene.add(modelGroup);
  const material = new THREE.MeshStandardMaterial({ color: 0x1f5947, metalness: 0.14, roughness: 0.52 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x112d24, transparent: true, opacity: 0.42 });
  const partsPanel = document.createElement("aside");
  const partsList = document.createElement("div");
  const sectionControls = document.createElement("div");
  const sectionTitle = document.createElement("p");
  const sectionToggle = document.createElement("input");
  const sectionLabel = document.createElement("label");
  const sectionSlider = document.createElement("input");
  const sectionPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  let sectionBoundsReady = false;
  let sectionCenter = 0;

  partsPanel.className = "viewer-parts-panel";
  partsPanel.hidden = true;
  partsPanel.innerHTML = "<p class=\"viewer-parts-title\">Parts</p>";
  partsList.className = "viewer-parts-list";
  sectionControls.className = "viewer-section-controls";
  sectionTitle.className = "viewer-section-title";
  sectionTitle.textContent = "Section View";
  sectionToggle.type = "checkbox";
  sectionToggle.id = `section-toggle-${stage.dataset.stepModel}`;
  sectionLabel.htmlFor = sectionToggle.id;
  sectionLabel.textContent = "Enable section view";
  sectionSlider.type = "range";
  sectionSlider.min = "-1";
  sectionSlider.max = "1";
  sectionSlider.value = "0";
  sectionSlider.step = "0.01";
  sectionSlider.disabled = true;
  sectionSlider.setAttribute("aria-label", "Section view depth");
  sectionControls.append(sectionTitle, sectionToggle, sectionLabel, sectionSlider);
  partsPanel.append(partsList, sectionControls);
  const viewerFigure = stage.closest(".featured-render");
  const viewerShell = document.createElement("div");
  viewerShell.className = "viewer-canvas-shell";
  viewerFigure?.classList.add("has-inline-viewer");
  stage.before(viewerShell);
  viewerShell.append(stage, partsPanel);

  function resizeViewer() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    controls.handleResize();
  }

  function frameModel() {
    const box = new THREE.Box3().setFromObject(modelGroup);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 1);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25;

    camera.position.set(sphere.center.x + distance, sphere.center.y + distance * 0.7, sphere.center.z + distance);
    camera.near = Math.max(radius / 1000, 0.01);
    camera.far = Math.max(radius * 1000, 1000);
    camera.updateProjectionMatrix();
    controls.target.copy(sphere.center);
    controls.update();

    if (!sectionBoundsReady) {
      const sectionRange = radius * 1.15;
      sectionSlider.min = String(-sectionRange);
      sectionSlider.max = String(sectionRange);
      sectionSlider.step = String(Math.max(sectionRange / 200, 0.001));
      sectionSlider.value = "0";
      sectionCenter = sphere.center.x;
      sectionPlane.constant = -sectionCenter;
      sectionBoundsReady = true;
    }
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  async function loadModel() {
    try {
      updateProgress(8, "Starting CAD engine...");
      const parser = await getParser();
      updateProgress(24, "CAD engine ready.");
      const modelBytes = await loadModelBytes(modelFile, stage.dataset.stepModel, embeddedSource, updateProgress);

      updateProgress(70, "Reading model geometry...");
      const result = parser.ReadStepFile(modelBytes, null);
      if (!result?.success || !result.meshes?.length) throw new Error("No solid geometry was found in this model.");

      for (const [index, mesh] of result.meshes.entries()) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3));
        if (mesh.attributes.normal) {
          geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3));
        } else {
          geometry.computeVertexNormals();
        }
        if (mesh.index) geometry.setIndex(new THREE.Uint32BufferAttribute(mesh.index.array, 1));

        const solid = new THREE.Mesh(geometry, material);
        solid.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 22), edgeMaterial));
        modelGroup.add(solid);

        const toggle = document.createElement("label");
        const input = document.createElement("input");
        const name = document.createElement("span");
        const partName = typeof mesh.name === "string" && mesh.name.trim() ? mesh.name.trim() : `Part ${index + 1}`;

        toggle.className = "viewer-part-toggle";
        input.type = "checkbox";
        input.checked = true;
        input.setAttribute("aria-label", `Show ${partName}`);
        input.addEventListener("change", () => {
          solid.visible = input.checked;
        });
        name.textContent = partName;
        toggle.append(input, name);
        partsList.append(toggle);
        updateProgress(72 + ((index + 1) / result.meshes.length) * 24, "Building interactive parts...");
        if (index % 12 === 11) await new Promise((resolve) => window.requestAnimationFrame(resolve));
      }

      updateProgress(98, "Framing model...");
      resizeViewer();
      frameModel();
      emptyState.hidden = true;
      partsPanel.hidden = false;
      resetButton.disabled = false;
      status.textContent = "Drag to rotate. Scroll to zoom.";
    } catch (error) {
      console.error(error);
      emptyState.hidden = false;
      partsPanel.hidden = true;
      emptyState.querySelector("strong").textContent = "Model could not load.";
      emptyState.querySelector("p").textContent = "Try refreshing this page.";
      status.textContent = error.message || "The interactive model could not be loaded.";
    }
  }

  resetButton.addEventListener("click", frameModel);
  sectionToggle.addEventListener("change", () => {
    const clippingPlanes = sectionToggle.checked ? [sectionPlane] : [];
    material.clippingPlanes = clippingPlanes;
    edgeMaterial.clippingPlanes = clippingPlanes;
    material.needsUpdate = true;
    edgeMaterial.needsUpdate = true;
    sectionSlider.disabled = !sectionToggle.checked;
  });
  sectionSlider.addEventListener("input", () => {
    sectionPlane.constant = -sectionCenter + Number(sectionSlider.value);
  });
  renderer.localClippingEnabled = true;
  if ("ResizeObserver" in window) {
    new ResizeObserver(resizeViewer).observe(stage);
  } else {
    window.addEventListener("resize", resizeViewer);
  }
  resizeViewer();
  render();
  loadModel();
}

document.querySelectorAll(".inline-model-viewer[data-step-model]").forEach(initializeViewer);
})();
