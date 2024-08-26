export const PROGRESS_UPDATE_TEXT = (p: ProgressUpdateParams) => {
  const deficit = p.caloriesOut - p.caloriesIn;
  const deficitSymbol = deficit > 0 ? '👍🏼' : '‼️';
  return `
<b>Your progress for ${p.date}</b>
 - 🍔 In: ${p.caloriesIn} kcal, 🔥 Out: ${p.caloriesOut} kcal, ${deficitSymbol} Deficit: ${deficit} kcal
`.trim();
};

type ProgressUpdateParams = {
  date: string;
  caloriesIn: number;
  caloriesOut: number;
};
