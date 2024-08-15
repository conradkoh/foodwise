import { httpRouter } from 'convex/server';
// import { onMessage } from './telegram';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

//NOTE: these are deploy on convex.site and NOT convex.cloud
const http = httpRouter();

http.route({
  path: '/onMessage',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const data = await req.json();
    await ctx.runMutation(internal.telegram._writeMessage, {
      rawPayload: data,
    });
    return new Response(null, { status: 200 });
  }),
});

export default http;
