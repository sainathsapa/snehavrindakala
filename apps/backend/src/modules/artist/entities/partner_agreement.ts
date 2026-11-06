/**
 * Partner agreement entity (DML).
 */
import { model } from "@medusajs/utils";

export const PartnerAgreement = model.define("partner_agreement", {
  id: model.text().primaryKey(),
  artist_id: model.text(),
  agreement_type: model.text(),
  version: model.text(),
  effective_date: model.dateTime(),
  expiry_date: model.dateTime().nullable(),
  commercial_terms_ref: model.text().nullable(),
  signed_document_ref: model.text().nullable(),
  signed_at: model.dateTime().nullable(),
});
