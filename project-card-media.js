(() => {
  const cards = document.querySelectorAll(".project-image-swap");

  cards.forEach((card) => {
    const controls = card.querySelectorAll("[data-project-image]");
    if (!controls.length) return;

    controls.forEach((control) => {
      control.addEventListener("click", () => {
        const showingRealImage = control.dataset.projectImage === "real";
        card.classList.toggle("is-real", showingRealImage);

        controls.forEach((button) => {
          button.setAttribute("aria-pressed", String(button === control));
        });
      });
    });
  });
})();
