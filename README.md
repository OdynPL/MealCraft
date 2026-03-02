# MealCraft

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## API source

The app uses TheMealDB API: `https://www.themealdb.com/api.php`.

No API key configuration is required for current endpoints used by this project.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## GitHub Actions: CI, Deploy and Release

The repository includes three CI/CD workflows:

- `.github/workflows/ci.yml`
	- Triggers on pull requests to `main`
	- Runs quality gate: lint, test, build

- `.github/workflows/deploy-pages.yml`
	- Triggers on push to `main`
	- Builds Angular app and deploys to **GitHub Pages**
- `.github/workflows/release.yml`
	- Triggers on tags matching `v*.*.*` (for example `v1.0.0`)
	- Runs tests, builds production bundle, and creates a GitHub Release with `release.zip`

### GitHub Pages setup

1. Push repository to GitHub.
2. In repository settings, open **Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main` to trigger deployment.

### Creating a release

Create and push a semantic version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers the release workflow and publishes a release artifact.
