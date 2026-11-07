/**
 * Medusa's module loader discovers MikroORM entities from the `models/`
 * directory. Re-export the partner application DML entity here so the
 * module's own manager registers its metadata.
 */
export { PartnerApplication } from "../entities/partner_application";
