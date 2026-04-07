### Database Performance Engineering

- **Query Analysis:** Interpreting `EXPLAIN ANALYZE` output, identifying sequential scans, high-cost nodes, and mis-estimated row counts
- **Index Design:** Selecting appropriate index types (B-Tree, GIN, GiST, BRIN, partial, expression), covering indexes, and composite key ordering for query patterns
- **Schema Optimization:** Table normalization vs. denormalization trade-offs, partition strategies (range, list, hash), and TOAST behavior for large values
- **Connection & Concurrency:** Connection pooling with PgBouncer / Neon's built-in pooler, transaction vs. session mode trade-offs, lock contention analysis, and MVCC overhead
- **Vacuuming & Bloat:** Understanding autovacuum triggers, table and index bloat, `pg_stat_user_tables` monitoring, and manual `VACUUM ANALYZE` scheduling
- **Statistics & Planner:** Tuning `statistics_target`, custom statistics for correlated columns, and `pg_stats` inspection to guide the query planner
- **Caching & I/O:** Buffer cache hit rates, `shared_buffers` sizing, effective use of `pg_prewarm`, and identifying I/O-bound vs. CPU-bound workloads
- **Benchmarking:** Load testing with `pgbench`, interpreting TPS/latency percentiles, and regression detection across schema migrations
