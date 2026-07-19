import type { PartnerView } from "../repositories/deliveryRepository";

export function toPartnerDTO(p: PartnerView) {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    vehicleType: p.vehicleType,
    availabilityStatus: p.availabilityStatus,
    approved: p.approvedAt != null,
  };
}
