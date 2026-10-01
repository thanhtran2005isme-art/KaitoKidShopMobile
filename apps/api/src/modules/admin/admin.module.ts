import { Module } from "@nestjs/common";
import {
  AdminAttributesController,
  AdminBannersController,
  AdminCategoriesController,
} from "./admin-content-base.controller.js";
import {
  AdminCollectionsController,
  AdminCouponsController,
  AdminFlashSalesController,
  FlashSalesController,
} from "./admin-content-sales.controller.js";
import {
  AdminHomepageBlocksController,
  AdminHomepageController,
} from "./admin-content-home.controller.js";
import {
  AdminLookbookController,
  AdminMenusController,
  AdminPagesController,
  AdminPromotionsController,
  AdminReviewsController,
  AdminSettingsController,
  AdminSuppliersController,
} from "./admin-content-more.controller.js";
import {
  AdminCustomersController,
  AdminProductsController,
  AdminReportsController,
} from "./admin-catalog.controller.js";
import {
  AdminInventoryController,
  AdminOrdersController,
  AdminStockReceiptsController,
  AdminVariantStockController,
} from "./admin-operations.controller.js";
import { AdminStaffGuard } from "./admin-staff.guard.js";

@Module({
  controllers: [
    AdminAttributesController,
    AdminBannersController,
    AdminCategoriesController,
    AdminCollectionsController,
    AdminCouponsController,
    AdminCustomersController,
    AdminFlashSalesController,
    AdminHomepageBlocksController,
    AdminHomepageController,
    AdminInventoryController,
    AdminLookbookController,
    AdminMenusController,
    AdminOrdersController,
    AdminPagesController,
    AdminProductsController,
    AdminPromotionsController,
    AdminReportsController,
    AdminReviewsController,
    AdminSettingsController,
    AdminStockReceiptsController,
    AdminSuppliersController,
    AdminVariantStockController,
    FlashSalesController,
  ],
  providers: [AdminStaffGuard],
})
export class AdminModule {}
