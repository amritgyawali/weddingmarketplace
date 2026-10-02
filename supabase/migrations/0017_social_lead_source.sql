-- =============================================================================
-- Social hub, part 1: leads that start on Facebook, Instagram, WhatsApp or
-- TikTok. Mirrors Lead.source 'social' (src/types/platform.ts). A new enum
-- value can't be used in the transaction that adds it, so the social hub
-- itself (and rpc_social_lead, which uses it) is in 0018.
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

alter type lead_source add value if not exists 'SOCIAL';
