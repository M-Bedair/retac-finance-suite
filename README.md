# RETAC Finance Suite - Standalone Web Migration

This package is generated from the supplied Google Apps Script project. It preserves the existing UI while separating it from the Apps Script project container.

## Pages
- `index.html` - AR / main suite UI
- `contracts.html` - Contracts
- `stock.html` - Stock & expiry
- `custody.html` - Custody & loans

## Important
The Supabase database schema has been created separately. RLS is enabled, so the browser cannot read/write protected tables until authentication policies are created.

### Configure
Edit `js/config.js` and add only:
- Supabase Project URL
- Supabase publishable/anon key

Never add the `service_role` / secret key to browser files or GitHub.

## Migration status
The Google-hosted HTML includes have been flattened into normal HTML pages. A compatibility adapter is included so the original front-end can be migrated function-by-function from `google.script.run` to Supabase. Full write workflows still require the corresponding Supabase queries/RPC functions and RLS policies before production use.

## Local preview
Open the folder with a static web server. GitHub Pages cannot publish a private repository on all plans, so deployment can later use a supported static host or another deployment target.
