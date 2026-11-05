/**
 * Private reference/customer upload for a commission request (plain class).
 */
export class CommissionAttachment {
  id!: string;
  commission_request_id!: string;
  object_key!: string;
  mime_type!: string;
  size_bytes!: number;
  original_filename?: string | null;
  scan_complete!: boolean;
  scan_passed!: boolean;
  scan_result?: string | null;
  retention_delete_at?: Date | null;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<CommissionAttachment>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    this.scan_complete = this.scan_complete ?? false;
    this.scan_passed = this.scan_passed ?? false;
    this.created_at = this.created_at || new Date();
    this.updated_at = new Date();
  }
}
