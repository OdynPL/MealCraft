# MealCraft

MealCraft is an Angular 21 recipe application for browsing meals from TheMealDB, creating local recipes, editing your own entries, and managing recipe feedback (votes + tags).

## What the app does

- Browses recipes from TheMealDB API.
- Supports local custom recipes (create, edit, delete) per logged-in user.
- Merges API recipes, dummy recipes and local recipes into one grid.
- Provides filtering and sorting (search, cuisine, category, tags, mine-only).
- Supports authentication with roles (`user` / `admin`) and a seeded admin account.
- Includes User Settings and Admin Settings with admin-only data reset.

## Admin credentials (seeded)

The app automatically seeds a permanent admin account:

- Email: `admin@admin.pl`
- Password: `admin@admin.pl`

Important: these credentials are intended for local/dev usage only. Change them immediately if you use this project in any shared or public environment.

## Change Log

### 2026-03-03

From start to finish, we evolved MealCraft from a basic recipe browser into a complete, role-aware recipe platform with stronger UX, security, and maintainability.

The most important delivered features:

- Unified recipe experience: API recipes + dummy recipes + local user recipes in one grid, with filters, sorting, tags, voting, and mine-only mode.
- Full local recipe management: add/edit/delete own recipes, ownership rules, and consistent author/metadata handling.
- Authentication upgrade: register/login with persistent session handling, remember-me behavior, account lock protection, and seeded admin account.
- Admin capabilities: dedicated Admin Settings, admin-only Dummy Products control, and full **Reset all data & reload** recovery action.
- Architecture and quality improvements: lazy-loaded routes, service/store refactors, improved settings UX, and broad automated test coverage for critical flows.

## What we are adding next (planned)

- Admin account management UI (e.g. unlock accounts / role governance).
- Additional optimization passes for initial bundle size.
- Optional E2E coverage for critical admin flows.

## Development server

To start a local development server, run:

```bash
npm run start
```

Then open `http://localhost:4200/`.

## API source

The app uses TheMealDB API: `https://www.themealdb.com/api.php`.

No API key configuration is required for current endpoints used by this project.

## Building

To build the project, run:

```bash
npm run build
```

Build artifacts are written to the `dist/` directory.

## Running tests

Run tests in CI mode:

```bash
npm run test:ci
```

Run tests in watch mode:

```bash
npm run test
```

## Angular CLI scaffolding

To generate a new component:

```bash
ng generate component component-name
```

List all schematics:

```bash
ng generate --help
```

## Additional resources

For Angular CLI docs, visit [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).

## GitHub Actions: CI, Deploy and Release

The repository includes three CI/CD workflows:

- `.github/workflows/ci.yml`
	- Triggers on pull requests to `main`
	- Runs quality gate: lint, test, build

- `.github/workflows/deploy-pages.yml`
	- Triggers on push to `main`
	- Builds Angular app and deploys to GitHub Pages

- `.github/workflows/release.yml`
	- Triggers on tags matching `v*.*.*` (for example `v1.0.0`)
	- Runs tests, builds production bundle, and creates a GitHub Release with `release.zip`

### GitHub Pages setup

1. Push repository to GitHub.
2. In repository settings, open Pages.
3. Set Source to GitHub Actions.
4. Push to `main` to trigger deployment.

### Creating a release

Create and push a semantic version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers the release workflow and publishes a release artifact.
