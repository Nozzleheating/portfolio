const imageLinks = document.querySelectorAll(
  '.iteration-grid a[href$=".png"], .iteration-grid a[href$=".jpg"], .iteration-grid a[href$=".jpeg"], .iteration-grid a[href$=".webp"]'
);

if (imageLinks.length > 0) {
  const lightbox = document.createElement("div");
  const closeButton = document.createElement("button");
  const image = document.createElement("img");

  lightbox.className = "image-lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-label", "Image preview");

  closeButton.className = "lightbox-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close image preview");
  closeButton.textContent = "X";

  lightbox.append(closeButton, image);
  document.body.append(lightbox);

  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    image.removeAttribute("src");
    image.removeAttribute("alt");
  };

  imageLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const thumbnail = link.querySelector("img");
      event.preventDefault();
      image.src = link.href;
      image.alt = thumbnail ? thumbnail.alt : "";
      lightbox.classList.add("is-open");
      closeButton.focus();
    });
  });

  closeButton.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }
  });
}
