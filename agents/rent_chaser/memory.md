# Rent chaser — memory (template)

Production **per-user memory** lives in Supabase (`user_agent_memory`), not in this file. Use this document to describe what gets stored:

| Key | Example | Use |
|-----|---------|-----|
| `preferred_opening` | "We hope you're well" | Optional stylistic preference |
| `last_correction` | "Never mention Section 8" | Free-text correction from landlord |

The app loads these rows in `ContextLoader` and injects them under a **Memory** section in the model context.
