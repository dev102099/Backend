import { Request, Response, NextFunction } from "express";
import { IdentifyRequestBody } from "../types/identity";
import sql from "../db/db";
import { Error } from "postgres";
import { Contact } from "../types/identity";

export const identity = async (req: Request, res: Response, next: Function) => {
  try {
    const { email, phone_number } = req.body as IdentifyRequestBody;
    if (!email && !phone_number) {
      return res
        .status(400)
        .json({ message: "Either email or phone number must be provided" });
    }
    let result: Contact[] = [];
    if (email && phone_number) {
      const userExists = await sql`SELECT * FROM contacts
    WHERE (email = ${email} AND phone_number = ${phone_number})
      AND link_precedence = 'primary'
  `;
      if (userExists.length === 1) {
        return res.status(200).json({ message: "User already exists" });
      }
      if (userExists.length > 1) {
        return res.status(200).json(userExists);
      }
      result = await sql`
    SELECT * FROM contacts
    WHERE email = ${email}
       OR phone_number = ${phone_number}
  `;
    } else if (email) {
      result = await sql`
    SELECT * FROM contacts
    WHERE email = ${email}
  `;
    } else if (phone_number) {
      result = await sql`
    SELECT * FROM contacts
    WHERE phone_number = ${phone_number}
  `;
    }

    if (result.length === 0) {
      const newContact = await sql`
    INSERT INTO contacts (email, phone_number, link_precedence)
    VALUES (${email}, ${phone_number}, 'primary')
    RETURNING *
  `;
      return res.status(200).json(newContact[0]);
    } else {
      const secondaryContact =
        await sql`insert into contacts (email,phone_number,link_precedence,linked_id) values (${email},${phone_number},'secondary',${result[0].id}) returning *`;
      return res.status(200).json([...result, ...secondaryContact]);
    }
    return res.status(200).json(result);
  } catch (error: Error) {
    res.status(500).json({ message: error.message });
  }
};
