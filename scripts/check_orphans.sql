SELECT w.id, w.name 
FROM public.workflow_entity w 
LEFT JOIN public.shared_workflow sw ON w.id = sw."workflowId" 
WHERE sw."workflowId" IS NULL;
