import * as Cloudflare from '@alchemy.run/cloudflare';
import * as Alchemy from 'alchemy';
import * as Effect from 'effect/Effect';

export const Website = Cloudflare.Website.Foldkit('Foldkit');

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
    'Stitch-n-glitch',
    {
        providers: Cloudflare.providers(),
        state: Cloudflare.state(),
    },
    Effect.gen(function* () {
        const worker = yield* Cloudflare.Website.Foldkit('Foldkit');
        return { url: worker.url };
    }),
);
