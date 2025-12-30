-- Ensure user is linked to the project with owner role
INSERT INTO "public"."project_relation" ("projectId", "userId", "role", "createdAt", "updatedAt")
SELECT p.id, u.id, 'project:owner', NOW(), NOW()
FROM "public"."project" p, "public"."user" u
WHERE u.email = 'aineuroexpert@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM "public"."project_relation" pr WHERE pr."projectId" = p.id AND pr."userId" = u.id
);

-- Ensure all workflows belong to the user's project
UPDATE "public"."shared_workflow"
SET "projectId" = (
    SELECT p.id FROM "public"."project" p 
    JOIN "public"."user" u ON p."creatorId" = u.id 
    WHERE u.email = 'aineuroexpert@gmail.com' LIMIT 1
)
WHERE "projectId" IS NULL OR "projectId" NOT IN (SELECT id FROM "public"."project");
