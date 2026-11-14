import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { CommissionService } from "../../../modules/commission/service";

/**
 * POST /store/commissions
 * Create a new commission request (customer-facing).
 * Reference ID returned for customer tracking.
 */
async function POST(req: MedusaRequest, res: MedusaResponse) {
  const commissionService = req.scope.resolve(
    "commission"
  ) as CommissionService;

  const body = req.body as any;

  const {
    customer_id,
    customer_email,
    art_form,
    brief,
    intended_use,
    dimensions,
    budget_range,
    target_date,
    delivery_region,
    delivery_pin,
    attachments,
  } = body;

  if (!art_form || !brief) {
    return res.status(400).json({ error: "art_form and brief are required" });
  }

  try {
    const commission = await commissionService.createCommissionRequest({
      customer_id,
      // Carried into the acknowledgement email; stripped before persistence by
      // the entity (it is not a column).
      customer_email,
      art_form,
      brief,
      intended_use,
      dimensions,
      budget_range,
      target_date: target_date ? new Date(target_date) : undefined,
      delivery_region,
      delivery_pin,
      status: "New",
    });

    // Reference files were uploaded to private storage by the storefront and
    // only their keys arrive here. Persist one attachment row each so staff can
    // read them through the admin route. A storage failure on one file must not
    // discard a brief that is otherwise complete, so failures are logged and the
    // request still succeeds.
    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        if (!att || typeof att.key !== "string") continue;
        try {
          await commissionService.createCommissionAttachment({
            commission_request_id: commission.id,
            object_key: att.key,
            mime_type: String(att.mime_type || "application/octet-stream"),
            size_bytes: Number(att.size_bytes) || 0,
            original_filename: att.original_filename ?? undefined,
          });
        } catch (attErr) {
          console.error("Failed to persist commission attachment", attErr);
        }
      }
    }

    return res.status(201).json({
      commission_request: {
        id: commission.id,
        reference_id: commission.reference_id,
        status: commission.status,
        created_at: commission.created_at,
      },
      reference_id: commission.reference_id,
    });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to create commission",
    });
  }
}

export { POST };
