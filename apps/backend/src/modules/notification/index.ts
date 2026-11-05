import type { ModuleExports } from "@medusajs/types";
import { NotificationService } from "./service";

export const NOTIFICATION_MODULE = "notification";

export const notificationModule: ModuleExports<typeof NotificationService> = {
  service: NotificationService,
};

export { NotificationService };
