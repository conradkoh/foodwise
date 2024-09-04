import { formatDeficitSurplus } from "@/domain/usecases/process-message/messages/fragments/deficit";
import { describe, test, expect } from "vitest";

describe("Deficit Surplus", () => {
	test("Deficit", () => {
		const result = formatDeficitSurplus({
			deficit: { value: 1000, units: "kcal" },
		});
		expect(result).toBe("Deficit: 👍🏼 1000 kcal");
	});
	test("Surplus", () => {
		const result = formatDeficitSurplus({
			deficit: { value: -1000, units: "kcal" },
		});
		expect(result).toBe("Surplus: ⚠️ 1000 kcal");
	});
	test("No deficit", () => {
		const result = formatDeficitSurplus({
			deficit: undefined,
		});
		expect(result).toBe("Deficit: No data");
	});
});
