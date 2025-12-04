# Publishing to npm

This guide explains how to publish the `lyngdorf-mcp` package to npm.

## Prerequisites

1. An npm account (create at https://www.npmjs.com/signup)
2. npm CLI installed (comes with Node.js)
3. Publishing rights to the `lyngdorf-mcp` package (or available package name)

## First-Time Setup

### 1. Login to npm

```bash
npm login
```

This will prompt you for your npm credentials and store them securely.

Alternatively, you can use an npm access token:

```bash
npm config set //registry.npmjs.org/:_authToken=YOUR_TOKEN_HERE
```

**Important**: If using a token, it will be stored in `~/.npmrc`. Never commit `.npmrc` to git (already in `.gitignore`).

### 2. Verify your login

```bash
npm whoami
```

## Publishing a New Version

### 1. Update the version

Use npm's built-in version command:

```bash
# Patch release (1.0.0 -> 1.0.1)
npm version patch

# Minor release (1.0.0 -> 1.1.0)
npm version minor

# Major release (1.0.0 -> 2.0.0)
npm version major
```

This will:
- Update `package.json` version
- Create a git commit with the version change
- Create a git tag

### 2. Review what will be published

```bash
npm pack --dry-run
```

This shows exactly which files will be included in the package.

### 3. Run tests and build

The `prepublishOnly` script will automatically run tests and build before publishing, but you can run manually:

```bash
npm run build
npm test
```

### 4. Publish to npm

```bash
npm publish
```

This will:
1. Run `prepublishOnly` script (build + test)
2. Create the package tarball
3. Upload to npm registry

### 5. Push to git

```bash
git push origin main --follow-tags
```

## Security Best Practices

### Protect your npm token

- Never commit `.npmrc` files containing tokens
- Use environment variables in CI/CD: `NPM_TOKEN`
- Use automation tokens for CI, not your personal token
- Rotate tokens regularly

### Two-Factor Authentication

Enable 2FA on your npm account:

```bash
npm profile enable-2fa auth-and-writes
```

## CI/CD Publishing (Optional)

For automated publishing via GitHub Actions:

1. Generate an automation token at https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Add as `NPM_TOKEN` secret in GitHub repository settings
3. Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Troubleshooting

### "You do not have permission to publish"

- Verify you're logged in: `npm whoami`
- Check package name availability: `npm view lyngdorf-mcp`
- If name is taken, update `package.json` name field

### "Tests failed"

The `prepublishOnly` script runs tests automatically. Fix failing tests before publishing.

### "No such file or directory: dist/"

Run `npm run build` to compile TypeScript to JavaScript.

## Package Maintenance

### Unpublishing

You can unpublish within 72 hours:

```bash
npm unpublish lyngdorf-mcp@1.0.0
```

After 72 hours, contact npm support.

### Deprecating versions

```bash
npm deprecate lyngdorf-mcp@1.0.0 "Security vulnerability, upgrade to 1.0.1"
```

### Checking package info

```bash
npm view lyngdorf-mcp
npm view lyngdorf-mcp versions
```
