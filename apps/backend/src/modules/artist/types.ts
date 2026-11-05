/**
 * Artist module input/output types.
 * Kept separate from Medusa internal models.
 */

export interface CreateArtistInput {
  display_name: string;
  slug: string;
  bio?: string;
  disciplines?: string[];
  techniques?: string[];
  region?: string;
  portrait_media_id?: string;
  contact_email?: string;
  phone?: string;
  status?: "pending" | "approved" | "suspended";
  commission_available?: boolean;
}

export interface UpdateArtistInput {
  display_name?: string;
  bio?: string;
  disciplines?: string[];
  techniques?: string[];
  region?: string;
  portrait_media_id?: string;
  contact_email?: string;
  phone?: string;
  status?: "pending" | "approved" | "suspended";
  commission_available?: boolean;
  is_verified?: boolean;
}

export interface ArtistFilter {
  offset?: number;
  limit?: number;
  status?: string;
  q?: string;
}

export interface CreatePartnerApplicationInput {
  artist_id?: string;
  applicant_name: string;
  email: string;
  phone?: string;
  disciplines?: string[];
  portfolio_references?: string[];
  pricing_range?: string;
  capacity?: string;
  production_times?: string;
  packaging_ability?: string;
  review_status?: "pending" | "approved" | "rejected";
}

export interface UpdatePartnerApplicationInput {
  review_status?: "pending" | "approved" | "rejected";
  reviewer_id?: string;
  review_notes?: string;
}

export interface CreatePartnerAgreementInput {
  artist_id: string;
  agreement_type: string;
  version: string;
  effective_date: Date;
  expiry_date?: Date;
  commercial_terms_ref?: string;
  signed_document_ref?: string;
  signed_at?: Date;
}

export interface ArtistDTO {
  id: string;
  display_name: string;
  slug: string;
  bio?: string | null;
  disciplines?: string[] | null;
  techniques?: string[] | null;
  region?: string | null;
  portrait_media_id?: string | null;
  status: "pending" | "approved" | "suspended";
  commission_available: boolean;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PartnerApplicationDTO {
  id: string;
  artist_id?: string | null;
  applicant_name: string;
  email: string;
  phone?: string | null;
  disciplines?: string[] | null;
  portfolio_references?: string[] | null;
  pricing_range?: string | null;
  capacity?: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewer_id?: string | null;
  review_notes?: string | null;
  created_at: Date;
  updated_at: Date;
}
