-- Remove job-role representatives (keep only named elected/appointed officials)
DELETE FROM public.representatives WHERE role = 'corporator';
DELETE FROM public.representatives WHERE role = 'Engineer';

-- Update authorities with real logo URLs (use name matching since no slug column)
UPDATE public.authorities SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Mangaluru_City_Corporation_logo.svg/200px-Mangaluru_City_Corporation_logo.svg.png' WHERE name ILIKE '%MCC%' AND department = 'Roads';

UPDATE public.authorities SET logo_url = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ7eICx1w2JA61YQ71Wqw9Czj8t1p7VOhGHfw&s' WHERE name ILIKE '%MESCOM%';

UPDATE public.authorities SET logo_url = 'https://www.kuwsdb.org/wp-content/uploads/2021/06/kuwsdb-logo.png' WHERE name ILIKE '%KUWS%';

UPDATE public.authorities SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Karnataka_Police_logo.svg/200px-Karnataka_Police_logo.svg.png' WHERE name ILIKE '%Traffic Police%';

UPDATE public.authorities SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/NHAI_logo.svg/200px-NHAI_logo.svg.png' WHERE name ILIKE '%NHAI%';

-- Representative photos (9 named officials with real photos, 2 + all job-roles remain UI Avatars)
UPDATE public.representatives SET photo_url = 'https://prsindia.org/files/mptrack/18-lok-sabha/profile_image/180167.jpg' WHERE name ILIKE '%Brijesh%' AND role = 'MP';

UPDATE public.representatives SET photo_url = 'https://cf-images.assettype.com/newindianexpress/2025-03-04/zcz6wfi0/New-Project-2025-03-04T075250.394.jpg' WHERE name ILIKE '%Vedavyas%';

UPDATE public.representatives SET photo_url = 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Bharath%20Shetty%20Y..jpg' WHERE name ILIKE '%Bharath Shetty%';

UPDATE public.representatives SET photo_url = 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Umanatha%20Kotian.jpg' WHERE name ILIKE '%Umanath%';

UPDATE public.representatives SET photo_url = 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Ashok%20Kumar%20Rai.jpg' WHERE name ILIKE '%Ashok Kumar Rai%';

UPDATE public.representatives SET photo_url = 'https://images.news9live.com/wp-content/uploads/2023/05/New-Project-2023-05-15T184542.472.jpg' WHERE name ILIKE '%Bhagirathi%' OR name ILIKE '%Murulya%';

UPDATE public.representatives SET photo_url = 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Harish%20Poonja.jpg' WHERE name ILIKE '%Harish Poonja%';

UPDATE public.representatives SET photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/U._T._Khader.jpg/330px-U._T._Khader.jpg' WHERE name ILIKE '%UT Khader%' OR name ILIKE '%U.T. Khader%';

UPDATE public.representatives SET photo_url = 'https://upload.wikimedia.org/wikipedia/commons/1/19/U_Rajesh_Naik.jpg' WHERE name ILIKE '%Rajesh Naik%';

UPDATE public.representatives SET photo_url = 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Manja.jpg' WHERE name ILIKE '%Manja%' AND role ILIKE 'mayor';
