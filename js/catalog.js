export const SPARK_CDN = 'https://sparkjs.dev/assets/splats/';

export const SPARK_MODELS = [
  { id: 'butterfly', file: 'butterfly.spz', name: 'Butterfly', mb: 3.8, tag: 'demo' },
  { id: 'butterfly-ai', file: 'butterfly-ai.spz', name: 'Butterfly AI', mb: 2.0, tag: 'demo' },
  { id: 'butterfly-closed', file: 'butterfly-wings-closed.spz', name: 'Wings Closed', mb: 3.7, tag: 'demo' },
  { id: 'robot-head', file: 'robot-head.spz', name: 'Robot Head', mb: 1.1, tag: 'object' },
  { id: 'pedestal', file: 'pedestal.spz', name: 'Pedestal', mb: 1.7, tag: 'object' },
  { id: 'penguin', file: 'penguin.spz', name: 'Penguin', mb: 2.4, tag: 'object' },
  { id: 'cat', file: 'cat.spz', name: 'Cat', mb: 5.1, tag: 'object' },
  { id: 'fly', file: 'fly.spz', name: 'Fly', mb: 4.6, tag: 'object' },
  { id: 'fireplace', file: 'fireplace.spz', name: 'Fireplace', mb: 4.2, tag: 'scene' },
  { id: 'dessert', file: 'dessert.spz', name: 'Dessert', mb: 4.5, tag: 'object' },
  { id: 'anvil', file: 'anvil.spz', name: 'Anvil', mb: 5.8, tag: 'object' },
  { id: 'distant-igloo', file: 'distant-igloo.spz', name: 'Igloo', mb: 4.8, tag: 'scene' },
  { id: 'forge', file: 'forge.spz', name: 'Forge', mb: 5.7, tag: 'scene' },
  { id: 'furry', file: 'furry.spz', name: 'Furry', mb: 5.7, tag: 'object' },
  { id: 'valley', file: 'valley.spz', name: 'Valley', mb: 6.4, tag: 'scene' },
];

export const sparkUrl = (file) => SPARK_CDN + file;

export const modelById = (id) => SPARK_MODELS.find((m) => m.id === id) ?? SPARK_MODELS[0];
