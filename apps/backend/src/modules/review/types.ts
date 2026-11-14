export interface CreateReviewInput {
  product_id: string;
  variant_id?: string;
  customer_id?: string;
  author_name?: string;
  rating: number;
  title?: string;
  body: string;
  verified?: boolean;
  verification_order_id?: string;
  photos?: { key: string; mime_type?: string }[];
}

export interface ModerateReviewInput {
  status: "approved" | "rejected";
  admin_note?: string;
}

export interface PublicReview {
  id: string;
  product_id: string;
  author_name: string | null;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  created_at: Date;
}

export interface ReviewSummary {
  product_id: string;
  count: number;
  average: number | null;
  distribution: { rating: number; count: number }[];
}