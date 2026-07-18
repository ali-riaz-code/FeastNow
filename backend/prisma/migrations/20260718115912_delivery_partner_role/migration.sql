-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('bike', 'motorcycle', 'car');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('offline', 'online');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryLat" DOUBLE PRECISION,
ADD COLUMN     "deliveryLng" DOUBLE PRECISION,
ADD COLUMN     "deliveryPartnerId" TEXT,
ADD COLUMN     "outForDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "payoutCents" INTEGER,
ADD COLUMN     "proofNote" TEXT;

-- AlterTable
ALTER TABLE "RestaurantProfile" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "DeliveryPartnerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "idDocumentUrl" TEXT,
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'offline',
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "locationUpdatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryPartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryOffer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'pending',
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartnerProfile_userId_key" ON "DeliveryPartnerProfile"("userId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerProfile_availabilityStatus_idx" ON "DeliveryPartnerProfile"("availabilityStatus");

-- CreateIndex
CREATE INDEX "DeliveryOffer_partnerId_status_idx" ON "DeliveryOffer"("partnerId", "status");

-- CreateIndex
CREATE INDEX "DeliveryOffer_orderId_status_idx" ON "DeliveryOffer"("orderId", "status");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");
