-- Bangalagudde and Valachil are hamlets near Farangipet (PIN 574143), which is
-- administratively part of Bantwal taluk, NOT the Deralakatte ward inside
-- Mangaluru City Corporation limits. The original seed data incorrectly
-- mapped both keywords to ward 19 (Deralakatte) + 'Mangaluru City South',
-- which misrouted issues reported there to the wrong civic body/MLA.

UPDATE public.area_mappings
SET ward_id = NULL,
    constituency = 'Bantwal',
    city = NULL,
    priority = 15
WHERE keyword IN ('valachil', 'bangalagudde');

-- Re-point any issues already resolved with the old (incorrect) mapping so
-- they route to the correct authority/representative going forward. This only
-- touches issues whose routing reason recorded the old area match.
UPDATE public.issues
SET assigned_ward_id = NULL
WHERE assigned_ward_id = (SELECT id FROM public.wards WHERE name = 'Deralakatte')
  AND (lower(coalesce(area, '')) LIKE '%bangalagudde%' OR lower(coalesce(area, '')) LIKE '%valachil%'
       OR lower(coalesce(locality, '')) LIKE '%bangalagudde%' OR lower(coalesce(locality, '')) LIKE '%valachil%'
       OR lower(coalesce(address, '')) LIKE '%bangalagudde%' OR lower(coalesce(address, '')) LIKE '%valachil%');
