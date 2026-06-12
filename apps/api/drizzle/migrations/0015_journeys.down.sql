-- Reverses 0015. Drops in FK-dependency order, then enum types.
DROP TABLE IF EXISTS journey_edges; -- REVIEWED: intentional
DROP TABLE IF EXISTS journey_nodes; -- REVIEWED: intentional
DROP TABLE IF EXISTS journeys;      -- REVIEWED: intentional
DROP TYPE  IF EXISTS journey_node_type;
DROP TYPE  IF EXISTS journey_status;
