# Third-party notices

The project's original [LICENSE](../LICENSE) remains All Rights Reserved. This notice does not relicense the project or its presentation assets.

Runtime/development dependencies have their own licenses in their installed packages and registries. The locked manifests record the selected versions; preserve their required notices when distributing built artifacts.

## DM Sans

The UI self-hosts DM Sans through `@fontsource-variable/dm-sans`. The font is distributed under the **SIL Open Font License 1.1**. Its full supplied notice/license is preserved in [licenses/DM-Sans-OFL.txt](licenses/DM-Sans-OFL.txt). The frontend Docker build also copies that license into the public distribution at `/licenses/dm-sans.txt`.

No Google Fonts network request is made at runtime or build time for the stylesheet/fonts. Fontsource's packaging and the font's own license are distinct from the application license.

## Other components

The application uses Next.js/React, FastAPI/Pydantic/SQLAlchemy/Alembic, Tailwind, TanStack Query, Radix, Lucide icons, Argon2, PostgreSQL/SQLite clients, and Google SDKs. Review the corresponding package notices and your provider terms for the particular deployment; no ownership over those components is asserted here.
