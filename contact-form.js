(function () {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const status = form.querySelector(".contact-form-status");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    submitButton.disabled = true;
    status.textContent = "Sending message...";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result || !result.ok) {
        throw new Error(result && result.error ? result.error : "Message could not be sent. Please try again.");
      }

      form.reset();
      status.textContent = "Message sent. Thank you.";
    } catch (error) {
      status.textContent = error.message || "Message could not be sent. Please try again.";
    } finally {
      submitButton.disabled = false;
    }
  });
})();
