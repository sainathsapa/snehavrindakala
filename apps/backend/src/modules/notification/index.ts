import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { NotificationService } from "./service";

/**
 * Distinct from Medusa's built-in module key. Using plain "notification" made the
 * container keep Medusa's own service, and `sendNotification` then did not exist —
 * every transactional email 500'd. Keep this key and the table below in sync.
 */
export const NOTIFICATION_MODULE = "app_notification";

export { Notification } from "./entities/notification";
export type { NotificationStatus, NotificationChannel } from "./entities/notification";
export { NotificationService };

/**
 * The notification module. DML entities are auto-registered with MikroORM via
 * NotificationService extending MedusaService({ Notification }).
 */
export const notificationModule: ModuleExports<typeof NotificationService> = {
  service: NotificationService,
};

export default Module(NOTIFICATION_MODULE, { service: NotificationService });
