import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

window.stepViewerStarted = true;

const modelLibrary = {
  "light-cover-mounting-bracket": "assets/models/light-cover-mounting-bracket.step",
  "fridge-dairy-compartment": "assets/models/fridge-dairy-compartment.step",
  "countertop-scraper": "assets/models/countertop-scraper.step",
  "shopvac-suction-cup": "assets/models/shopvac-suction-cup.step",
  impeller: "assets/models/impeller.step",
};

let parserPromise;

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
  const emptyState = stage.querySelector(".viewer-empty");
  const status = stage.querySelector(".viewer-status");
  const resetButton = stage.querySelector(".inline-viewer-reset");

  if (!modelFile) {
    status.textContent = "This project does not have an interactive model yet.";
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1f4ef);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.prepend(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x446276, 2.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(180, 260, 180);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xd9902f, 0.7);
  fillLight.position.set(-180, -80, 120);
  scene.add(fillLight);

  const modelGroup = new THREE.Group();
  scene.add(modelGroup);
  const material = new THREE.MeshStandardMaterial({ color: 0x246b52, metalness: 0.32, roughness: 0.36 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x164636, transparent: true, opacity: 0.34 });

  function resizeViewer() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
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
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  async function loadModel() {
    try {
      status.textContent = "Loading CAD engine...";
      const parser = await getParser();
      status.textContent = "Reading model geometry...";
      const response = await fetch(modelFile);
      if (!response.ok) throw new Error("The CAD model could not be loaded.");
      const result = parser.ReadStepFile(new Uint8Array(await response.arrayBuffer()), null);
      if (!result?.success || !result.meshes?.length) throw new Error("No solid geometry was found in this model.");

      result.meshes.forEach((mesh) => {
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
      });

      resizeViewer();
      frameModel();
      emptyState.hidden = true;
      resetButton.disabled = false;
      status.textContent = "Drag to rotate. Scroll to zoom.";
    } catch (error) {
      console.error(error);
      emptyState.hidden = false;
      emptyState.querySelector("strong").textContent = "Model could not load.";
      emptyState.querySelector("p").textContent = "Try refreshing this page.";
      status.textContent = error.message || "The interactive model could not be loaded.";
    }
  }

  resetButton.addEventListener("click", frameModel);
  new ResizeObserver(resizeViewer).observe(stage);
  resizeViewer();
  render();
  loadModel();
}

document.querySelectorAll(".inline-model-viewer[data-step-model]").forEach(initializeViewer);
