/** Topic dimension of the preposition deck, stored as a `tema:<topic>` tag. */
export const TOPICS = ['sted', 'stedsnavn', 'bevegelse', 'tid', 'verb', 'fast-uttrykk', 'middel'] as const;

export type Topic = (typeof TOPICS)[number];
