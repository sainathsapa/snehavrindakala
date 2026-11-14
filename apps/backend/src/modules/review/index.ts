import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { ReviewService } from "./service";

export const REVIEW_MODULE = "review";

export { Review } from "./entities/review";
export { ReviewService };

export const reviewModule: ModuleExports<typeof ReviewService> = {
  service: ReviewService,
};

export default Module(REVIEW_MODULE, { service: ReviewService });