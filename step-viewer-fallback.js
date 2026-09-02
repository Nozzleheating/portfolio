window.setTimeout(() => {
  if (window.stepViewerStarted) return;

  document.querySelectorAll(".inline-model-viewer .viewer-status").forEach((status) => {
    status.textContent = "The 3D viewer could not start. Refresh this page and try again.";
  });
}, 25000);
