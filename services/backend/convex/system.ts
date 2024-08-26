import { SystemUsage } from '@/domain/entities/system';
import { internal } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { internalAction, internalQuery } from 'convex/_generated/server';
import { v } from 'convex/values';
import { DateTime } from 'luxon';

export const usageReport = internalAction({
  args: {
    offset: v.optional(v.number()), //starts at 0
    limit: v.optional(v.number()), //starts at 3
  },
  handler: async (ctx, args) => {
    const currentDate = DateTime.now();
    const usages: SystemUsage[] = await Promise.all(
      new Array((args.offset || 0) + (args.limit || 3))
        .fill(undefined)
        .map(async (_, idx) => {
          const date = currentDate.minus({ months: idx });
          const usage: SystemUsage = await ctx.runQuery(
            internal.system._getMonthlyUsage,
            {
              year: date.year,
              month: date.month,
            }
          );
          return usage;
        })
    );
    // formatting
    let report = `Usage Report`;
    for (const monthlyUsage of usages) {
      report += `\n  Month: ${monthlyUsage.cycle.year}-${monthlyUsage.cycle.month}`;
      if (monthlyUsage.totalCost.length === 0) {
        report += `\n    No data found.`;
        continue;
      }
      for (const costForCurrency of monthlyUsage.totalCost) {
        report += `\n      - ${costForCurrency.currency}: ${costForCurrency.value}`;
      }

      // user usage
      report += `\n\nUser Usage Report`;
      for (const userUsage of monthlyUsage.costByUser) {
        const user = await ctx.runQuery(internal.user._getUser, {
          userId: userUsage.userId,
        });
        let userName = 'unknown';
        if (user.type === 'telegram') {
          let tokens = [user.telegram.firstName, user.telegram.lastName];
          if (tokens.length > 0) {
            userName = tokens.join(' ');
          } else {
            userName = 'No access to telegram user name.';
          }
        }
        report += `\n  User: ${userName} (${userUsage.userId})`;

        for (const costForCurrency of userUsage.costs) {
          report += `\n    - ${costForCurrency.currency}: ${costForCurrency.value.toFixed(2)}`;
        }
      }
    }
    return report;
  },
});

export const _getMonthlyUsage = internalQuery({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args): Promise<SystemUsage> => {
    const startOfMonth = DateTime.fromObject({
      year: args.year,
      month: args.month,
      day: 1,
    });
    const endOfMonth = startOfMonth.endOf('month');
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_creation_time', (q) =>
        q
          .gte('_creationTime', startOfMonth.toMillis())
          .lte('_creationTime', endOfMonth.toMillis())
      )
      .collect();
    const usageMap = messages.reduce(
      (state, m) => {
        const totalCostEstimated = m.totalCostEstimated;
        if (totalCostEstimated) {
          for (const { currency, value } of totalCostEstimated) {
            // aggregate by currency
            state.totalCostMap[currency] = {
              value: state.totalCostMap[currency]?.value || 0,
              currency,
            };
            state.totalCostMap[currency].value += value;

            // aggregate by user
            const userId = m.userId;
            if (!state.costByUserMap[userId]) {
              //init tracking for user
              state.costByUserMap[userId] = {
                userId,
                costs: [],
              };
            }
            const userCosts = state.costByUserMap[userId].costs;
            let costForCurrency = userCosts.find(
              (c) => c.currency === currency
            );
            if (!costForCurrency) {
              //init tracking for currency
              costForCurrency = {
                currency,
                value: 0,
              };
              userCosts.push(costForCurrency);
            }
            // get the cost for the currency and increment
            costForCurrency.value += value;
          }
        }
        return state;
      },
      {
        totalCostMap: {} as Record<string, { value: number; currency: string }>,
        costByUserMap: {} as Record<
          string, //user id and currency
          { userId: Id<'user'>; costs: { value: number; currency: string }[] }
        >,
      }
    );

    const totalCostList = Object.values(usageMap.totalCostMap);
    const usage: SystemUsage = {
      cycle: {
        year: args.year,
        month: args.month,
      },
      totalCost: totalCostList,
      costByUser: Object.values(usageMap.costByUserMap),
    };
    return usage;
  },
});
