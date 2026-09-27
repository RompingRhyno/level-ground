/**
 * TEMPORARY — point the contact-form notification at the new account's mailbox, then prove the
 * notification path works from end to end.
 *
 * Until the client's own inbox is available, submissions should land at the new account owner's address
 * (the only recipient a sandbox Resend key can reach). This updates the `ContactRecipient` row, reads it
 * back, and sends one real message through the app's key so the result is measured, not assumed.
 *
 *   npx tsx scripts/tmp-set-recipient.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const NEW_EMAIL = "levelgrounddev@gmail.com";

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const before = await prisma.contactRecipient.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { id: "asc" },
  });
  console.log("before:", before.map((r) => `#${r.id} ${r.email}${r.name ? ` (${r.name})` : ""}`).join(", ") || "(none)");

  const target = before[0];
  if (!target) throw new Error("no ContactRecipient rows to update");

  if (target.email === NEW_EMAIL) {
    console.log("already pointed at the new address — nothing to change");
  } else {
    const updated = await prisma.contactRecipient.update({
      where: { id: target.id },
      data: { email: NEW_EMAIL },
      select: { id: true, email: true },
    });
    console.log(`updated: #${updated.id} → ${updated.email}`);
  }

  const after = await prisma.contactRecipient.findMany({
    select: { id: true, email: true },
    orderBy: { id: "asc" },
  });
  console.log("after: ", after.map((r) => `#${r.id} ${r.email}`).join(", "));

  // Prove the notification path: send one message the way the contact route does.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.CONTACT_EMAIL_FROM,
      to: after.map((r) => r.email),
      subject: "level-ground: contact notification check",
      text: "This is the address contact-form submissions will reach until the owner's own inbox is available. Nothing to do.",
    }),
  });
  const body = (await res.json()) as { id?: string; message?: string };
  console.log(
    res.status === 200 && body.id
      ? `resend accepted the send — id=${body.id} to=${after.map((r) => r.email).join(", ")}`
      : `send FAILED — http ${res.status} ${JSON.stringify(body).slice(0, 200)}`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("failed:", err);
  process.exit(1);
});
