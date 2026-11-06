import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { NotificationService } from "./service";

export const NOTIFICATION_MODULE = "notification";

export const notificationModule: ModuleExports<typeof NotificationService> = {
  service: NotificationService,
};

export { NotificationService };


export default Module(NOTIFICATION_MODULE, { service: NotificationService });
