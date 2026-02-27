import { UUID } from "node:crypto";

export interface IdentifyRequestBody {
  email?: string;
  phone_number?: string;
}

export interface Contact{
    id: UUID;
    email: string;
    phone_number: string;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
    linked_id: UUID | null;
    link_precedence: "primary" | "secondary";

}