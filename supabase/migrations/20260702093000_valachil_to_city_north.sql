-- User-requested override: route Valachil / Bangalagudde issues to the
-- Mangaluru City North MLA (Dr. Bharath Shetty Y.) instead of Bantwal
-- (Rajesh Naik U.). Note: official DK district records associate the
-- Valachil/Farangipet (PIN 574143) locality with Bantwal taluk, but this
-- change reflects an explicit correction requested by the workspace owner.

UPDATE public.area_mappings
SET ward_id = NULL,
    constituency = 'Mangaluru City North',
    city = 'Mangaluru',
    priority = 20
WHERE keyword IN ('valachil', 'bangalagudde');
