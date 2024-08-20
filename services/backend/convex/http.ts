import { httpRouter } from 'convex/server';
// import { onMessage } from './telegram';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { parseTelegramPayload, sendMessage } from '@/utils/telegram';
import { processMessage } from '@/domain/usecases/process-message';

//NOTE: these are deploy on convex.site and NOT convex.cloud
const http = httpRouter();

http.route({
  path: '/onMessage',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    try {
      const message = parseTelegramPayload(await req.json());
      const chatId = message.message?.chat.id;
      //validation
      if (!chatId) {
        console.error('No chat id found', message);
        return new Response(null, { status: 200 });
      }
      if (!message.message?.text) {
        console.error('No message text found', message);
        return new Response(null, { status: 200 });
      }
      try {
        //process the message
        const agentResponse = await processMessage({})({
          inputText: message.message?.text,
        });

        // store the log of the user's message
        await ctx.runMutation(internal.telegram._writeMessage, {
          rawPayload: message,
        });
        //Send a message to the user
        await sendMessage(ctx, { chatId }, async (tg) => {
          return [tg.text(JSON.stringify(agentResponse, null, 2))];
        });
      } catch (error) {
        console.error('failed to process message.', error);
      }
      return new Response(null, { status: 200 });
    } catch (error) {
      console.error('uncaught exception in http onMessage handler:', error);
      return new Response(JSON.stringify(error), { status: 500 });
    }
  }),
});

export default http;
