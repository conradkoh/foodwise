import { INTENTS } from '@/domain/usecases/process-message/intent';
import { z } from 'zod';

const baseAction = z.object({
  intent: z.enum([
    INTENTS.GET_GENERAL_ADVICE,
    INTENTS.ESTIMATE_CALORIES,
    INTENTS.RECORD_WEIGHT,
    INTENTS.RECORD_MEALS_AND_CALORIES,
    INTENTS.RECORD_ACTIVITIES_AND_BURN,
    INTENTS.GET_WEEKLY_SUMMARY,
    INTENTS.EDIT_PREVIOUS_ACTION,
  ]),
  // .describe('The intent of the action'),
});

const weightAction = baseAction.extend({
  intent: z.literal(INTENTS.RECORD_WEIGHT),
  // .describe("Extract user's weight information if provided."),
  weight: z.object({
    value: z.number(), // .describe('The weight value'),
    units: z.literal('kg'), // .describe('The unit of weight measurement'),
  }),
});

const mealAction = baseAction.extend({
  intent: z.literal(INTENTS.RECORD_MEALS_AND_CALORIES),
  // .describe(
  //   "Extract user's meal and estimate calorie intake information if provided."
  // ),
  items: z.array(
    z.object({
      name: z.string(),
      estimatedCalories: z.object({
        units: z.literal('kcal'),
        min: z.number(), // .describe('The minimum estimated calorie content'),
        max: z.number(), // .describe('The maximum estimated calorie content'),
      }),
    })
  ),
});

const activityAction = baseAction.extend({
  intent: z.literal(INTENTS.RECORD_ACTIVITIES_AND_BURN),
  // .describe(
  //   "Extract user's activity information and estimate calorie burn information if provided."
  // ),
  activity: z.string(), // .describe('The name or description of the activity'),
  caloriesBurned: z.object({
    units: z.literal('kcal'),
    min: z.number(), // .describe('The minimum estimated calorie content'),
    max: z.number(), // .describe('The maximum estimated calorie content'),
  }),
});

const generalAdviceAction = baseAction.extend({
  intent: z.literal(INTENTS.GET_GENERAL_ADVICE),
  // .describe(
  //   'Respond with clear precise advice, favoring numbers and verified data backed by research.'
  // ),
  advice: z.string(), // .describe('The general health advice'),
});

const estimateCaloriesAction = baseAction.extend({
  intent: z.literal(INTENTS.ESTIMATE_CALORIES),
  // .describe("Estimate the calories for the user's meal."),
  items: z.array(
    z.object({
      name: z.string(),
      estimatedCalories: z.object({
        units: z.literal('kcal'),
        min: z.number(), // .describe('The minimum estimated calorie content'),
        max: z.number(), // .describe('The maximum estimated calorie content'),
      }),
    })
  ),
});

const setTimezoneAction = baseAction.extend({
  intent: z.literal(INTENTS.SET_TIMEZONE),
  // .describe(
  //   "Set the user's timezone. The timezone should be in a standard format (e.g., 'America/New_York', 'Europe/London')."
  // ),
  timezone: z.string(), // .describe('The timezone in a standard format'),
});

const getWeeklySummaryAction = baseAction.extend({
  intent: z.literal(INTENTS.GET_WEEKLY_SUMMARY),
  // .describe("Get the user's weekly summary of activities, calories, and weight changes."),
});

const getDailySummaryAction = baseAction.extend({
  intent: z.literal(INTENTS.GET_DAILY_SUMMARY),
  // .describe("Get the user's daily summary of activities, calories, and weight changes."),
});

const editPreviousActionAction = baseAction.extend({
  intent: z.literal(INTENTS.EDIT_PREVIOUS_ACTION),
  // .describe("Edit a previous action (activity, meal, or weight)"),
});

const setUserGenderAction = baseAction.extend({
  intent: z.literal(INTENTS.SET_USER_GENDER),
  gender: z.union([z.literal('male'), z.literal('female')]),
});

const setUserAgeAction = baseAction.extend({
  intent: z.literal(INTENTS.SET_USER_AGE),
  age: z.number(),
});

const setUserHeightAction = baseAction.extend({
  intent: z.literal(INTENTS.SET_USER_HEIGHT),
  height: z.object({
    value: z.number(),
    units: z.literal('cm'),
  }),
});

export const stage1Output_zodSchema = z.object({
  actions: z.array(
    z.union([
      weightAction,
      mealAction,
      activityAction,
      generalAdviceAction,
      estimateCaloriesAction,
      setTimezoneAction,
      getWeeklySummaryAction,
      getDailySummaryAction,
      editPreviousActionAction,
      setUserGenderAction,
      setUserAgeAction,
      setUserHeightAction,
    ])
  ),
  // .describe("List of actions to be taken based on the user's input"),
});

export type Stage1Output = z.infer<typeof stage1Output_zodSchema>;
