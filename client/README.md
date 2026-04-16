# Client

React 19 + Vite admin client for Yappd.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` creates a production build in `dist/`.
- `npm run preview` serves the production build locally.
- `npm run lint` runs ESLint on the client source.

## Main Routes

- `/login` admin sign-in
- `/register` admin workspace creation
- `/dashboard` protected admin dashboard
- `/attendance` weekly attendance board

## Notes

- API calls use the Vite proxy configured in `vite.config.js`.
- Geist fonts are loaded from the installed `geist` package in `src/index.css`.
- In production the built client is served by the Express server from `client/dist`.
