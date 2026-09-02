import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

const fileInput = document.querySelector("#step-file");
const dropzone = document.querySelector("#dropzone");
const stage = document.querySelector("#viewer-stage");
const emptyState = document.querySelector("#viewer-empty");
const status = document.querySelector("#viewer-status");
const fileName = document.querySelector("#file-name");
const solidCount = document.querySelector("#solid-count");
const triangleCount = document.querySelector("#triangle-count");
const resetButton = document.querySelector("#reset-view");

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

async function showStepFile(file) {
  if (!file || !/\.(step|stp)$/i.test(file.name)) {
    status.textContent = "Choose a .step or .stp CAD file.";
    return;
  }

  fileName.textContent = file.name;
  solidCount.textContent = "Loading";
  triangleCount.textContent = "Loading";
  status.textContent = "Reading CAD geometry...";
  stage.classList.add("is-loading");
  emptyState.hidden = true;

  try {
    const occt = await loadParser();
    const bytes = new Uint8Array(await file.arrayBuffer());
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

fileInput.addEventListener("change", () => showStepFile(fileInput.files[0]));
resetButton.addEventListener("click", frameModel);

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  });
});

dropzone.addEventListener("drop", (event) => showStepFile(event.dataTransfer.files[0]));
window.addEventListener("resize", resizeViewer);
resizeViewer();
render();
