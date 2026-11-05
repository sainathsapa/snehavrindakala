/**
 * Partner agreement entity (plain class).
 */
export class PartnerAgreement {
  id!: string;
  artist_id!: string;
  agreement_type!: string;
  version!: string;
  effective_date!: Date;
  expiry_date?: Date | null;
  commercial_terms_ref?: string | null;
  signed_document_ref?: string | null;
  signed_at?: Date | null;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<PartnerAgreement>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    this.created_at = this.created_at || new Date();
    this.updated_at = new Date();
  }
}
