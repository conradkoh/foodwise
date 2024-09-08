import { formatDeficitSurplus } from "@/domain/usecases/process-message/messages/fragments/deficit";
import { describe, test, expect } from "vitest";

describe("Deficit Surplus", () => {
	test("Deficit", () => {
		const result = formatDeficitSurplus({
			mode: "by_deficit",
			deficit: { value: 1000, units: "kcal" },
		});
		expect(result).toBe("👍🏼 <code>1000 kcal</code> deficit");
	});
	test("Surplus", () => {
		const result = formatDeficitSurplus({
			mode: "by_deficit",
			deficit: { value: -1000, units: "kcal" },
		});
		expect(result).toBe("⚠️ <code>1000 kcal</code> surplus");
	});
	test("No deficit", () => {
		const result = formatDeficitSurplus({
			mode: "by_deficit",
			deficit: undefined,
		});
		expect(result).toBe("No data");
	});
});
