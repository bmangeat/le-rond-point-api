import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Fonction serverless Vercel — point d'entrée HTTP unique.
 *
 * On charge le serveur Nest depuis le code DÉJÀ COMPILÉ (dist/server.js),
 * produit par `nest build` (tsc) durant le build Vercel. C'est volontaire :
 * le runtime de Vercel bundle ce fichier avec esbuild, qui ne génère pas les
 * métadonnées de décorateurs nécessaires à l'injection de dépendances de Nest.
 * En important le dist compilé par tsc, ces métadonnées sont déjà présentes.
 *
 * dist/** est inclus dans le bundle via `functions.includeFiles` (vercel.json).
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { bootstrapServer } = require('../dist/server');

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const server = await bootstrapServer();
  server(req, res);
}
