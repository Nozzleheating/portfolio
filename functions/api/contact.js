function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=UTF-8",
    },
  });
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export async function onRequestPost({ request, env }) {
  let formData;

  try {
    formData = await request.formData();
  } catch {
    return json({ ok: false, error: "Please submit the form again." }, 400);
  }

  // Hidden from visitors. Bots that fill it out are silently ignored.
  if (clean(formData.get("website"))) return json({ ok: true });

  const name = clean(formData.get("name"));
  const email = clean(formData.get("email"));
  const message = clean(formData.get("message"));

  if (!name || !email || !message) {
    return json({ ok: false, error: "Please complete every field." }, 400);
  }

  if (name.length > 120 || email.length > 254 || message.length > 4000) {
    return json({ ok: false, error: "One of the fields is too long." }, 400);
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return json({ ok: false, error: "Please enter a valid email address." }, 400);
  }

  if (!env.RESEND_API_KEY || !env.CONTACT_RECIPIENT || !env.CONTACT_FROM) {
    return json({ ok: false, error: "The contact form is not configured yet." }, 503);
  }

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: [env.CONTACT_RECIPIENT],
        reply_to: email,
        subject: `Portfolio message from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      }),
    });

    if (!resendResponse.ok) {
      console.error("Resend request failed", resendResponse.status);
      return json({ ok: false, error: "Message could not be sent. Please try again." }, 502);
    }
  } catch (error) {
    console.error("Contact form request failed", error);
    return json({ ok: false, error: "Message could not be sent. Please try again." }, 502);
  }

  return json({ ok: true });
}

export function onRequest() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
