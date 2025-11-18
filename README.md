# Stella's Sky

![Stella's Sky screenshot](./assets/images/splash.png)

Stella's Sky is a mobile and web app built with Expo and React Native. It offers a polished dark UI and leverages modern tooling like Expo Router, TypeScript, and Supabase.

## Tech stack

- Expo & React Native
- Expo Router
- TypeScript
- Supabase
- React Navigation

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Run the app in development

Start the Expo dev server:

```bash
npm run dev
```

Then open the project in the Expo Go app (on a device or emulator) or in the web browser from the Expo dev tools.

### 3. Platform-specific commands

Run on Android:

```bash
npm run android
```

Run on iOS (on macOS):

```bash
npm run ios
```

## Building for web

You can generate a static web build with:

```bash
npm run build:web
```

This will output the production web assets into the `dist` directory.

## Project configuration

Key configuration files:

- `app.json` – Expo app configuration (name, icons, plugins, etc.)
- `app/` – App routes and screens (Expo Router)
- `components/` – Reusable UI components
- `assets/` – Icons, images (including the app splash image used above)

## License

This project is maintained by @bahaeddinmselmi. Licensing details can be added here if needed.
