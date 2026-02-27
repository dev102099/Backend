import { Request, Response } from "express";
import sql from "../db/db";
import { IdentifyRequestBody } from "../types/identity";

type ContactRow = {
  id: number;
  email: string | null;
  phone_number: string | null;
  linked_id: number | null;
  link_precedence: "primary" | "secondary";
  created_at: Date;
};

export const identity = async (req: Request, res: Response) => {
  try {
    const body = req.body as IdentifyRequestBody;

    if (!body || (!body.email && !body.phone_number)) {
      return res.status(400).json({
        message: "Either email or phone number must be provided",
      });
    }

    // ✅ NARROW TYPES HERE
    const email: string | null = body.email ?? null;
    const phone: string | null = body.phone_number ?? null;

    let matches: ContactRow[] = [];

    // ✅ CONDITIONAL SQL — NO undefined EVER
    if (email && phone) {
      matches = await sql<ContactRow[]>`
        SELECT * FROM contacts
        WHERE email = ${email}
           OR phone_number = ${phone}
      `;
    } else if (email) {
      matches = await sql<ContactRow[]>`
        SELECT * FROM contacts
        WHERE email = ${email}
      `;
    } else if (phone) {
      matches = await sql<ContactRow[]>`
        SELECT * FROM contacts
        WHERE phone_number = ${phone}
      `;
    }

    let primaryContact: ContactRow;

    // NO MATCHES → CREATE PRIMARY
    if (matches.length === 0) {
      const [created] = await sql<ContactRow[]>`
        INSERT INTO contacts (email, phone_number, link_precedence)
        VALUES (${email}, ${phone}, 'primary')
        RETURNING *
      `;
      primaryContact = created;
    } else {
      // ✅ TYPE SAFE
      const primaryContacts: ContactRow[] = matches.filter(
        (c) => c.link_precedence === "primary",
      );

      primaryContact = primaryContacts.reduce((oldest, curr) =>
        curr.created_at < oldest.created_at ? curr : oldest,
      );

      // MERGE MULTIPLE PRIMARIES
      const toMergeIds = primaryContacts
        .filter((c) => c.id !== primaryContact.id)
        .map((c) => c.id);

      if (toMergeIds.length > 0) {
        await sql`
          UPDATE contacts
          SET link_precedence = 'secondary',
              linked_id = ${primaryContact.id}
          WHERE id = ANY(${toMergeIds})
        `;
      }

      const emailExists = email ? matches.some((c) => c.email === email) : true;

      const phoneExists = phone
        ? matches.some((c) => c.phone_number === phone)
        : true;

      if (!emailExists || !phoneExists) {
        await sql`
          INSERT INTO contacts (email, phone_number, linked_id, link_precedence)
          VALUES (${email}, ${phone}, ${primaryContact.id}, 'secondary')
        `;
      }
    }

    const related = await sql<ContactRow[]>`
      SELECT * FROM contacts
      WHERE id = ${primaryContact.id}
         OR linked_id = ${primaryContact.id}
    `;

    return res.status(200).json({
      contact: {
        primaryContactId: primaryContact.id,
        emails: [...new Set(related.map((r) => r.email).filter(Boolean))],
        phoneNumbers: [
          ...new Set(related.map((r) => r.phone_number).filter(Boolean)),
        ],
        secondaryContactIds: related
          .filter((r) => r.link_precedence === "secondary")
          .map((r) => r.id),
      },
    });
  } catch (error) {
    console.error("IDENTITY ERROR:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
