# n8n Workflows

**Exported:** 2025-12-30T07:28:44.361Z
**Count:** 8

## Workflows

| Name | Status | ID |
|------|--------|-----|
| Viktor Margin - Unit Economics Monitor | 🟢 Active | 0TYASxgS0t5OGIj0 |
| NeuroGUARDIAN Sentinel - Price Defense | 🟢 Active | vUn4GxA6EuAeim3g |
| NeuroGUARDIAN AI Ops Agent | 🟢 Active | i6KEo0rGPOJarr7W |
| NeuroGUARDIAN Product Sync | 🟢 Active | sgLCuEJ6sx1GLZKE |
| NeuroGUARDIAN User Notifications | 🟢 Active | dqLI2o3BIrQyPr9N |
| NeuroGUARDIAN Health Monitor | ⚪ Inactive | pL1ehs40OTg6axJl |
| NeuroGUARDIAN Analytics Report | 🟢 Active | T4cUWZf4uI8gNKyh |
| NeuroGUARDIAN Ops Center | ⚪ Inactive | TDq2vpI1HbpTy6sp |

## Export

```bash
# Export via Docker CLI (default)
npm run n8n:export

# Export via REST API
N8N_USE_API=true N8N_API_KEY=xxx npm run n8n:export
```

## Import

```bash
# Import all workflows to a fresh n8n instance
npm run n8n:import
```

## Manual Import

1. Open n8n UI
2. Workflows → Import from File
3. Select JSON file from this directory
