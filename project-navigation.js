(() => {
  const returnProjectKey = "portfolio-return-project";
  const projectLinks = Array.from(document.querySelectorAll('.project-card a[href$=".html"]'));

  function getProjectFile(link) {
    return new URL(link.href, window.location.href).pathname.split("/").pop();
  }

  projectLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      try {
        sessionStorage.setItem(returnProjectKey, getProjectFile(link));
      } catch {
        // Browsers can disable storage in private modes; the normal project link still works.
      }
    });
  });

  let returnProject;
  try {
    returnProject = sessionStorage.getItem(returnProjectKey);
  } catch {
    return;
  }

  if (!returnProject) return;

  const projectLink = projectLinks.find((link) => getProjectFile(link) === returnProject);
  const projectCard = projectLink?.closest(".project-card");
  if (!projectCard) return;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      projectCard.scrollIntoView({ block: "center" });
      sessionStorage.removeItem(returnProjectKey);
    });
  });
})();
