-- REVIEWED: intentional — reverses 0015 (drops in FK-dependency order, then enum types).
DROP TABLE IF EXISTS journey_edges;
DROP TABLE IF EXISTS journey_nodes;
DROP TABLE IF EXISTS journeys;
DROP TYPE  IF EXISTS journey_node_type;
DROP TYPE  IF EXISTS journey_status;
