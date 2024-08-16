import { httpRouter } from 'convex/server';
// import { onMessage } from './telegram';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { parseTelegramPayload } from '@/utils/telegram';

//NOTE: these are deploy on convex.site and NOT convex.cloud
const http = httpRouter();

http.route({
  path: '/onMessage',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    try {
      const data = parseTelegramPayload(await req.json());
      await ctx.runMutation(internal.telegram._writeMessage, {
        rawPayload: data,
      });
      return new Response(null, { status: 200 });
    } catch (error) {
      return new Response(JSON.stringify(error), { status: 500 });
    }
  }),
});

export default http;
