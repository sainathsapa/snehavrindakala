import { MedusaService } from "@medusajs/medusa";
import { CommissionRequest } from "./models/commission_request";

export class CommissionService extends MedusaService({
  CommissionRequest,
}) {
  async getByReference(referenceId: string) {
    return this.findOne({ where: { reference_id: referenceId } });
  }

  async listByCustomer(customerId: string) {
    return this.find({ where: { customer_id: customerId } });
  }
}
