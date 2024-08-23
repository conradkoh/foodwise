import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { parseTelegramPayload, sendMessage } from '@/utils/telegram';
import { processMessage } from '@/domain/usecases/process-message';
import { MessageUsageMetric } from '@/domain/entities/message';

const http = httpRouter();

http.route({
  path: '/onMessage',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    try {
      const message = parseTelegramPayload(await req.json());
      const chatId = message.message?.chat.id;
      const userId = message.message?.from.id;
      //validation
      if (!chatId) {
        console.error('No chat id found', message);
        return new Response(null, { status: 200 });
      }
      if (!userId) {
        console.error('No user id found', message);
        return new Response(null, { status: 200 });
      }
      if (!message.message?.text) {
        console.error('No message text found', message);
        return new Response(null, { status: 200 });
      }
      try {
        // try to get the user id from the database
        let user = await ctx.runQuery(internal.user._getTelegramUser, {
          telegramUserId: userId,
        });

        // create user if not found
        if (!user) {
          user = await ctx.runMutation(internal.user._createUser, {
            type: 'telegram',
            telegram: {
              userId: userId,
              firstName: message.message?.from.first_name,
              lastName: message.message?.from.last_name,
              username: message.message?.from.username,
            },
          });
        }

        const timestamp = new Date().getTime();

        let response = {
          isValid: false,
          intermediates: null as any | null,
          value: 'Failed to process message',
        };
        let usageMetrics: MessageUsageMetric[] | undefined = undefined;
        try {
          //process the message
          const agentResponse = await processMessage({
            recordUserWeight: async (weight) => {
              await ctx.runMutation(internal.user._recordUserWeight, {
                userId: user._id,
                weight,
                timestamp,
              });
            },
            recordUserMealAndCalories: async ({
              meal,
              items,
              totalCalories,
            }) => {
              await ctx.runMutation(internal.user._recordUserMealAndCalories, {
                userId: user._id,
                items,
                totalCalories,
                timestamp,
              });
            },
            recordActivityAndBurn: async ({ activity, caloriesBurned }) => {
              await ctx.runMutation(internal.user._recordActivityAndBurn, {
                userId: user._id,
                activity,
                caloriesBurned,
                timestamp,
              });
            },
            setUserTimezone: async (timezone) => {
              await ctx.runMutation(internal.user._setUserTimezone, {
                userId: user._id,
                timezone,
              });
            },
            getUserTimezone: async () => {
              return user.timezone;
            },
          })({
            inputText: message.message?.text,
          });
          // update usage metrics
          usageMetrics = [...agentResponse.usageMetrics];
          // update response
          switch (agentResponse.isError) {
            case true: {
              response = {
                isValid: false,
                value: 'Failed to process message',
                intermediates: agentResponse.intermediates,
              };
              break;
            }
            case false: {
              response = {
                isValid: true,
                value: agentResponse.intermediates.stage2Output?.response,
                intermediates: agentResponse.intermediates,
              };
              break;
            }
          }

          console.log(JSON.stringify(agentResponse, null, 2));
        } catch (error) {
          console.error('failed to process message.', error);
          response = {
            isValid: false,
            value: 'Failed to process message',
            intermediates: null as any | null,
          };
        }

        // store the log of the user's message
        try {
          await ctx.runMutation(internal.message._write, {
            source: 'telegram',
            status: response.isValid ? 'processed' : 'failed',
            rawPayload: message,
            intermediates: response.intermediates,
            response: response.value,
            usageMetrics,
            totalCostEstimated: usageMetrics?.reduce(
              (state, metric) => {
                // aggregate by currency
                let stateForCurrency: { currency: 'USD'; value: number } =
                  state.index[metric.openAI.cost.currency];

                // init state for currency if not available
                if (!stateForCurrency) {
                  let val = {
                    currency: metric.openAI.cost.currency,
                    value: 0,
                  };
                  state.index[metric.openAI.cost.currency] = val; //set in index
                  state.result.push(val);
                  stateForCurrency = val;
                }
                // start processing kinds metrics
                switch (metric.type) {
                  case 'openai': {
                    // increment total
                    stateForCurrency.value += metric.openAI.cost.total;
                    break;
                  }
                  default: {
                    // exhaustive switch for type
                    const _: never = metric.type;
                  }
                }
                return state;
              },
              {
                index: {} as Record<'USD', { currency: 'USD'; value: number }>,
                result: [] as { currency: 'USD'; value: number }[],
              }
            ).result,
          });
        } catch (error) {
          console.error('failed to write message to db', error);
        }

        //Send a message to the user
        await sendMessage(ctx, { chatId }, async (tg) => {
          return [tg.text(response.value)];
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
