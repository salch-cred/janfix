-- Fix incorrect MLA data. Verified against dk.nic.in (District Dakshina Kannada
-- official "Elected Representatives" page) and the Karnataka Legislative
-- Assembly member list (kla.kar.nic.in).
--
-- Correct 2023-2028 term MLAs for Dakshina Kannada district:
--   Moodabidri            -> Umanatha A. Kotian (BJP)
--   Mangaluru City North  -> Dr. Bharath Shetty Y. (BJP)   [already correct]
--   Mangaluru City South  -> D. Vedavyasa Kamath (BJP)     [already correct]
--   Mangaluru             -> U.T. Khader (INC)
--   Bantwal               -> Rajesh Naik U. (BJP)
--   Belthangady           -> Harish Poonja (BJP)           [already correct]
--   Puttur                -> Ashok Kumar Rai (BJP)         [already correct]
--   Sullia (SC)           -> Bhagirathi Murulya (BJP)

-- 1. Umanatha Kotian was mislabeled as the Bantwal MLA. He actually represents
--    Moodabidri.
UPDATE public.representatives
SET name = 'Umanatha A. Kotian',
    constituency = 'Moodabidri',
    photo_url = COALESCE(photo_url, 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Umanatha%20Kotian.jpg')
WHERE role = 'MLA' AND name ILIKE '%Umanath%';

-- 2. "Kagodu Thimmappa" was wrongly listed as the Sullia MLA. He is a retired
--    Shimoga-district politician (Sagar constituency) with no connection to
--    Dakshina Kannada. Sullia's actual MLA is Bhagirathi Murulya.
UPDATE public.representatives
SET name = 'Bhagirathi Murulya',
    constituency = 'Sullia (SC)',
    photo_url = 'https://images.news9live.com/wp-content/uploads/2023/05/New-Project-2023-05-15T184542.472.jpg'
WHERE role = 'MLA' AND name ILIKE '%Kagodu%';

-- 3. "K. Raghavendra Nair" does not match any real Dakshina Kannada MLA.
--    Mangaluru's actual MLA is U.T. Khader.
UPDATE public.representatives
SET name = 'U.T. Khader',
    constituency = 'Mangaluru',
    photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/U._T._Khader.jpg/330px-U._T._Khader.jpg'
WHERE role = 'MLA' AND name ILIKE '%Raghavendra Nair%';

-- 4. Bantwal's actual MLA, Rajesh Naik U., was missing from the representatives
--    table entirely. Add him if not already present.
INSERT INTO public.representatives (name, role, constituency, authority_id, city, photo_url)
SELECT 'Rajesh Naik U.', 'MLA', 'Bantwal', a.id, 'Mangaluru',
       'https://upload.wikimedia.org/wikipedia/commons/1/19/U_Rajesh_Naik.jpg'
FROM public.authorities a
WHERE a.name = 'DK District Administration'
AND NOT EXISTS (
  SELECT 1 FROM public.representatives WHERE role = 'MLA' AND name ILIKE '%Rajesh Naik%'
);
