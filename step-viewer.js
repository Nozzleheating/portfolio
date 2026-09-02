import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

const stage = document.querySelector("#viewer-stage");
const emptyState = document.querySelector("#viewer-empty");
const status = document.querySelector("#viewer-status");
const projectName = document.querySelector("#project-name");
const solidCount = document.querySelector("#solid-count");
const triangleCount = document.querySelector("#triangle-count");
const resetButton = document.querySelector("#reset-view");
const projectBack = document.querySelector("#project-back");

const modelLibrary = {
  "light-cover-mounting-bracket": {
    name: "Light Cover Mounting Bracket",
    file: "assets/models/light-cover-mounting-bracket.step",
    project: "light-cover-mounting-bracket.html",
  },
  "fridge-dairy-compartment": {
    name: "Fridge Dairy Compartment",
    file: "assets/models/fridge-dairy-compartment.step",
    project: "fridge-dairy-compartment.html",
  },
  "countertop-scraper": {
    name: "Countertop Scraper",
    file: "assets/models/countertop-scraper.step",
    project: "countertop-scraper.html",
  },
  "shopvac-suction-cup": {
    name: "Shopvac Suction Cup",
    file: "assets/models/shopvac-suction-cup.step",
    project: "shopvac-suction-cup.html",
  },
  impeller: {
    name: "Impeller",
    file: "assets/models/impeller.step",
    project: "impeller.html",
  },
};

const modelId = new URLSearchParams(window.location.search).get("model");
const selectedModel = modelLibrary[modelId];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1f4ef);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50000);
camera.position.set(240, 180, 240);

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
let parser;

function render() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

function resizeViewer() {
  const { width, height } = stage.getBoundingClientRect();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function clearModel() {
  while (modelGroup.children.length) {
    const child = modelGroup.children.pop();
    child.traverse((part) => part.geometry?.dispose?.());
  }
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

async function loadParser() {
  if (parser) return parser;
  const wasmUrl = "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/occt-import-js.wasm";
  parser = await window.occtimportjs({ locateFile: () => wasmUrl });
  return parser;
}

async function showStepModel(model) {
  projectName.textContent = model.name;
  projectBack.href = model.project;
  solidCount.textContent = "Loading";
  triangleCount.textContent = "Loading";
  status.textContent = "Reading CAD geometry...";
  stage.classList.add("is-loading");
  emptyState.hidden = true;

  try {
    const occt = await loadParser();
    const response = await fetch(model.file);
    if (!response.ok) throw new Error("The CAD model could not be loaded.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const result = occt.ReadStepFile(bytes, { linearUnit: "millimeter" });

    if (!result?.success || !result.meshes?.length) {
      throw new Error("No solid geometry was found in this STEP file.");
    }

    clearModel();
    let triangles = 0;
    result.meshes.forEach((mesh) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3));
      if (mesh.attributes.normal) {
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3));
      } else {
        geometry.computeVertexNormals();
      }
      if (mesh.index) geometry.setIndex(new THREE.Uint32BufferAttribute(mesh.index.array, 1));
      triangles += mesh.index ? mesh.index.array.length / 3 : mesh.attributes.position.array.length / 9;

      const solid = new THREE.Mesh(geometry, material);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 22), edgeMaterial);
      solid.add(edges);
      modelGroup.add(solid);
    });

    frameModel();
    solidCount.textContent = result.meshes.length.toLocaleString();
    triangleCount.textContent = Math.round(triangles).toLocaleString();
    status.textContent = "Model ready. Drag to inspect it.";
    resetButton.disabled = false;
  } catch (error) {
    console.error(error);
    clearModel();
    emptyState.hidden = false;
    solidCount.textContent = "-";
    triangleCount.textContent = "-";
    status.textContent = error.message || "This file could not be opened.";
  } finally {
    stage.classList.remove("is-loading");
  }
}

resetButton.addEventListener("click", frameModel);
window.addEventListener("resize", resizeViewer);
resizeViewer();
render();

if (selectedModel) {
  showStepModel(selectedModel);
} else {
  projectName.textContent = "No model selected";
  status.textContent = "Open a 3D model from one of the project pages.";
  emptyState.querySelector("strong").textContent = "Choose a project model.";
  emptyState.querySelector("p").textContent = "Interactive STEP models are available from selected project pages.";
  projectBack.hidden = true;
}
