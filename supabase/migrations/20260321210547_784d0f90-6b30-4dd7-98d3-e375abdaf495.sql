
-- Add parent domain support for hierarchical white-label DNS
ALTER TABLE public.whitelabel_sites
  ADD COLUMN IF NOT EXISTS parent_domain text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_subdomain_of uuid REFERENCES public.whitelabel_sites(id);

-- parent_domain: the agent's custom domain used as CNAME target for sub-agents
-- is_subdomain_of: links sub-agent's site to parent agent's site for hierarchy tracking

COMMENT ON COLUMN public.whitelabel_sites.parent_domain IS 'Agent custom domain used as CNAME target for sub-agent sites (e.g., agenttravel.com)';
COMMENT ON COLUMN public.whitelabel_sites.is_subdomain_of IS 'References parent agent white-label site for hierarchical DNS';
