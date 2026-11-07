/**
 * Medusa's module loader discovers MikroORM entities from the `models/`
 * directory. Re-export the partner agreement DML entity here so the
 * module's own manager registers its metadata.
 */
export { PartnerAgreement } from "../entities/partner_agreement";
