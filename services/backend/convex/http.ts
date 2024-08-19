import { httpRouter } from 'convex/server';
// import { onMessage } from './telegram';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { parseTelegramPayload, sendMessage } from '@/utils/telegram';

//NOTE: these are deploy on convex.site and NOT convex.cloud
const http = httpRouter();

http.route({
  path: '/onMessage',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    try {
      const message = parseTelegramPayload(await req.json());
      const chatId = message.message?.chat.id;
      if (!chatId) {
        console.error('No chat id found', message);
        return new Response(null, { status: 200 });
      }
      await ctx.runMutation(internal.telegram._writeMessage, {
        rawPayload: message,
      });
      try {
        //Send a message to the user
        await sendMessage(ctx, { chatId }, async (tg) => {
          return [tg.text('Hello')];
        });
      } catch (error) {
        console.error('failed to send telegram message.', error);
      }
      return new Response(null, { status: 200 });
    } catch (error) {
      console.error('uncaught exception in http onMessage handler:', error);
      return new Response(JSON.stringify(error), { status: 500 });
    }
  }),
});

export default http;
