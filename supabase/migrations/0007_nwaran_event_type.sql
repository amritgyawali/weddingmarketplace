-- =============================================================================
-- Customer occasions (P3), part 1: the nwaran (naming ceremony) function.
-- Mirrors 'NWARAN' in EventType (src/types/platform.ts) and EVENT_TYPES
-- (src/data/events.ts). A new enum value can't be used in the transaction
-- that adds it, so the occasion that uses it is updated in 0008.
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

alter type event_type add value if not exists 'NWARAN' after 'PASNI';
