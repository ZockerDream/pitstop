-- Kartenränder passend zu einem 8K-Kartenbild der ganzen Insel (Vorgabe des Auftraggebers 2026-11-20):
-- X −5600 bis 6700, Y −4100 bis 8400. Firmen mit der alten Vorgabe bekommen die neuen Ränder, eigene bleiben.
ALTER TABLE companies ALTER COLUMN map_bounds SET DEFAULT '{"x0": -5600, "x1": 6700, "y0": -4100, "y1": 8400}'::jsonb;
UPDATE companies SET map_bounds = '{"x0": -5600, "x1": 6700, "y0": -4100, "y1": 8400}'::jsonb
 WHERE map_bounds = '{"x0": -4000, "x1": 4500, "y0": -4000, "y1": 8000}'::jsonb;
