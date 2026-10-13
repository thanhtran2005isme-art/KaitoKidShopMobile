import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { WalletModule } from "../wallet/wallet.module.js";
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
import { AdminOrderAfterSalesController } from "./admin-order-after-sales.controller.js";
import { AdminOrderAfterSalesService } from "./admin-order-after-sales.service.js";
import { AdminOrderStatusBoundaryInterceptor } from "./admin-order-status-boundary.interceptor.js";
import { AdminPaymentController } from "./admin-payment.controller.js";
import { AdminStaffGuard } from "./admin-staff.guard.js";
import { AdminVietQrService } from "./admin-vietqr.service.js";

@Module({
  imports: [WalletModule],
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
    AdminOrderAfterSalesController,
    AdminOrdersController,
    AdminPagesController,
    AdminPaymentController,
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
  providers: [
    AdminStaffGuard,
    AdminOrderAfterSalesService,
    AdminVietQrService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AdminOrderStatusBoundaryInterceptor,
    },
  ],
})
export class AdminModule {}
