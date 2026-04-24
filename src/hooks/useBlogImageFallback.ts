import { useState, useCallback } from "react";

// Static blog images stored locally — never break, always available
import dubaiVacation from "@/assets/blog/dubai-vacation-packages.jpg";
import culturalTravel from "@/assets/blog/cultural-travel-experiences.jpg";
import baliHoneymoon from "@/assets/blog/bali-honeymoon-packages.jpg";
import budgetTravel from "@/assets/blog/budget-travel-tips.jpg";
import flightBooking from "@/assets/blog/flight-booking-tips.jpg";
import luxuryBudget from "@/assets/blog/luxury-travel-budget.jpg";
import soloAdventure from "@/assets/blog/solo-adventure-guide.jpg";
import hiddenGems from "@/assets/blog/hidden-gems-southeast-asia.jpg";
import bangkokBudget from "@/assets/blog/bangkok-budget-guide.jpg";
import dubaiVsSingapore from "@/assets/blog/dubai-vs-singapore.jpg";
import hotelDeals from "@/assets/blog/hotel-deals-secrets.jpg";
import coxsBazarBali from "@/assets/blog/coxs-bazar-to-bali.jpg";
import streetFood from "@/assets/blog/street-food-world.jpg";
import soloFemale from "@/assets/blog/solo-female-travel.jpg";
import trekkingNepal from "@/assets/blog/trekking-nepal.jpg";
import travelInsurance from "@/assets/blog/travel-insurance-guide.jpg";
import australiaNz from "@/assets/blog/australia-nz-travel.jpg";
import islandHopping from "@/assets/blog/island-hopping-guide.jpg";
import baliHoneymoonArabic from "@/assets/blog/bali-honeymoon-arabic.jpg";

/** Map blog post IDs with broken Unsplash URLs to local static images */
const LOCAL_IMAGE_MAP: Record<string, string> = {
  // Hindi - Dubai vacation
  "3317b179-aaee-4d40-90a7-4b9ffef47e1e": dubaiVacation,
  // Cultural travel experiences
  "daf35b69-4118-49a7-9cc5-225b9ace9051": culturalTravel,
  // Bali honeymoon
  "b2a9ce3b-d1cd-4bfd-a7e8-da0c7f232c41": baliHoneymoon,
  // Budget travel tips
  "3a5ec7bb-5f18-41e3-97c7-820acd7a257d": budgetTravel,
  // Flight booking tips
  "97edad99-4049-4460-aac7-2aec85e14ff4": flightBooking,
  // Bengali - Luxury travel on budget
  "a1e094a7-f53e-4250-a7d7-5cbbaa82d1b3": luxuryBudget,
  // Solo adventure guide
  "ecf90d49-bf62-417f-af4f-fd8a0821de08": soloAdventure,
  // Hidden gems Southeast Asia
  "eb0574fe-8887-4583-a7eb-26d0dd2e706a": hiddenGems,
  // Bangkok budget
  "698555af-1823-4ac1-bedb-6327923fb09d": bangkokBudget,
  // Dubai vs Singapore
  "ddacdd24-980f-4bdc-bd5c-0e92d3d32cc3": dubaiVsSingapore,
  // Hotel deals secrets
  "6438e93b-a7ef-48c0-b3c4-bd0cb36d74aa": hotelDeals,
  // Cox's Bazar to Bali
  "fec4fc9c-4b63-448e-89f1-cda522027d75": coxsBazarBali,
  // Street food world
  "8c3c6cae-7c42-4fc8-8f30-9d8a4f01027b": streetFood,
  // Solo female travel
  "9c9d9d01-6956-46f5-a8c6-7666d5d81c1b": soloFemale,
  // Trekking Nepal
  "28285ea7-1039-4e60-8f14-5c6018bec3da": trekkingNepal,
  // Travel insurance
  "9322d71b-9831-4afc-9d97-28bebecc008c": travelInsurance,
  // Australia & NZ travel (Bengali)
  "4a583f77-ff7f-4a33-b6ac-c54f302fc9be": australiaNz,
  // Island Hopping Guide
  "4ac4e1a2-0278-48ef-ba58-9fc8f4848d6c": islandHopping,
  // Arabic Bali honeymoon
  "d511eb3e-83c1-4375-b0db-f47830a7ffc5": baliHoneymoonArabic,
};

/**
 * Blog image hook — uses local static images for known posts with broken URLs,
 * falls back to featured_image, and shows gradient placeholder if missing.
 */
export const useBlogImageFallback = (
  postId: string,
  featuredImage: string | null,
  _title: string,
  _excerpt?: string | null,
  _tags?: string[]
): { imageUrl: string | null; isLoading: boolean; onImageError: () => void } => {
  // Check if we have a local replacement for this post
  const localImage = LOCAL_IMAGE_MAP[postId];
  const initialUrl = localImage || featuredImage;
  const [imageUrl, setImageUrl] = useState<string | null>(initialUrl);

  const onImageError = useCallback(() => {
    // If the featured image failed, try the local fallback
    if (!localImage) {
      setImageUrl(null);
    } else if (imageUrl !== localImage) {
      setImageUrl(localImage);
    } else {
      setImageUrl(null);
    }
  }, [localImage, imageUrl]);

  return { imageUrl, isLoading: false, onImageError };
};
