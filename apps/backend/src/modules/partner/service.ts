import { MedusaService } from "@medusajs/medusa";
import { PartnerApplication } from "./models/partner_application";

export class PartnerService extends MedusaService({
  PartnerApplication,
}) {
  async listPending() {
    return this.find({ where: { review_status: "pending" } });
  }
}
