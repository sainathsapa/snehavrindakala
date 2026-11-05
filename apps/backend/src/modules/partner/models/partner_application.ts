import { Entity, Property } from "@mikro-orm/core";

@Entity({ tableName: "partner_application" })
export class PartnerApplication {
  id!: string;
  applicant_name!: string;
  email!: string;
  disciplines?: string[] | null;
  portfolio_references?: string[] | null;
  pricing_range?: string | null;
  capacity?: string | null;
  review_status!: "pending" | "approved" | "rejected";
  reviewer_id?: string | null;
  review_notes?: string | null;
  created_at!: Date;
  updated_at!: Date;
}
