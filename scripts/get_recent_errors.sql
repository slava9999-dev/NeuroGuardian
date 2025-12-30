SELECT 
    e.id AS execution_id,
    w.name AS workflow_name,
    e.status,
    e."startedAt",
    EXTRACT(EPOCH FROM (e."stoppedAt" - e."startedAt")) * 1000 AS duration_ms
FROM public.execution_entity e
JOIN public.workflow_entity w ON e."workflowId" = w.id
WHERE e.status = 'error'
ORDER BY e."startedAt" DESC
LIMIT 5;
