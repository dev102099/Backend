import { Request, Response } from "express";
import sql from "../db/db";
import { IdentifyRequestBody } from "../types/identity";

export const identity = async (req: Request, res: Response) => {
  try {
    const { email, phone_number } = req.body as IdentifyRequestBody;

    // STEP 1: Validate input
    if (!email && !phone_number) {
      return res.status(400).json({
        message: "Either email or phone number must be provided",
      });
    }

    // STEP 2: Fetch all matching contactss
    let matches;

    if (email && phone_number) {
      matches = await sql`
    SELECT *
    FROM contacts
    WHERE email = ${email}
       OR phone_number = ${phone_number}
  `;
    } else if (email) {
      matches = await sql`
    SELECT *
    FROM contacts
    WHERE email = ${email}
  `;
    } else {
      matches = await sql`
    SELECT *
    FROM contacts
    WHERE phone_number = ${phone_number}
  `;
    }

    let primarycontacts;

    // STEP 3: No matches → create PRIMARY
    if (matches.length === 0) {
      const [created] = await sql`
        INSERT INTO contacts (email, phone_number, link_precedence)
        VALUES (${email}, ${phone_number}, 'primary')
        RETURNING *
      `;

      primarycontacts = created;
    } else {
      // STEP 4: Resolve PRIMARY
      const primaries = matches.filter(
        (c: any) => c.link_precedence === "primary",
      );

      // Pick oldest primary
      primarycontacts =
        primaries.length > 0
          ? primaries.reduce((oldest: any, curr: any) =>
              curr.created_at < oldest.created_at ? curr : oldest,
            )
          : matches[0];

      // STEP 4a: Merge multiple primaries if needed
      const primaryIdsToMerge = primaries
        .filter((p: any) => p.id !== primarycontacts.id)
        .map((p: any) => p.id);

      if (primaryIdsToMerge.length > 0) {
        await sql`
          UPDATE contacts
          SET link_precedence = 'secondary',
              linked_id = ${primarycontacts.id}
          WHERE id = ANY(${primaryIdsToMerge})
        `;
      }

      // STEP 5: Check if incoming info is new
      const emailExists = email
        ? matches.some((c: any) => c.email === email)
        : true;

      const phoneExists = phone_number
        ? matches.some((c: any) => c.phone_number === phone_number)
        : true;

      if (!emailExists || !phoneExists) {
        await sql`
          INSERT INTO contacts (email, phone_number, linked_id, link_precedence)
          VALUES (${email}, ${phone_number}, ${primarycontacts.id}, 'secondary')
        `;
      }
    }

    // STEP 6: Fetch consolidated identity
    const relatedcontactss = await sql`
      SELECT *
      FROM contacts
      WHERE id = ${primarycontacts.id}
         OR linked_id = ${primarycontacts.id}
    `;

    const emails = Array.from(
      new Set(relatedcontactss.map((c: any) => c.email).filter(Boolean)),
    );

    const phoneNumbers = Array.from(
      new Set(relatedcontactss.map((c: any) => c.phone_number).filter(Boolean)),
    );

    const secondarycontactsIds = relatedcontactss
      .filter((c: any) => c.link_precedence === "secondary")
      .map((c: any) => c.id);

    // STEP 7: Return response
    return res.status(200).json({
      contacts: {
        primarycontactsId: primarycontacts.id,
        emails,
        phoneNumbers,
        secondarycontactsIds,
      },
    });
  } catch (error) {
    console.error("IDENTITY ERROR:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
