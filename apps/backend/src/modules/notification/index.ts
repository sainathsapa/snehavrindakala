import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { NotificationService } from "./service";

export const NOTIFICATION_MODULE = "notification";

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
