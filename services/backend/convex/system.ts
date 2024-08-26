import { SystemUsage } from '@/domain/entities/system';
import { internal } from 'convex/_generated/api';
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
        report += `\n    No data found`;
        continue;
      }
      for (const costForCurrency of monthlyUsage.totalCost) {
        report += `\n      - ${costForCurrency.currency}: ${costForCurrency.value}`;
      }
    }
    return report.trim();
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
            state.totalCostMap[currency] = {
              value: state.totalCostMap[currency]?.value || 0,
              currency,
            };
            state.totalCostMap[currency].value += value;
          }
        }
        return state;
      },
      {
        totalCostMap: {} as Record<string, { value: number; currency: string }>,
      }
    );

    const totalCostList = Object.values(usageMap.totalCostMap);
    const usage: SystemUsage = {
      cycle: {
        year: args.year,
        month: args.month,
      },
      totalCost: totalCostList,
    };
    return usage;
  },
});
