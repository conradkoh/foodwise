# Convex Telegram Helpers

## Usage

## Generate a new telegram secret

1. Generate a new secret token

```sh
yarn bun src/utils/telegram/scripts/generate-webhook-secret.tss
```

2. Set the secret token in the environment variables in your convex console

```sh
yarn  convex env set TELEGRAM_WEBHOOK_SECRET <your-secret-token>
```

## Registering the webhook

1. Implement a http endpoint to handle the webhook

   ```ts
   import { httpRouter } from 'convex/server';
   import { httpAction } from './_generated/server';
   import { internal } from './_generated/api';
   import { parseTelegramPayload } from '@/utils/telegram';
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
   ```

2. Expose the webhook actions in convex/telegram.ts

   ```ts
   export const registerWebhook = registerWebhookAction;
   export const sendMessage = sendMessageAction;
   ```

3. Execute the `registerWebhook` function from the convex console to register the webhook with telegram. Remember that this needs to be run for each environment.

4. Send replies to messages using the `sendMessage` function.

```ts
http.route({
  path: '/onMessage',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    try {
      const message = parseTelegramPayload(await req.json());
      const chatId = message.message?.chat.id;
      if (!chatId) {
        console.error('No chat id found', message);
        return new Response(null, { status: 200 }); //ignore the message for those we can't handle for now
      }
      //Send a message to the user
      await sendMessage(ctx, { chatId }, async (tg) => {
        return [tg.text('Hello')];
      });
      return new Response(null, { status: 200 });
    } catch (error) {
      console.error('uncaught exception in http onMessage handler:', error);
      return new Response(JSON.stringify(error), { status: 500 });
    }
  }),
});
```
